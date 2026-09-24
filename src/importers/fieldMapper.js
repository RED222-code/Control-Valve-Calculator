import { stripUnitNotation, detectUnits } from '../utils/unitDetection.js';

export const CONDITIONS = ['minimum', 'normal', 'maximum'];
const VALUE_COLUMNS = { minimum: 14, normal: 15, maximum: 16 };
const UNIT_COLUMN = 17;

// SERVICE DATA labels can move between rows; the value columns are fixed.
export const SERVICE_FIELDS = [
  { key: 'fluidName', aliases: ['fluid name'] },
  { key: 'fluidState', aliases: ['fluid state'] },
  { key: 'designPressure', aliases: ['design pressure'] },
  { key: 'designTemperature', aliases: ['design temp', 'design temperature'] },
  { key: 'flowRate', aliases: ['flow rate', 'gas flow rate', 'liquid flow rate'] },
  { key: 'vapourPressure', aliases: ['vapour pressure', 'vapor pressure'] },
  { key: 'upstreamPressure', aliases: ['upstream press', 'upstream pressure', 'inlet pressure'] },
  { key: 'downstreamPressure', aliases: ['downstream presssure', 'downstream press', 'downstream pressure', 'outlet pressure'] },
  { key: 'differentialPressure', aliases: ['diff pressure', 'differential pressure', 'pressure drop'] },
  { key: 'temperature', aliases: ['temperature', 'operating temperature'] },
  { key: 'criticalPressure', aliases: ['critical pressure'] },
  { key: 'criticalTemperature', aliases: ['critical temp', 'critical temperature'] },
  { key: 'viscosity', aliases: ['viscosity'] },
  { key: 'density', aliases: ['density'] },
  { key: 'molecularWeight', aliases: ['molecular weight'] },
  { key: 'expansionFactor', aliases: ['expansion factor', 'y factor'] },
  { key: 'heatCapacityRatio', aliases: ['cp cv', 'heat capacity ratio'] },
  // Optional rows in some revisions can populate the calculator directly.
  { key: 'specificGravity', aliases: ['specific gravity', 'specific grav', 'gas specific gravity', 'liquid specific gravity'] },
  { key: 'compressibilityFactor', aliases: ['compressibility factor', 'z factor'] },
];

// Density and Cp/Cv in this sheet do not supply SG or compressibility Z.
export const FIELD_DEFINITIONS = [
  { field: 'Q', serviceKey: 'flowRate', label: 'Flow rate', kind: 'flow' },
  { field: 'P1', serviceKey: 'upstreamPressure', label: 'Upstream pressure', kind: 'pressure' },
  { field: 'P2', serviceKey: 'downstreamPressure', label: 'Downstream pressure', kind: 'pressure' },
  { field: 'SG', serviceKey: 'specificGravity', label: 'Specific gravity', kind: 'dimensionless' },
  { field: 'T', serviceKey: 'temperature', label: 'Temperature', kind: 'temperature' },
  { field: 'Z', serviceKey: 'compressibilityFactor', label: 'Compressibility factor', kind: 'dimensionless' },
  { field: 'Y', serviceKey: 'expansionFactor', label: 'Expansion factor', kind: 'dimensionless' },
  { field: 'density', serviceKey: 'density', label: 'Density', kind: 'density' },
];

export function normalizeLabel(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().trim()
    .replace(/[_.,:;()[\]{}\/\\–—-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function serviceFieldFor(value) {
  const label = normalizeLabel(value);
  return SERVICE_FIELDS.find(({ aliases }) => aliases.includes(label)) ?? null;
}

/** Read actual cells, never allocate a matrix from an untrusted !ref range. */
export function worksheetRows(worksheet) {
  const rows = new Map();
  for (const [address, cell] of Object.entries(worksheet ?? {})) {
    const match = /^([A-Z]+)([1-9]\d*)$/.exec(address);
    if (!match || !cell || cell.t === 'e' || cell.v === undefined || cell.v === null) continue;
    const row = Number(match[2]) - 1;
    const column = [...match[1]].reduce((number, letter) => number * 26 + letter.charCodeAt(0) - 64, 0) - 1;
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row).push({ column, value: cell.v, formula: Boolean(cell.f), address });
  }
  return [...rows.entries()].sort(([a], [b]) => a - b)
    .map(([index, cells]) => ({ index, cells: cells.sort((a, b) => a.column - b.column) }));
}

const cellAt = (row, column) => row.cells.find((cell) => cell.column === column);

export function findServiceSection(rows) {
  const hasControlValve = rows.some((row) => normalizeLabel(cellAt(row, 0)?.value) === 'control valve');
  const heading = rows.find((row) => normalizeLabel(cellAt(row, 0)?.value) === 'service data');
  if (!hasControlValve || !heading) return null;
  const fields = new Map();
  for (const row of rows) {
    if (row.index <= heading.index || row.index > heading.index + 40) continue;
    // The next merged heading in A starts a different section.
    const sectionHeading = cellAt(row, 0)?.value;
    if (sectionHeading !== undefined && String(sectionHeading).trim()) break;
    const labelCell = cellAt(row, 1);
    const definition = serviceFieldFor(labelCell?.value);
    if (!definition) continue;
    if (!fields.has(definition.key)) fields.set(definition.key, []);
    fields.get(definition.key).push({ row, labelCell });
  }
  return { headingRow: heading.index, fields };
}

function serviceIn(value) {
  const text = normalizeLabel(value);
  const gas = /\b(?:gas|vapor|vapour)\b/.test(text);
  const liquid = /\bliquid\b/.test(text);
  return gas !== liquid ? (gas ? 'gas' : 'liquid') : null;
}

export function identifyMetadata(rows, sheetName = '') {
  const section = findServiceSection(rows);
  const states = section?.fields.get('fluidState') ?? [];
  const stateValues = states.flatMap(({ row }) => Object.values(VALUE_COLUMNS).map((column) => cellAt(row, column)?.value))
    .filter((value) => value !== undefined && String(value).trim());
  const services = new Set(stateValues.map(serviceIn).filter(Boolean));
  const fluidState = stateValues.length ? String(stateValues[0]).slice(0, 200) : '';
  let valveTag = '', description = '';
  for (const row of rows) {
    if (section && row.index >= section.headingRow) break;
    for (const cell of row.cells) {
      const label = normalizeLabel(cell.value);
      if (!['tag', 'tag no', 'tag number', 'valve tag', 'description', 'service description'].includes(label)) continue;
      const value = row.cells.find((other) => other.column > cell.column && String(other.value).trim() && String(other.value).trim() !== ':')?.value;
      if (value === undefined) continue;
      if (label.includes('tag')) valveTag ||= String(value).slice(0, 200);
      else description ||= String(value).slice(0, 300);
    }
  }
  if (!valveTag && /(?:^|[-\s])(?:[fphtl]cv|[fphtl]v)[-\s]?\d+/i.test(sheetName)) valveTag = sheetName.trim();
  return { valveTag, description, fluidState, service: states.length === 1 && services.size === 1 ? [...services][0] : null };
}

function normalizedServiceValue(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return numericCellValue(value) ?? (typeof value === 'string' ? value.trim() : value);
}

export function readServiceData(rows) {
  const section = findServiceSection(rows);
  if (!section) return {};
  return Object.fromEntries(SERVICE_FIELDS.map(({ key }) => {
    const entries = section.fields.get(key) ?? [];
    if (entries.length !== 1) return [key, null];
    const { row } = entries[0];
    return [key, {
      row: row.index + 1,
      minimum: normalizedServiceValue(cellAt(row, VALUE_COLUMNS.minimum)?.value),
      normal: normalizedServiceValue(cellAt(row, VALUE_COLUMNS.normal)?.value),
      maximum: normalizedServiceValue(cellAt(row, VALUE_COLUMNS.maximum)?.value),
      unit: String(cellAt(row, UNIT_COLUMN)?.value ?? '').trim(),
    }];
  }));
}

export function collectFieldCandidates(rows) {
  const section = findServiceSection(rows);
  if (!section) return [];
  return FIELD_DEFINITIONS.flatMap((field) => (section.fields.get(field.serviceKey) ?? []).flatMap(({ row, labelCell }) => {
    const unit = cellAt(row, UNIT_COLUMN)?.value ?? '';
    return CONDITIONS.flatMap((condition) => {
      const cell = cellAt(row, VALUE_COLUMNS[condition]);
      return cell ? [{ field, condition, cell, unitSources: [labelCell.value, unit, cell.value], unitAnnotations: [unit] }] : [];
    });
  }));
}

export function numericCellValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  // Comma thousands grouping is accepted only when unambiguous; comma decimals
  // and ranges remain unmapped. Units may follow an otherwise strict number.
  const text = value.trim();
  const match = /^([+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(?:\s*(.+))?$/.exec(text);
  if (!match || (match[2] && (!detectUnits(match[2]).length || normalizeLabel(stripUnitNotation(match[2])) !== ''))) return null;
  const number = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(number) || (number === 0 && /[1-9]/.test(match[1].split(/[eE]/)[0]))) return null;
  return Object.is(number, -0) ? 0 : number;
}
