import { useEffect, useId, useRef } from 'react';

export default function WorkbookChangeModal({ fileName, onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const headingId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, []);

  return (
    <dialog ref={dialogRef} className="excel-modal" aria-labelledby={headingId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); onCancel(); }}>
      <h2 id={headingId}>A workbook is already open.</h2>
      <p id={descriptionId}>Loading {fileName} will clear the current imported worksheets and calculation results.</p>
      <div className="excel-modal-actions"><button type="button" className="button button-reset" onClick={onCancel} autoFocus>Cancel</button><button type="button" className="button button-primary" onClick={onConfirm}>Load New Workbook</button></div>
    </dialog>
  );
}
