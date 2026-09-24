import { useEffect, useId, useRef } from 'react';

export default function DuplicateWarningModal({ sheetName, onView, onRecalculate, onCancel }) {
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
      <h2 id={headingId}>{sheetName} has already been calculated.</h2>
      <p id={descriptionId}>An existing Cv result is available for this worksheet. Recalculate to review its inputs and replace the saved result.</p>
      <div className="excel-modal-actions"><button type="button" className="button button-primary" onClick={onView} autoFocus>View Existing Result</button><button type="button" className="button button-reset" onClick={onRecalculate}>Recalculate</button><button type="button" className="button button-reset" onClick={onCancel}>Cancel</button></div>
    </dialog>
  );
}
