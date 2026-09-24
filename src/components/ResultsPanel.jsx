import { CONDITIONS } from '../data/serviceConfig.js';
import { formatCv } from '../utils/formatting.js';
import Icon from './Icon.jsx';
import ResultDownloadActions from './ResultDownloadActions.jsx';

export default function ResultsPanel({ results, service }) {
  const requiredCv = results ? Math.max(...CONDITIONS.map(({ key }) => results[key].cv)) : null;
  const controlling = results ? CONDITIONS.filter(({ key }) => results[key].cv === requiredCv).map(({ label }) => label).join(', ') : null;
  return (
    <section className="panel results-panel" aria-label="Calculation results">
      <div className="section-heading"><div><h2>Calculation results</h2></div>{results && <div className="result-heading-actions"><span className="result-status complete"><span className="status-dot" />Calculated</span><ResultDownloadActions exportData={{ service, results }} /></div>}</div>
      <div className="results-grid">
        <div className="condition-results">{CONDITIONS.map(({ key, label }, index) => (
          <div className={`condition-result condition-${key}`} key={key}>
            <span className="result-label"><span className={`range-dot range-${index}`} />{label} Cv</span>
            <output data-testid={`${key}-cv`} aria-label={`${label} Cv result`}>{formatCv(results?.[key]?.cv)}</output>
            <span className="result-detail">{label.toLowerCase()} operating point</span>
          </div>
        ))}</div>
        <div className="required-result">
          <span className="required-eyebrow"><Icon name="chart" size={17} />SIZING REFERENCE</span>
          <h3>Maximum Calculated Cv</h3>
          <div className="required-value"><output data-testid="required-cv" aria-label="Maximum Calculated Cv result">{formatCv(requiredCv)}</output><span>Cv</span></div>
          <p>{results ? `${controlling} ${controlling.includes(',') ? 'conditions govern' : 'condition governs'}` : 'The largest of the three calculated values'}</p>
        </div>
      </div>
    </section>
  );
}
