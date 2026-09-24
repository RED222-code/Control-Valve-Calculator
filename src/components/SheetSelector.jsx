import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';

const STATUS_LABELS = { unprocessed: 'Unprocessed', loaded: 'Editing', calculated: 'Calculated' };

export default function SheetSelector({ sheets, selectedSheetName, onSelectSheet, busy = false }) {
  const selectId = useId();
  const shellRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const selected = sheets.find(sheet => sheet.name === selectedSheetName);
  const enabledIndices = sheets.flatMap((sheet, index) => sheet.relevant ? [index] : []);
  const expanded = open && !busy;
  const description = selected ? [
    selected.valveTag && selected.valveTag !== selected.name ? `Tag: ${selected.valveTag}` : null,
    selected.description,
    selected.fluidState ? `Fluid state: ${selected.fluidState}` : null,
    selected.usefulProcessData ? 'Process data detected.' : 'Review required: process data may be incomplete.',
  ].filter(Boolean).join(' · ') : '';

  useEffect(() => {
    if (!expanded) return;
    function dismiss(event) {
      if (!shellRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [expanded]);

  useEffect(() => {
    if (expanded && activeIndex >= 0) {
      document.getElementById(`${selectId}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [expanded, activeIndex, selectId]);

  function showMenu() {
    const current = sheets.findIndex(sheet => sheet.name === selectedSheetName && sheet.relevant);
    setActiveIndex(current >= 0 ? current : enabledIndices[0] ?? -1);
    setOpen(true);
  }

  function choose(index) {
    if (busy || !sheets[index]?.relevant) return;
    setOpen(false);
    triggerRef.current?.focus();
    onSelectSheet(sheets[index].name);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (expanded) choose(activeIndex); else showMenu();
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const current = enabledIndices.indexOf(activeIndex);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabledIndices.length - 1
        : !expanded ? enabledIndices.indexOf(sheets.findIndex(sheet => sheet.name === selectedSheetName))
          : current + (event.key === 'ArrowDown' ? 1 : -1);
      setActiveIndex(enabledIndices[Math.max(0, Math.min(enabledIndices.length - 1, next))] ?? -1);
      setOpen(true);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text = (now - searchRef.current.time < 700 ? searchRef.current.text : '') + event.key.toLowerCase();
      searchRef.current = { text, time: now };
      const match = enabledIndices.find(index => sheets[index].name.toLowerCase().startsWith(text));
      if (match !== undefined) { setActiveIndex(match); setOpen(true); }
    }
  }

  return (
    <div className="excel-sheet-selector">
      <label className="excel-sheet-label" id={`${selectId}-label`} htmlFor={selectId}>Workbook sheets</label>
      {sheets.length === 0 ? <p className="excel-empty">No worksheets were found in this workbook.</p> : (
        <>
          <div className="excel-sheet-dropdown-row">
            <div ref={shellRef} className={`excel-sheet-select-shell ${selected ? 'has-selection' : ''} ${expanded ? 'is-open' : ''}`}
              onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
              <button ref={triggerRef} type="button" id={selectId} className="excel-sheet-dropdown" role="combobox"
                aria-labelledby={`${selectId}-label`} aria-haspopup="listbox" aria-expanded={expanded}
                aria-controls={`${selectId}-menu`} aria-activedescendant={expanded && activeIndex >= 0 ? `${selectId}-option-${activeIndex}` : undefined}
                aria-describedby={description ? `${selectId}-description` : undefined} disabled={busy}
                onClick={() => expanded ? setOpen(false) : showMenu()} onKeyDown={handleKeyDown}>
                <span className="excel-sheet-select-icon"><Icon name={selected?.service || 'book'} size={19} /></span>
                <span className="excel-sheet-trigger-name">{selected?.name ?? 'Select a worksheet'}</span>
                {selected && <span className="excel-sheet-trigger-status">{STATUS_LABELS[selected.status] ?? 'Unprocessed'}</span>}
                <span className="excel-sheet-select-arrow"><Icon name="chevron" size={16} /></span>
              </button>
              <div className="excel-sheet-menu" hidden={!expanded}>
                <div className="excel-sheet-menu-heading" aria-hidden="true">Choose a worksheet<span>{sheets.length} sheets</span></div>
                <ul id={`${selectId}-menu`} className="excel-sheet-options" role="listbox" aria-labelledby={`${selectId}-label`}>
                  {sheets.map((sheet, index) => (
                    <li key={sheet.name} id={`${selectId}-option-${index}`} role="option" aria-label={sheet.name}
                      aria-selected={sheet.name === selectedSheetName} aria-disabled={!sheet.relevant}
                      aria-describedby={`${selectId}-meta-${index}`}
                      className={`excel-sheet-option ${activeIndex === index ? 'is-highlighted' : ''}`}
                      onPointerMove={() => { if (sheet.relevant) setActiveIndex(index); }}
                      onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
                      <span className="excel-sheet-option-icon"><Icon name={sheet.relevant ? sheet.service || 'book' : 'book'} size={18} /></span>
                      <span className="excel-sheet-option-content"><span className="excel-sheet-option-name">{sheet.name}</span>
                        <span className="excel-sheet-option-meta" id={`${selectId}-meta-${index}`}>
                          {sheet.relevant && <span className="excel-service-badge">{sheet.service?.toUpperCase() || 'Service unknown'}</span>}
                          <span className={`excel-menu-status status-${sheet.status}`}>{sheet.relevant ? STATUS_LABELS[sheet.status] ?? 'Unprocessed' : 'Ignored'}</span>
                        </span>
                      </span>
                      {sheet.name === selectedSheetName && <Icon name="check" size={18} />}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {selected?.status === 'calculated' && <button type="button" className="button button-reset" disabled={busy} onClick={() => onSelectSheet(selected.name)}>Open worksheet</button>}
          </div>
          {description && <p className="excel-selected-description" id={`${selectId}-description`}><Icon name={selected?.status === 'calculated' ? 'check' : 'info'} size={15} /><span>{description}</span></p>}
        </>
      )}
      {sheets.length > 0 && !sheets.some(sheet => sheet.relevant) && <p className="excel-feedback">No relevant control-valve worksheets were detected. You can continue with manual entry.</p>}
    </div>
  );
}
