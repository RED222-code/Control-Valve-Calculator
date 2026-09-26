import { useId } from 'react';
import ExcelUploader from './ExcelUploader.jsx';
import SheetSelector from './SheetSelector.jsx';
import './excel.css';

export default function WorkbookPanel({ session, busy, error, onFileSelected, onSelectSheet, selectedSheetName }) {
  const headingId = useId();

  return (
    <section className="panel workbook-panel" aria-labelledby={headingId} aria-busy={busy || undefined}>
      <div className="section-heading excel-section-heading"><div><h2 id={headingId}>Import Excel workbook</h2></div></div>
      <div className="excel-panel-body">
        <ExcelUploader busy={busy} onFileSelected={onFileSelected} />
        {error && <p className="excel-feedback excel-error" role="alert">{error}</p>}
        {session && (
          <div className="excel-workbook-content">
            <div className="excel-workbook-meta"><p className="excel-file-name">{session.fileName}</p></div>
            <SheetSelector sheets={session.sheets} selectedSheetName={selectedSheetName} onSelectSheet={onSelectSheet} busy={busy} />
          </div>
        )}
      </div>
    </section>
  );
}
