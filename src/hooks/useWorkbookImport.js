import { useRef, useState } from 'react';
import { parseValveSheet } from '../importers/valveSheetParser.js';
import { createSession } from '../data/serviceConfig.js';
import { validateOperatingConditions } from '../utils/validation.js';

const copyInputs = (data) => Object.fromEntries(Object.entries(data).map(([key, values]) => [key, { ...values }]));

// Keep only normalized parsed data, editable drafts, and saved results in state.
export default function useWorkbookImport(onServiceChange, restored = null) {
  const [workbookSession, setWorkbookSession] = useState(restored?.workbookSession ?? null);
  const [currentSheetName, setCurrentSheetName] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [duplicate, setDuplicate] = useState(null);
  const [replacementFile, setReplacementFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reading = useRef(false);
  const activeImport = workbookSession && currentSheetName && Object.hasOwn(workbookSession.drafts, currentSheetName)
    ? workbookSession.drafts[currentSheetName] : null;

  function updateStatuses(previous, activeName) {
    return previous.sheets.map((sheet) => ({ ...sheet, status: previous.calculations.some((item) => item.sheetName === sheet.name)
      ? 'calculated' : sheet.name === activeName ? 'loaded' : 'unprocessed' }));
  }

  function returnToManual() {
    setCurrentSheetName(null);
    setPendingImport(null);
    setWorkbookSession((previous) => previous ? { ...previous, sheets: updateStatuses(previous, null) } : previous);
  }

  async function loadWorkbook(file) {
    if (reading.current) return;
    reading.current = true;
    setBusy(true);
    setError('');
    try {
      // Keep the Excel library out of the initial manual-calculator download.
      const { parseWorkbookFile } = await import('../importers/workbookParser.js');
      const parsed = await parseWorkbookFile(file);
      const parsedSheets = Object.fromEntries(parsed.sheets.filter(sheet => sheet.relevant).map(sheet => {
        try {
          const worksheet = parsed.workbook.Sheets[sheet.name];
          const initial = parseValveSheet(worksheet, sheet.name);
          return [sheet.name, { initial, ...(initial.service ? {} : {
            liquid: parseValveSheet(worksheet, sheet.name, 'liquid'),
            gas: parseValveSheet(worksheet, sheet.name, 'gas'),
          }) }];
        } catch (failure) { return [sheet.name, { error: failure.message }]; }
      }));
      setWorkbookSession({ fileName: parsed.fileName, displayName: parsed.displayName,
        sheets: parsed.sheets, calculations: [], parsedSheets, drafts: {} });
      setCurrentSheetName(null);
      setPendingImport(null);
      setDuplicate(null);
    } catch (failure) {
      setError(failure.message || 'The workbook could not be read. Choose a valid Excel file.');
    } finally {
      reading.current = false;
      setBusy(false);
    }
  }

  function selectFile(file) {
    if (!file || reading.current) return;
    setError('');
    if (workbookSession?.calculations.length) setReplacementFile(file);
    else void loadWorkbook(file);
  }

  function confirmReplacement() {
    const file = replacementFile;
    setReplacementFile(null);
    if (file) void loadWorkbook(file);
  }

  function activateDraft(draft) {
    setPendingImport(null);
    setCurrentSheetName(draft.sheetName);
    onServiceChange(draft.service);
    setWorkbookSession((previous) => ({ ...previous,
      sheets: updateStatuses(previous, draft.sheetName),
      drafts: { ...previous.drafts, [draft.sheetName]: draft },
    }));
  }

  function loadSheet(sheetName, serviceOverride = null) {
    const sheet = workbookSession?.sheets.find((item) => item.name === sheetName);
    if (!sheet?.relevant || reading.current) return;
    setError('');
    if (!serviceOverride && Object.hasOwn(workbookSession.drafts, sheetName)) {
      const draft = workbookSession.drafts[sheetName];
      const feedback = draft.session.feedback;
      activateDraft(feedback?.kind === 'info' && feedback.text.startsWith('Imported from ')
        ? { ...draft, session: { ...draft.session, feedback: null } } : draft);
      return;
    }
    try {
      const parsed = workbookSession.parsedSheets[sheetName];
      if (parsed.error) throw new Error(parsed.error);
      const imported = (serviceOverride && parsed[serviceOverride]) || parsed.initial;
      if (!imported.service) {
        returnToManual();
        setPendingImport(imported);
        return;
      }
      const checked = validateOperatingConditions(imported.data, imported.service, imported.temperatureUnit);
      activateDraft({ sheetName, service: imported.service, importData: imported, allowRecalculate: false,
        session: { ...createSession(), data: copyInputs(imported.data), temperatureUnit: imported.temperatureUnit,
          errors: imported.errors ?? checked.errors, submitted: true,
          feedback: null },
      });
    } catch (failure) {
      setError(failure.message || `Values could not be read from ${sheetName}.`);
    }
  }

  function selectSheet(sheetName) {
    if (workbookSession?.calculations.some((item) => item.sheetName === sheetName)) {
      setDuplicate({ sheetName, source: 'selector' });
    } else loadSheet(sheetName);
  }

  function updateSession(updater) {
    setWorkbookSession((previous) => {
      const draft = previous.drafts[currentSheetName];
      return { ...previous, drafts: { ...previous.drafts, [currentSheetName]: { ...draft, session: updater(draft.session) } } };
    });
  }

  function loadCalculation(calculation, allowRecalculate = false) {
    activateDraft({ sheetName: calculation.sheetName, service: calculation.service, importData: calculation.importData,
      allowRecalculate, session: { ...createSession(), data: copyInputs(calculation.inputs),
        temperatureUnit: calculation.temperatureUnit, units: calculation.units, feedback: { kind: 'info', text: allowRecalculate
          ? `Recalculating ${calculation.sheetName}. Review inputs, then select Calculate Cv to replace its saved result.`
          : `Saved inputs from ${calculation.sheetName} loaded. The saved result is unchanged.` },
      },
    });
  }

  function requestCalculation() {
    if (activeImport && !activeImport.allowRecalculate && workbookSession.calculations.some((item) => item.sheetName === currentSheetName)) {
      setDuplicate({ sheetName: currentSheetName, source: 'calculator' });
      return false;
    }
    return true;
  }

  function recalculate() {
    const existing = workbookSession.calculations.find((item) => item.sheetName === duplicate.sheetName);
    if (duplicate.source === 'calculator' && activeImport?.sheetName === duplicate.sheetName) {
      activateDraft({ ...activeImport, allowRecalculate: true, session: { ...activeImport.session,
        feedback: { kind: 'info', text: 'Review inputs, then select Calculate Cv to replace the saved result.' } } });
    } else if (existing) loadCalculation(existing, true);
    setDuplicate(null);
  }

  function viewExisting() {
    const sheetName = duplicate.sheetName;
    setDuplicate(null);
    requestAnimationFrame(() => {
      const card = document.getElementById(`workbook-result-${encodeURIComponent(sheetName)}`);
      if (card) {
        card.focus({ preventScroll: true });
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  function saveCalculation(results) {
    if (!activeImport) return;
    const calculation = { id: currentSheetName, sheetName: currentSheetName, service: activeImport.service,
      inputs: copyInputs(activeImport.session.data), temperatureUnit: activeImport.session.temperatureUnit, units: activeImport.session.units,
      importData: activeImport.importData,
      results: { minimumCv: results.minimum.cv, normalCv: results.normal.cv, maximumCv: results.maximum.cv,
        maximumCalculatedCv: Math.max(results.minimum.cv, results.normal.cv, results.maximum.cv) },
    };
    setWorkbookSession((previous) => {
      const existing = previous.calculations.some((item) => item.sheetName === calculation.sheetName);
      // Replacement is explicit; repeated clicks can never append duplicate worksheet identities.
      if (existing && !previous.drafts[currentSheetName].allowRecalculate) return previous;
      return { ...previous,
        calculations: existing ? previous.calculations.map((item) => item.sheetName === calculation.sheetName ? calculation : item)
          : [...previous.calculations, calculation],
        sheets: previous.sheets.map((sheet) => sheet.name === calculation.sheetName ? { ...sheet, status: 'calculated' } : sheet),
        drafts: { ...previous.drafts, [currentSheetName]: { ...previous.drafts[currentSheetName], allowRecalculate: false } },
      };
    });
  }

  return { workbookSession, activeImport, importData: pendingImport ?? activeImport?.importData,
    persistenceState: { workbookSession, currentSheetName, pendingImport },
    selectedSheetName: pendingImport?.sheetName ?? currentSheetName, busy, error, duplicate, replacementFile,
    selectFile, selectSheet, updateSession, returnToManual, confirmReplacement,
    cancelReplacement: () => setReplacementFile(null), cancelDuplicate: () => setDuplicate(null),
    chooseService: (service) => { if (pendingImport) loadSheet(pendingImport.sheetName, service); },
    loadCalculation, requestCalculation, recalculate, viewExisting, saveCalculation,
  };
}
