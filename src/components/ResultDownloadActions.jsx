import { useId, useRef, useState } from 'react';
import { downloadResultPdf, downloadResultWord, downloadWorkbookPdf, downloadWorkbookWord } from '../utils/downloadResultSheet.js';
import Icon from './Icon.jsx';

export default function ResultDownloadActions({ exportData, subject = '', scope = 'result' }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const busyRef = useRef(false);
  const optionsRef = useRef(null);
  const optionsId = useId();
  const workbook = scope === 'workbook';

  async function download(format) {
    if (busyRef.current) return;
    busyRef.current = true;
    optionsRef.current?.hidePopover();
    setBusy(format);
    setError('');
    try {
      if (format === 'pdf') await (workbook ? downloadWorkbookPdf(exportData) : downloadResultPdf(exportData));
      else await (workbook ? downloadWorkbookWord(exportData) : downloadResultWord(exportData));
    } catch (downloadError) {
      console.error(downloadError);
      setError('Could not create the file. Please try again.');
    } finally {
      busyRef.current = false;
      setBusy('');
    }
  }

  return (
    <div className="result-download-wrap">
      <button type="button" className="button button-reset result-download-action"
        aria-label={subject ? 'Download ' + subject : 'Download'}
        popoverTarget={optionsId} disabled={Boolean(busy)}>
        <Icon name="download" size={15} />{busy ? 'Preparing download...' : 'Download'}
        <Icon name="chevron" size={14} />
      </button>
      <div id={optionsId} ref={optionsRef} popover="auto" className="result-download-options">
        <p>Download as</p>
        <button type="button" className="button button-reset" onClick={() => download('pdf')}>PDF</button>
        <button type="button" className="button button-reset" onClick={() => download('word')}>Word</button>
      </div>
      <span className="sr-only" aria-live="polite">{busy ? 'Preparing download.' : ''}</span>
      {error && <span className="result-download-error" role="alert">{error}</span>}
    </div>
  );
}
