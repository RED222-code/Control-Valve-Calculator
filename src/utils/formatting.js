const cvFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 3,
});

function format(value, formatter) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  if (magnitude > 0 && (magnitude < 0.001 || magnitude >= 1e7)) {
    return value.toExponential(3);
  }
  return formatter.format(Object.is(value, -0) ? 0 : value);
}

/** Display rounding only; calculations retain their full Number precision. */
export function formatCv(value) {
  return format(value, cvFormatter);
}

export function formatNumber(value) {
  return format(value, numberFormatter);
}
