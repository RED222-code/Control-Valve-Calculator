import { CONDITIONS } from '../data/serviceConfig.js';
import { formatCv } from '../utils/formatting.js';
import Icon from './Icon.jsx';

export default function ResultCard({ calculation, workbookName, onLoadCalculation, open, onToggle }) {
  const { sheetName, service, results } = calculation;
  const maximumCv = results.maximumCalculatedCv ?? Math.max(...CONDITIONS.map(({ key }) => results[`${key}Cv`]));

  return (
    <details className="excel-result-card" id={`workbook-result-${encodeURIComponent(sheetName)}`} open={open} onToggle={event => onToggle?.(sheetName, event.currentTarget.open)}>
      <summary>
        <Icon name="chevron" className="excel-result-chevron" size={18} />
        <span className="excel-result-name">{sheetName}</span>
        <span className="excel-service-badge">{service.toUpperCase()}</span>
        <span className="excel-result-preview">Maximum Cv: <strong>{formatCv(maximumCv)}</strong></span>
      </summary>
      <div className="excel-result-card-body">
        <p className="excel-card-service">Service: {service === 'gas' ? 'Gas' : 'Liquid'}</p>
        <div className="excel-card-condition-results">{CONDITIONS.map(({ key, label }) => <div key={key}><span>{label} Cv</span><output aria-label={`${label} Cv result`}>{formatCv(results[`${key}Cv`])}</output></div>)}</div>
        <div className="excel-card-maximum"><span>Maximum Calculated Cv</span><output aria-label="Maximum Calculated Cv result">{formatCv(maximumCv)}</output></div>
      </div>
    </details>
  );
}
