import { useId } from 'react';
import ResultCard from './ResultCard.jsx';
import ResultDownloadActions from './ResultDownloadActions.jsx';

export default function ResultsGroup({ session, onLoadCalculation, onSelectAnotherSheet, busy = false, expandedResults = {}, onToggleResult }) {
  const headingId = useId();
  if (!session) return null;
  const relevantCount = session.sheets.filter(sheet => sheet.relevant).length;
  const calculationBySheet = new Map(session.calculations.map(calculation => [calculation.sheetName, calculation]));
  const orderedCalculations = session.sheets
    .map(sheet => calculationBySheet.get(sheet.name))
    .filter(Boolean);

  return (
    <section className="panel excel-results-group" aria-labelledby={headingId}>
      <div className="section-heading excel-section-heading"><div><h2 id={headingId}>Workbook calculation results</h2></div></div>
      <div className="excel-panel-body">
        <div className="excel-results-overview">
          <div>
            <h3 className="excel-results-title">{session.displayName}</h3>
            <p className="excel-results-count">{relevantCount} {relevantCount === 1 ? 'sheet' : 'sheets'} detected · {orderedCalculations.length} calculated{orderedCalculations.length ? ` · combined export includes ${orderedCalculations.length} ${orderedCalculations.length === 1 ? 'sheet' : 'sheets'}` : ''}</p>
          </div>
          <div className="excel-workbook-actions">
            <button type="button" className="button button-reset" onClick={onSelectAnotherSheet} disabled={busy}>Select Another Sheet</button>
            {orderedCalculations.length > 0 && <ResultDownloadActions scope="workbook" subject={`${session.displayName} workbook results`} exportData={{ workbookName: session.displayName, calculations: orderedCalculations }} />}
          </div>
        </div>
        {orderedCalculations.length === 0 ? <p className="excel-empty">Select a worksheet and calculate its Cv to add a result here. Results remain available during this session.</p> : <div className="excel-result-stack">{orderedCalculations.map(calculation => <ResultCard key={calculation.id} calculation={calculation} workbookName={session.fileName} open={expandedResults[calculation.sheetName] ?? false} onToggle={onToggleResult} onLoadCalculation={onLoadCalculation} />)}</div>}
      </div>
    </section>
  );
}
