import { useEffect, useRef, useState } from 'react';
import { unitFactor, convertInputUnit } from '../utils/displayUnits.js';
import { parseNumericInput } from '../utils/validation.js';
import { clearSession, loadSession, saveSession } from '../utils/sessionStorage.js';
import ServiceSelector from '../components/ServiceSelector.jsx';
import SizingTable from '../components/SizingTable.jsx';
import ResultsPanel from '../components/ResultsPanel.jsx';
import FormulaPanel from '../components/FormulaPanel.jsx';
import Icon from '../components/Icon.jsx';
import { CONDITIONS, INPUT_ROWS, createSession } from '../data/serviceConfig.js';
import { calculateLiquidCv } from '../calculators/liquidCalculator.js';
import { calculateGasCv } from '../calculators/gasCalculator.js';
import { validateOperatingConditions } from '../utils/validation.js';
import { convertTemperatureInput } from '../utils/temperature.js';
import useWorkbookImport from '../hooks/useWorkbookImport.js';
import WorkbookPanel from '../components/WorkbookPanel.jsx';
import ImportSummary from '../components/ImportSummary.jsx';
import ResultsGroup from '../components/ResultsGroup.jsx';
import DuplicateWarningModal from '../components/DuplicateWarningModal.jsx';
import WorkbookChangeModal from '../components/WorkbookChangeModal.jsx';

export default function ValveSizing() {
  const [initial, setInitial] = useState(loadSession);
  const [generation, setGeneration] = useState(0);
  return <SizingWorkspace key={generation} restored={initial} onClear={() => {
    setInitial(null);
    setGeneration(value => value + 1);
  }} />;
}

function SizingWorkspace({ restored, onClear }) {
  const [service, setService] = useState(restored?.manualService ?? 'liquid');
  const [sessions, setSessions] = useState(() => restored?.sessions ?? { liquid: createSession(), gas: createSession() });
  const [inputSource, setInputSource] = useState('manual');
  const manualService = useRef(restored?.manualService ?? 'liquid');
  const workbook = useWorkbookImport(setService, restored?.workbook);
  const [storageWarning, setStorageWarning] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const clearDialog = useRef(null);
  const toolbarRef = useRef(null);
  const cleared = useRef(false);
  const hasWorkspace = useRef(Boolean(restored));
  const snapshot = { service, sessions, inputSource, manualService: manualService.current, workbook: workbook.persistenceState };
  const latest = useRef(snapshot);
  latest.current = snapshot;

  function persist() {
    if (!cleared.current) setStorageWarning(!saveSession(latest.current));
  }

  useEffect(() => {
    // Leave a freshly cleared workspace absent from storage until it is edited.
    if (!hasWorkspace.current && service === 'liquid' && inputSource === 'manual' && !workbook.workbookSession &&
        JSON.stringify(sessions) === JSON.stringify({ liquid: createSession(), gas: createSession() })) return;
    hasWorkspace.current = true;
    const timer = window.setTimeout(persist, 400);
    const flush = () => persist();
    const hidden = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [service, sessions, inputSource, workbook.workbookSession, workbook.persistenceState.currentSheetName, workbook.persistenceState.pendingImport]);

  useEffect(() => {
    if (clearOpen) clearDialog.current?.showModal();
  }, [clearOpen]);

  useEffect(() => {
    const toolbar = toolbarRef.current;
    const root = document.documentElement;
    const resize = () => root.style.setProperty('--workspace-sticky-height', `${toolbar.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(resize);
    observer.observe(toolbar);
    resize();
    return () => {
      observer.disconnect();
      root.style.removeProperty('--workspace-sticky-height');
    };
  }, []);
  const session = workbook.activeImport?.session ?? sessions[service];
  const label = service === 'liquid' ? 'Liquid' : 'Gas';

  function updateSession(updater) {
    if (workbook.activeImport) workbook.updateSession(updater);
    else setSessions((previous) => ({ ...previous, [service]: updater(previous[service]) }));
  }

  function manualEntry() {
    workbook.returnToManual();
    setService(manualService.current);
    setInputSource('manual');
  }

  function changeService(nextService) {
    if (nextService !== service) workbook.returnToManual();
    if (!workbook.activeImport || nextService !== service) manualService.current = nextService;
    setService(nextService);
  }

  function continueToCalculator() {
    requestAnimationFrame(() => {
      const firstInput = document.getElementById(`${service}-minimum-Q`);
      firstInput?.focus({ preventScroll: true });
      document.getElementById('operating-conditions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function selectAnotherSheet() {
    setInputSource('excel');
    requestAnimationFrame(() => {
      const dropdown = document.querySelector('.excel-sheet-dropdown');
      dropdown?.focus({ preventScroll: true });
      dropdown?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    });
  }

  function handleChange(condition, field, value) {
    updateSession((previous) => {
      const data = { ...previous.data, [condition]: { ...previous.data[condition], [field]: value } };
      const checked = validateOperatingConditions(data, service, previous.temperatureUnit, previous.units);
      const errors = previous.submitted ? checked.errors : { ...previous.errors };
      if (!previous.submitted) {
        // Refresh errors already shown, without marking untouched fields invalid.
        for (const name of Object.keys(previous.errors[condition] ?? {})) {
          errors[condition] = { ...errors[condition], [name]: checked.errors[condition][name] };
        }
      }
      return { ...previous, data, errors, results: null, feedback: previous.results || previous.feedback?.kind === 'stale' ? { kind: 'stale', text: 'Inputs changed. Calculate again to update results.' } : null };
    });
  }

  function focusFirstError(errors) {
    const rows = INPUT_ROWS.filter((row) => row.type !== 'automatic' && (service === 'gas' || !row.gasOnly));
    for (const row of rows) {
      for (const { key } of CONDITIONS) {
        if (errors[key]?.[row.key]) {
          requestAnimationFrame(() => document.getElementById(`${service}-${key}-${row.key}`)?.focus());
          return;
        }
      }
    }
  }

  function calculate(event) {
    event.preventDefault();
    if (workbook.importData && !workbook.importData.service) return;
    if (!workbook.requestCalculation()) return;
    const checked = validateOperatingConditions(session.data, service, session.temperatureUnit, session.units);
    const errors = checked.errors;
    const results = {};
    if (checked.isValid) {
      for (const { key } of CONDITIONS) {
        const { Q, SG, P1, P2, Y, Z } = checked.values[key];
        try {
          results[key] = service === 'liquid' ? calculateLiquidCv(Q, SG, P1, P2) : calculateGasCv(Q, SG, P1, P2, Y, Z);
        } catch (error) {
          errors[key].Q = error.message;
        }
      }
    }
    const errorCount = Object.values(errors).reduce((count, fields) => count + Object.values(fields).filter(Boolean).length, 0);
    if (errorCount) {
      updateSession((previous) => ({ ...previous, errors, results: null, submitted: true, feedback: { kind: 'error', text: `Check ${errorCount} highlighted ${errorCount === 1 ? 'input' : 'inputs'} before calculating.` } }));
      focusFirstError(errors);
      return;
    }
    updateSession((previous) => ({ ...previous, errors: {}, results, submitted: true, feedback: null }));
    workbook.saveCalculation(results);
    if (workbook.activeImport) {
      const sheetName = workbook.activeImport.sheetName;
      requestAnimationFrame(() => {
        const card = document.getElementById(`workbook-result-${encodeURIComponent(sheetName)}`);
        if (card) card.open = true;
      });
    }
  }

  function reset() {
    updateSession(() => ({ ...createSession(), feedback: { kind: 'info', text: `${label} inputs and results reset.` } }));
  }

  function changeUnits(kind, unit) {
    const oldUnit = session.units?.[kind] ?? (kind === 'pressure' ? 'psi' : service === 'gas' ? 'SCFM' : 'gpm');
    if (unit === oldUnit) return;
    const fields = kind === 'pressure' ? ['P1', 'P2'] : ['Q'];
    const data = structuredClone(session.data);
    try {
      for (const { key } of CONDITIONS) {
        for (const field of fields) {
          let numeric;
          try { numeric = parseNumericInput(data[key][field]); } catch { continue; }
          const ratio = unitFactor(field, oldUnit, service) / unitFactor(field, unit, service);
          data[key][field] = String(Number(convertInputUnit(numeric, ratio).toPrecision(15)));
        }
      }
      const units = { ...session.units, [kind]: unit };
      const checked = validateOperatingConditions(data, service, session.temperatureUnit, units);
      updateSession(previous => ({ ...previous, data, units, results: null,
        errors: previous.submitted ? checked.errors : {},
        feedback: { kind: 'info', text: 'Units converted. Calculate to update results.' } }));
    } catch (error) {
      updateSession(previous => ({ ...previous, feedback: { kind: 'error', text: error.message } }));
    }
  }

  function changeTemperatureUnit(unit) {
    if (unit === session.temperatureUnit) return;
    const data = { ...session.data };
    try {
      for (const { key } of CONDITIONS) {
        data[key] = { ...data[key], T: convertTemperatureInput(data[key].T, session.temperatureUnit, unit) };
      }
    } catch (error) {
      updateSession((previous) => ({ ...previous, feedback: { kind: 'error', text: error.message } }));
      return;
    }
    const checked = validateOperatingConditions(data, service, unit, session.units);
    updateSession((previous) => ({ ...previous, data, temperatureUnit: unit, results: null, errors: previous.submitted ? checked.errors : {}, feedback: { kind: 'info', text: `Temperature unit changed to ${unit === 'K' ? 'kelvin' : unit === 'C' ? '°C' : '°F'}. Calculate to update results.` } }));
  }

  return (
    <main className="page-width main-content" id="calculator">
      <div className="workspace-heading">
        <h1>Control valve sizing</h1>
        <button type="button" className="button button-reset clear-session-button" disabled={workbook.busy} onClick={() => setClearOpen(true)}>Clear Session</button>
      </div>
      <div className="workspace-toolbar" ref={toolbarRef}>
      <div className="input-source-controls" role="group" aria-label="Input source">
        <button type="button" className={`button ${inputSource === 'manual' ? 'button-primary' : 'button-reset'}`} aria-pressed={inputSource === 'manual'} onClick={manualEntry}><Icon name="calculator" size={16} />Manual Entry</button>
        <button type="button" className={`button ${inputSource === 'excel' ? 'button-primary' : 'button-reset'}`} aria-pressed={inputSource === 'excel'} onClick={() => setInputSource('excel')}><Icon name="book" size={16} />Import Excel</button>
      </div>
      <ServiceSelector service={service} onChange={changeService} />
      </div>
      {storageWarning && <p role="status">Browser storage is unavailable or full. Your current work could not be saved.</p>}
      {inputSource === 'excel' && <WorkbookPanel session={workbook.workbookSession} busy={workbook.busy} error={workbook.error} onFileSelected={workbook.selectFile} onSelectSheet={workbook.selectSheet} selectedSheetName={workbook.selectedSheetName} />}
      <ImportSummary importData={workbook.importData} data={workbook.activeImport?.session.data} onChooseService={workbook.chooseService} onContinue={continueToCalculator} onManual={manualEntry} />
      <div id={`${service}-calculator`} role="tabpanel" aria-labelledby={`${service}-tab`} className="calculator-layout">
        <div className="calculator-main">
          <form className="panel operating-panel" id="operating-conditions" onSubmit={calculate} noValidate aria-label={`${label} service calculator`} hidden={Boolean(workbook.importData && !workbook.importData.service)}>
            <div className="operating-heading operating-heading-standalone"><div className="section-heading"><div><h2>Operating conditions</h2></div></div></div>
            <SizingTable service={service} data={session.data} errors={session.errors} results={session.results} temperatureUnit={session.temperatureUnit} onTemperatureUnitChange={changeTemperatureUnit} units={session.units} onUnitChange={changeUnits} onChange={handleChange} />
            <div className="form-actions"><div className="action-buttons"><button type="submit" className="button button-primary"><Icon name="calculator" size={18} />Calculate Cv<Icon name="arrow" size={16} /></button><button type="button" className="button button-reset" onClick={reset}><Icon name="reset" size={16} />Reset</button></div>{session.feedback && <div className={`form-feedback ${session.feedback.kind}`} role="status" aria-live="polite" aria-atomic="true"><Icon name={session.feedback.kind === 'success' ? 'check' : session.feedback.kind === 'error' ? 'alert' : 'info'} size={16} /><span>{session.feedback.text}</span></div>}</div>
          </form>
          {!workbook.activeImport && <ResultsPanel results={session.results} service={service} />}
          {workbook.workbookSession && <ResultsGroup session={workbook.workbookSession} onSelectAnotherSheet={selectAnotherSheet} busy={workbook.busy} onLoadCalculation={(calculation) => {
            setInputSource('excel');
            workbook.loadCalculation(calculation);
            requestAnimationFrame(() => document.getElementById('operating-conditions')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
          }} />}
        </div>
        <FormulaPanel service={service} />
      </div>
      <div id={`${service === 'liquid' ? 'gas' : 'liquid'}-calculator`} role="tabpanel" aria-labelledby={`${service === 'liquid' ? 'gas' : 'liquid'}-tab`} hidden />
      {workbook.duplicate && <DuplicateWarningModal sheetName={workbook.duplicate.sheetName} onView={workbook.viewExisting} onRecalculate={workbook.recalculate} onCancel={workbook.cancelDuplicate} />}
      {workbook.replacementFile && <WorkbookChangeModal fileName={workbook.replacementFile.name} onConfirm={workbook.confirmReplacement} onCancel={workbook.cancelReplacement} />}
      {clearOpen && <dialog ref={clearDialog} className="excel-modal" aria-labelledby="clear-session-heading" aria-describedby="clear-session-description" onCancel={event => { event.preventDefault(); setClearOpen(false); }}>
        <h2 id="clear-session-heading">Clear Session</h2>
        <p id="clear-session-description">This will remove the current saved workspace and all calculation results.</p>
        <div className="excel-modal-actions">
          <button type="button" className="button button-reset" autoFocus onClick={() => setClearOpen(false)}>Cancel</button>
          <button type="button" className="button button-primary" onClick={() => {
            if (!clearSession()) { setStorageWarning(true); setClearOpen(false); return; }
            cleared.current = true;
            onClear();
          }}>Clear Session</button>
        </div>
      </dialog>}
    </main>
  );
}
