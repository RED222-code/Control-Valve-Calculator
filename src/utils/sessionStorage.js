import { FLOW_UNITS, PRESSURE_UNITS } from './displayUnits.js';
const KEY = 'controlValveSizingSession';
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const serviceValid = value => ['liquid', 'gas'].includes(value);
const conditions = ['minimum', 'normal', 'maximum'];

function inputsValid(data) {
  return isObject(data) && conditions.every(key => isObject(data[key]) &&
    ['Q', 'P1', 'P2', 'SG', 'Y', 'Z', 'T'].every(field => typeof data[key][field] === 'string'));
}

function sessionValid(session) {
  return isObject(session) && inputsValid(session.data) && isObject(session.errors) &&
    (session.units === undefined || (isObject(session.units) &&
      (session.units.pressure === undefined || Object.hasOwn(PRESSURE_UNITS, session.units.pressure)) &&
      (session.units.flow === undefined || Object.hasOwn(FLOW_UNITS.gas, session.units.flow) || Object.hasOwn(FLOW_UNITS.liquid, session.units.flow)))) &&
    ['C', 'F', 'K'].includes(session.temperatureUnit) && typeof session.submitted === 'boolean' &&
    (session.feedback === null || (isObject(session.feedback) && typeof session.feedback.text === 'string')) &&
    (session.results === null || conditions.every(key => Number.isFinite(session.results?.[key]?.cv)));
}

function importedValid(value) {
  return isObject(value) && typeof value.sheetName === 'string' && inputsValid(value.data) &&
    (value.service === null || serviceValid(value.service)) && Array.isArray(value.summary) && Array.isArray(value.warnings);
}

function valid(data) {
  if (!isObject(data) || !serviceValid(data.service) || !serviceValid(data.manualService) ||
      !['manual', 'excel'].includes(data.inputSource) || !sessionValid(data.sessions?.gas) ||
      !sessionValid(data.sessions?.liquid) || !isObject(data.workbook)) return false;
  const { workbookSession: book, currentSheetName, pendingImport } = data.workbook;
  if (book === null) return currentSheetName === null && pendingImport === null;
  if (!isObject(book) || typeof book.fileName !== 'string' || typeof book.displayName !== 'string' ||
      !Array.isArray(book.sheets) || book.sheets.length > 100 || !Array.isArray(book.calculations) ||
      !isObject(book.drafts) || !isObject(book.parsedSheets) || 'workbook' in book) return false;
  const names = new Set();
  for (const sheet of book.sheets) {
    if (!isObject(sheet) || typeof sheet.name !== 'string' || names.has(sheet.name) ||
        typeof sheet.relevant !== 'boolean' || !['unprocessed', 'loaded', 'calculated'].includes(sheet.status)) return false;
    names.add(sheet.name);
    if (sheet.relevant) {
      const parsed = book.parsedSheets[sheet.name];
      if (!isObject(parsed) || !(typeof parsed.error === 'string' || importedValid(parsed.initial))) return false;
      if (parsed.initial?.service === null && (!importedValid(parsed.gas) || !importedValid(parsed.liquid))) return false;
    }
  }
  if (!Object.entries(book.drafts).every(([name, draft]) => names.has(name) && draft?.sheetName === name &&
      serviceValid(draft.service) && sessionValid(draft.session) && importedValid(draft.importData))) return false;
  if (!book.calculations.every(item => isObject(item) && names.has(item.sheetName) && typeof item.id === 'string' &&
      serviceValid(item.service) && inputsValid(item.inputs) && importedValid(item.importData) &&
      ['minimumCv', 'normalCv', 'maximumCv', 'maximumCalculatedCv'].every(key => Number.isFinite(item.results?.[key])))) return false;
  return (currentSheetName === null || Object.hasOwn(book.drafts, currentSheetName)) &&
    (pendingImport === null || importedValid(pendingImport));
}

export function clearSession() {
  try { localStorage.removeItem(KEY); return true; } catch { return false; }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !valid(saved.data)) throw new Error('Invalid session');
    return saved.data;
  } catch { clearSession(); return null; }
}

export function saveSession(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), data }));
    return true;
  } catch { return false; }
}
