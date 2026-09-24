import { worksheetRows, identifyMetadata, findServiceSection, collectFieldCandidates, numericCellValue } from './fieldMapper.js';

export function detectValveSheet(worksheet, name) {
  const rows = worksheetRows(worksheet);
  const section = findServiceSection(rows);
  const relevant = Boolean(section && ['fluidState', 'flowRate', 'upstreamPressure'].every((key) => section.fields.has(key)));
  const metadata = relevant ? identifyMetadata(rows, name) : { valveTag: '', description: '', fluidState: '', service: null };
  const usefulProcessData = relevant && collectFieldCandidates(rows).some(({ cell }) => numericCellValue(cell.value) !== null);
  return {
    name, ...metadata, relevant, usefulProcessData, status: 'unprocessed',
    ...(!relevant ? { reason: 'Not a control-valve sheet with the required SERVICE DATA labels.' }
      : !usefulProcessData ? { reason: 'Control-valve sheet; operating values need review or manual entry.' } : {}),
  };
}
