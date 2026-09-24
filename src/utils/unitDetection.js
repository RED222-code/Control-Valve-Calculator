/** Normalize notation without changing the engineering meaning of a unit. */
export function normalizeUnitText(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/℃/g, 'c').replace(/℉/g, 'f').replace(/[°º]/g, '')
    .replace(/³/g, '3').replace(/₂/g, '2').replace(/₁/g, '1')
    .replace(/\bdeg(?:ree)?s?\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

const DEFINITIONS = [
  ['MMSCFD', 'flow', /\bmmscf(?:d|\/d(?:ay)?)\b/],
  ['SCFH', 'flow', /\bscf(?:h|\/h(?:r|our)?)\b/],
  ['SCFM', 'flow', /\bscf(?:m|\/min(?:ute)?)\b/],
  ['kbpd', 'flow', /\bkbpd\b/],
  ['bpd', 'flow', /\b(?:bpd|bbl\/d(?:ay)?)\b/],
  ['gpm', 'flow', /\b(?:gpm|gal\/min(?:ute)?)\b/],
  ['m3/hr', 'flow', /\bm3\s*\/\s*(?:hr|h|hour)\b/],
  ['ACFM', 'flow', /\bacfm\b/],
  ['bar(g)', 'pressure', /\bbar\s*\(\s*g\s*\)|\bbarg\b/],
  ['bar(a)', 'pressure', /\bbar\s*\(\s*a\s*\)|\bbara\b/],
  ['psig', 'pressure', /\bpsig\b|\bpsi\s*\(\s*g\s*\)/],
  ['psia', 'pressure', /\bpsia\b|\bpsi\s*\(\s*a\s*\)/],
  ['bar', 'pressure', /\bbar\b/],
  ['psi', 'pressure', /\bpsi\b/],
  ['kg/m3', 'density', /\bkg\s*\/\s*m3\b/],
  ['C', 'temperature', /(?:^|[\s([,:])c(?:elsius)?(?:$|[\s)\],;])/],
  ['F', 'temperature', /(?:^|[\s([,:])f(?:ahrenheit)?(?:$|[\s)\],;])/],
  ['K', 'temperature', /(?:^|[\s([,:])k(?:elvin)?(?:$|[\s)\],;])/],
];

export function detectUnits(value, kind = null) {
  const text = normalizeUnitText(value);
  const found = [];
  for (const [unit, category, pattern] of DEFINITIONS) {
    if ((!kind || category === kind) && pattern.test(text)) found.push(unit);
  }
  // The generic spelling is a substring of its explicit pressure reference.
  if (found.includes('bar(g)') || found.includes('bar(a)')) {
    const index = found.indexOf('bar');
    if (index !== -1) found.splice(index, 1);
  }
  if (found.includes('psig') || found.includes('psia')) {
    const index = found.indexOf('psi');
    if (index !== -1) found.splice(index, 1);
  }
  return [...new Set(found)];
}

export function stripUnitNotation(value) {
  let text = normalizeUnitText(value);
  for (const [, , pattern] of DEFINITIONS) text = text.replace(pattern, ' ');
  return text.replace(/\b(?:units?|dimensionless)\b/g, ' ').replace(/[()[\]{}°]/g, ' ');
}

export function pressureReference(unit) {
  if (unit === 'psig' || unit === 'bar(g)') return 'gauge';
  if (unit === 'psia' || unit === 'bar(a)') return 'absolute';
  return 'unspecified';
}
