import { CONDITIONS, INPUT_ROWS } from '../data/serviceConfig.js';
import { formatCv } from './formatting.js';

const SPREADSHEET_EXTENSION = /\.(xlsx|xlsm|xlsb|xls)$/i;
const UNSAFE_FILENAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001F\u007F]/g;
const BIDI_CONTROL_CHARACTERS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const SERVICES = new Set(['liquid', 'gas']);

function cvFor(results, key) {
  return results?.[key]?.cv ?? results?.[`${key}Cv`];
}

function cleanLabel(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function sanitizeFilename(value, fallback = 'control-valve-cv-result') {
  const cleaned = cleanLabel(value)
    .normalize('NFKC')
    .replace(UNSAFE_FILENAME_CHARACTERS, ' ')
    .replace(BIDI_CONTROL_CHARACTERS, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[. -]+|[. -]+$/g, '')
    .slice(0, 120);
  return cleaned || fallback;
}

export function createResultExportModel({ service, results, inputs, units = {}, temperatureUnit = 'F', workbookName = '', sheetName = '' }) {
  if (!SERVICES.has(service)) {
    throw new Error('The result service must be either liquid or gas.');
  }
  const values = CONDITIONS.map(({ key, label }) => ({
    key,
    label,
    numericValue: cvFor(results, key),
  }));

  if (values.some(({ numericValue }) => !Number.isFinite(numericValue))) {
    throw new Error('Complete calculation results are required before downloading a file.');
  }

  const maximumValue = Math.max(...values.map(({ numericValue }) => numericValue));
  const governingLabels = values
    .filter(({ numericValue }) => numericValue === maximumValue)
    .map(({ label }) => label);
  const cleanWorkbookName = cleanLabel(workbookName).replace(SPREADSHEET_EXTENSION, '');
  const cleanSheetName = cleanLabel(sheetName);
  const imported = Boolean(cleanSheetName);

  return {
    title: 'Control Valve Sizing Calculation Result',
    serviceLabel: service === 'gas' ? 'Gas' : 'Liquid',
    sourceLabel: imported ? 'Excel worksheet' : 'Manual entry',
    workbookName: cleanWorkbookName,
    sheetName: cleanSheetName,
    operatingConditions: inputs ? INPUT_ROWS.filter(row => !row.gasOnly || service === 'gas').map(row => ({
      label: service === 'gas' ? row.gasLabel || row.label : row.label,
      unit: row.key === 'Q' ? units.flow || (service === 'gas' ? 'SCFM' : 'gpm')
        : ['P1', 'P2', 'deltaP'].includes(row.key) ? units.pressure || 'psi'
          : row.key === 'T' ? temperatureUnit : '-',
      values: CONDITIONS.map(({ key }) => row.key === 'deltaP'
        ? String(Number((Number(inputs[key]?.P1) - Number(inputs[key]?.P2)).toPrecision(10)))
        : String(inputs[key]?.[row.key] ?? '')),
    })) : [],
    values: values.map(({ key, label, numericValue }) => ({
      key,
      label: `${label} Cv`,
      value: formatCv(numericValue),
    })),
    maximumValue: formatCv(maximumValue),
    governingText: `${governingLabels.join(', ')} ${governingLabels.length === 1 ? 'condition governs' : 'conditions govern'}`,
    filename: sanitizeFilename(imported
      ? `${cleanWorkbookName || 'workbook'}-${cleanSheetName}-cv-result`
      : `control-valve-${service === 'gas' ? 'gas' : 'liquid'}-cv-result`),
  };
}

export function createWorkbookExportModel({ workbookName = '', calculations }) {
  if (!Array.isArray(calculations) || calculations.length === 0) {
    throw new Error('At least one completed worksheet result is required before downloading a workbook file.');
  }
  if (calculations.length > 100) {
    throw new Error('A workbook export cannot contain more than 100 worksheet results.');
  }

  const cleanWorkbookName = cleanLabel(workbookName).replace(SPREADSHEET_EXTENSION, '');
  const sheetNames = new Set();
  const sheets = calculations.map((calculation) => {
    const sheetName = cleanLabel(calculation?.sheetName);
    if (!sheetName) {
      throw new Error('Every workbook result must include a worksheet name.');
    }
    const normalizedSheetName = sheetName.toLocaleLowerCase();
    if (sheetNames.has(normalizedSheetName)) {
      throw new Error(`The workbook export contains a duplicate worksheet result: ${sheetName}.`);
    }
    sheetNames.add(normalizedSheetName);
    return createResultExportModel({
      service: calculation.service,
      results: calculation.results,
      inputs: calculation.inputs,
      units: calculation.units,
      temperatureUnit: calculation.temperatureUnit,
      workbookName: cleanWorkbookName,
      sheetName,
    });
  });

  return {
    title: 'Control Valve Sizing Workbook Results',
    workbookName: cleanWorkbookName || 'Workbook',
    sheets,
    filename: sanitizeFilename(`${cleanWorkbookName || 'workbook'}-control-valve-results`),
  };
}
