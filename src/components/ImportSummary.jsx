import { useId } from 'react';
import Icon from './Icon.jsx';
import { CONDITIONS, INPUT_ROWS } from '../data/serviceConfig.js';

function listText(value) {
  return Array.isArray(value) ? value.join(', ') : value;
}

export default function ImportSummary({ importData, data, onChooseService, onContinue, onManual }) {
  const headingId = useId();
  if (!importData) return null;
  const { sheetName, service, summary = [], warnings = [] } = importData;
  const currentData = data ?? importData.data;
  const requiredFields = INPUT_ROWS.filter(row => row.type !== 'automatic' && (service === 'gas' || !row.gasOnly));
  const hasMissingValues = CONDITIONS.some(({ key }) => requiredFields.some(({ key: field }) =>
    String(currentData?.[key]?.[field] ?? '').trim() === '',
  ));
  // Keep service selection available when the worksheet's service is unknown.
  if (service && !hasMissingValues) return null;

  return (
    <section className="panel excel-import-summary" aria-labelledby={headingId}>
      <div className="section-heading excel-section-heading"><div><h2 id={headingId}>Imported from {sheetName}</h2></div>{service && <span className="excel-service-badge">{service.toUpperCase()} SERVICE</span>}</div>
      <div className="excel-panel-body">
        {!service ? (
          <div className="excel-service-choice" role="group" aria-label="Choose imported service type">
            <p>Service type could not be determined.</p>
            <div className="excel-action-row"><button type="button" className="button button-primary" onClick={() => onChooseService('gas')}><Icon name="gas" size={17} />Gas</button><button type="button" className="button button-reset" onClick={() => onChooseService('liquid')}><Icon name="liquid" size={17} />Liquid</button></div>
          </div>
        ) : <p className="excel-intro">Detected values are loaded into the calculator. Review the imported values and complete any missing inputs before calculating.</p>}
        {summary.length > 0 && (
          <ul className="excel-import-fields">
            {summary.map(field => {
              const missing = !field.found || field.missingConditions?.length > 0;
              const missingText = listText(field.missingConditions);
              const unitsText = listText(field.detectedUnits);
              return (
                <li key={field.field || field.label} className={missing ? 'has-missing' : 'is-imported'}>
                  <Icon name={missing ? 'alert' : 'check'} size={16} />
                  <div><span className="excel-import-field-label">{field.label}</span><span className="excel-import-field-status">{field.message || (field.found ? missingText ? `Missing: ${missingText}` : 'Imported' : 'Not found — enter manually')}{unitsText && <span className="excel-detected-unit"> · Detected units: {unitsText}</span>}</span></div>
                </li>
              );
            })}
          </ul>
        )}
        {warnings.length > 0 && <div className="excel-import-warnings" role="status"><h3>Import notes</h3><ul>{warnings.map((warning, index) => <li key={index}>{typeof warning === 'string' ? warning : warning.message}</li>)}</ul></div>}
        <div className="excel-action-row excel-summary-actions"><button type="button" className="button button-primary" onClick={onContinue} disabled={!service}>Continue to Calculator<Icon name="arrow" size={17} /></button><button type="button" className="button button-reset" onClick={onManual}>Use Manual Entry</button></div>
      </div>
    </section>
  );
}
