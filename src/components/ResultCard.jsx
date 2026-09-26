import { CONDITIONS } from '../data/serviceConfig.js';
import { formatCv } from '../utils/formatting.js';

export default function ResultCard({ calculation }) {
  const { sheetName, service, results } = calculation;
  const maximumCv = results.maximumCalculatedCv ?? Math.max(...CONDITIONS.map(({ key }) => results[`${key}Cv`]));

  return (
    <article className="excel-result-card" id={`workbook-result-${encodeURIComponent(sheetName)}`} tabIndex={-1} aria-label={`${sheetName} calculation result`}>
      <header className="excel-result-header">
        <span className="excel-result-name">{sheetName}</span>
        <span className="excel-service-badge">{service.toUpperCase()}</span>
        <span className="excel-result-preview">Maximum Cv: <strong>{formatCv(maximumCv)}</strong></span>
      </header>
      <div className="excel-result-card-body">
        <p className="excel-card-service">Service: {service === 'gas' ? 'Gas' : 'Liquid'}</p>
        <div className="excel-card-condition-results">{CONDITIONS.map(({ key, label }) => <div key={key}><span>{label} Cv</span><output aria-label={`${label} Cv result`}>{formatCv(results[`${key}Cv`])}</output></div>)}</div>
        <div className="excel-card-maximum"><span>Maximum Calculated Cv</span><output aria-label="Maximum Calculated Cv result">{formatCv(maximumCv)}</output></div>
      </div>
    </article>
  );
}
