import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseWorkbook, parseWorkbookFile, WORKBOOK_LIMITS } from '../src/importers/workbookParser.js';
import { numericCellValue } from '../src/importers/fieldMapper.js';
import { detectUnits } from '../src/utils/unitDetection.js';
import { convertFlow, convertPressure, convertTemperature } from '../src/utils/unitConversion.js';
import { templateSheet } from './template-fixture.js';

const sheet = (rows) => XLSX.utils.aoa_to_sheet(rows);

function workbookBytes(sheets) {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, worksheet]) => XLSX.utils.book_append_sheet(workbook, worksheet, name));
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
}

function closeTo(actual, expected) {
  assert.ok(Math.abs(Number(actual) - expected) <= Math.abs(expected) * 1e-10, `${actual} ≈ ${expected}`);
}

test('workbook upload inspects all sheets, retains original filename, and performs no calculations', async () => {
  const bytes = workbookBytes({ Cover: sheet([['Cover']]), 'XX-PCV-YYY': templateSheet() });
  const result = await parseWorkbookFile(new File([bytes], 'Project_Rev03.XLSX'));
  assert.equal(result.fileName, 'Project_Rev03.XLSX');
  assert.equal(result.displayName, 'Project_Rev03');
  assert.equal(result.sheets.length, 2);
  assert.equal(result.sheets[0].relevant, false);
  assert.equal(result.sheets[1].relevant, true);
  assert.equal(result.sheets[1].service, 'gas');
  assert.equal(result.sheets[1].status, 'unprocessed');
  assert.deepEqual(result.calculations, []);
  assert.ok(result.workbook.Sheets['XX-PCV-YYY']);
});

test('file validation rejects unsupported, empty, corrupt, and oversized workbooks before processing', async () => {
  const bytes = workbookBytes({ Valve: templateSheet() });
  assert.throws(() => parseWorkbook(bytes, 'test.csv'), /Choose an/);
  assert.throws(() => parseWorkbook(new ArrayBuffer(0), 'test.xlsx'), /empty/);
  assert.throws(() => parseWorkbook(new Uint8Array([1, 2, 3, 4]), 'test.xlsx'), /could not be read/);
  assert.throws(() => parseWorkbook(new TextEncoder().encode('Parameter,Minimum,Normal,Maximum\nFlow,1,2,3'), 'renamed.xlsx'), /renamed text or CSV/);
  let read = false;
  await assert.rejects(parseWorkbookFile({ name: 'test.xlsx', size: WORKBOOK_LIMITS.bytes + 1, arrayBuffer: async () => { read = true; return bytes; } }), /smaller than 10 MB/);
  assert.equal(read, false);
});

test('worksheet dimensions and workbook sheet counts are bounded', () => {
  const sparse = { A1: { t: 's', v: 'Flow' }, A10001: { t: 'n', v: 1 }, '!ref': 'A1:A10001' };
  assert.throws(() => parseWorkbook(workbookBytes({ TooTall: sparse })), /exceeds the supported/);
  const manySheets = Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`Sheet${index}`, sheet([['Cover']])]));
  assert.throws(() => parseWorkbook(workbookBytes(manySheets)), /at most 100 worksheets/);
});

test('numeric extraction rejects ranges, arbitrary annotations, decimal commas, errors, and underflow', () => {
  for (const [source, expected] of [['1,000', 1000], ['1e3 SCFM', 1000], ['27°C', 27], ['-.25', -0.25], [0, 0]]) assert.equal(numericCellValue(source), expected);
  for (const source of ['1,2', '10-20', '10 estimated', '1e', '1e-999', '1---', '1%', '1 2', Infinity, NaN, true, {}, new Date()]) assert.equal(numericCellValue(source), null, String(source));
});

test('unit detection distinguishes pressure references and trusted conversions retain precision', () => {
  assert.deepEqual(detectUnits('bar(g)'), ['bar(g)']);
  assert.deepEqual(detectUnits('P1 psi(a)'), ['psia']);
  assert.deepEqual(detectUnits('m³/hr'), ['m3/hr']);
  closeTo(convertFlow(1, 'kbpd', 'liquid'), 42000 / 1440);
  closeTo(convertPressure(1, 'bar'), 14.503773773022);
  assert.equal(convertTemperature(20, 'C', 'F'), 68);
  assert.equal(convertTemperature(32, 'F', 'K'), 273.15);
  assert.throws(() => convertFlow(1, 'gpm', 'gas'), /cannot be converted/);
  assert.throws(() => convertFlow(1, 'toString', 'liquid'), /cannot be converted/);
  assert.throws(() => convertPressure(1e308, 'bar'), /numerical range/);
  assert.throws(() => convertTemperature(1e-100, 'K', 'F'), /absolute zero/);
  assert.equal(convertTemperature(-273.15, 'C', 'F'), -459.67);
  assert.ok(convertTemperature(-273.15 + Number.EPSILON * 512, 'C', 'F') > -459.67);
});
