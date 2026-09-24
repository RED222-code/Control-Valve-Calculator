import * as XLSX from 'xlsx';
import { detectValveSheet } from './sheetDetector.js';

export const WORKBOOK_LIMITS = Object.freeze({ bytes: 10 * 1024 * 1024, sheets: 100, rows: 10000, columns: 256, cells: 200000 });
const EXTENSION = /\.(?:xlsx|xls|xlsm|xlsb)$/i;

export async function parseWorkbookFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Choose an Excel workbook.');
  validateFile(file.name, file.size);
  const buffer = await file.arrayBuffer();
  return parseWorkbook(buffer, file.name);
}

export function parseWorkbook(buffer, fileName = 'Workbook.xlsx') {
  const bytes = buffer instanceof ArrayBuffer ? buffer.byteLength : buffer?.byteLength;
  validateFile(fileName, bytes);
  const header = buffer instanceof ArrayBuffer ? new Uint8Array(buffer, 0, Math.min(8, bytes))
    : ArrayBuffer.isView(buffer) ? new Uint8Array(buffer.buffer, buffer.byteOffset, Math.min(8, bytes)) : null;
  const isZip = header && header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04;
  const cfbMagic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  const isCfb = header && cfbMagic.every((byte, index) => header[index] === byte);
  // SheetJS also accepts text, CSV, HTML, and other formats. Excel uploads must
  // have an actual ZIP workbook or legacy compound-file container signature.
  if (!isZip && !isCfb) throw new Error('This workbook could not be read. Choose a valid Excel file rather than renamed text or CSV.');
  let workbook;
  try {
    workbook = XLSX.read(buffer, {
      type: 'array', cellFormula: true, cellDates: false, cellNF: false,
      bookVBA: false, bookDeps: false, bookFiles: false, sheetRows: WORKBOOK_LIMITS.rows + 1,
    });
  } catch {
    throw new Error('This workbook could not be read. Choose a valid, unencrypted Excel file.');
  }
  if (!workbook.SheetNames?.length) throw new Error('This workbook does not contain any worksheets.');
  if (workbook.SheetNames.length > WORKBOOK_LIMITS.sheets) throw new Error(`Workbooks may contain at most ${WORKBOOK_LIMITS.sheets} worksheets.`);
  let cellCount = 0;
  for (const name of workbook.SheetNames) {
    const worksheet = workbook.Sheets[name];
    const rangeText = worksheet?.['!fullref'] ?? worksheet?.['!ref'];
    if (rangeText) {
      const range = XLSX.utils.decode_range(rangeText);
      if (range.e.r >= WORKBOOK_LIMITS.rows || range.e.c >= WORKBOOK_LIMITS.columns) {
        throw new Error(`Worksheet ${name} exceeds the supported ${WORKBOOK_LIMITS.rows} rows or ${WORKBOOK_LIMITS.columns} columns.`);
      }
    }
    for (const key of Object.keys(worksheet ?? {})) {
      if (!/^[A-Z]+[1-9]\d*$/.test(key)) continue;
      const coordinate = XLSX.utils.decode_cell(key);
      if (coordinate.r >= WORKBOOK_LIMITS.rows || coordinate.c >= WORKBOOK_LIMITS.columns) throw new Error(`Worksheet ${name} exceeds the supported size.`);
      cellCount += 1;
      if (cellCount > WORKBOOK_LIMITS.cells) throw new Error(`Workbooks may contain at most ${WORKBOOK_LIMITS.cells.toLocaleString('en-US')} populated cells.`);
    }
  }
  return {
    fileName, displayName: fileName.replace(EXTENSION, ''), workbook,
    sheets: workbook.SheetNames.map((name) => detectValveSheet(workbook.Sheets[name], name)), calculations: [],
  };
}

function validateFile(name, bytes) {
  if (typeof name !== 'string' || !EXTENSION.test(name)) throw new Error('Choose an .xlsx, .xls, .xlsm, or .xlsb Excel workbook.');
  if (!Number.isFinite(bytes) || bytes <= 0) throw new Error('The selected Excel file is empty or unreadable.');
  if (bytes > WORKBOOK_LIMITS.bytes) throw new Error('Choose an Excel workbook smaller than 10 MB.');
}
