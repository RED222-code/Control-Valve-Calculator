export default function ErrorMessage({ id, message }) {
  if (!message) return null;
  return <p id={id} className="field-error">{message}</p>;
}
