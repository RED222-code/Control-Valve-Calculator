import { useRef } from 'react';
import Icon from './Icon.jsx';

export default function ExcelUploader({ onFileSelected, busy = false }) {
  const inputRef = useRef(null);

  function selectFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onFileSelected(file);
  }

  return (
    <div className="excel-uploader">
      <div className="excel-upload-actions">
        <input ref={inputRef} hidden type="file" accept=".xlsx,.xls,.xlsm,.xlsb" onChange={selectFile} disabled={busy} aria-label="Choose Excel File" />
        <button type="button" className="button button-primary" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Icon name="book" size={17} />Choose Excel File
        </button>
      </div>
      {busy && <p className="excel-feedback" role="status">Reading workbook locally…</p>}
    </div>
  );
}
