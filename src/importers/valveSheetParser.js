import { createEmptyData } from '../data/serviceConfig.js';
import { detectUnits, pressureReference } from '../utils/unitDetection.js';
import { convertFlow, convertPressure, convertTemperature } from '../utils/unitConversion.js';
import { CONDITIONS, FIELD_DEFINITIONS, worksheetRows, findServiceSection, readServiceData, collectFieldCandidates, identifyMetadata, numericCellValue } from './fieldMapper.js';
import { validateImportedData } from './importValidator.js';

export function parseValveSheet(worksheet, sheetName, serviceOverride = null) {
  if (serviceOverride !== null && !['liquid', 'gas'].includes(serviceOverride)) throw new Error('Service must be Gas or Liquid.');
  const rows = worksheetRows(worksheet);
  const section = findServiceSection(rows);
  if (!section || !['fluidState', 'flowRate', 'upstreamPressure'].every((key) => section.fields.has(key))) {
    throw new Error('This worksheet does not match the control-valve SERVICE DATA template.');
  }
  const metadata = identifyMetadata(rows, sheetName);
  const service = serviceOverride ?? metadata.service;
  const serviceData = readServiceData(rows);
  const candidates = collectFieldCandidates(rows);
  const warnings = [];
  const data = createEmptyData();
  const errors = Object.fromEntries(CONDITIONS.map((condition) => [condition, {}]));
  const refs = Object.fromEntries(CONDITIONS.map((condition) => [condition, {}]));
  const allTemperatureUnits = candidates.filter(({ field }) => field.field === 'T')
    .flatMap(({ unitSources }) => unitSources.flatMap((source) => detectUnits(source, 'temperature')));
  const temperatureUnit = allTemperatureUnits.length && allTemperatureUnits.every((unit) => unit === 'K') ? 'K' : 'F';
  if (!service) warnings.push('Service type could not be determined. Select Gas or Liquid before importing flow values.');
  if (candidates.some(({ cell }) => cell.formula)) warnings.push('Cached Excel formula values were imported. Formulas are not recalculated in the browser; review these values.');

  const summaries = new Map();
  for (const definition of FIELD_DEFINITIONS) {
    summaries.set(definition.field, { field: definition.field, label: definition.label, found: false, missingConditions: [], detectedUnits: [], messages: [] });
    for (const condition of CONDITIONS) {
      const matching = candidates.filter((candidate) => candidate.field.field === definition.field && candidate.condition === condition);
      const summary = summaries.get(definition.field);
      const unitSets = matching.map(({ unitSources }) => [...new Set(unitSources.flatMap((source) => detectUnits(source, definition.kind === 'dimensionless' ? null : definition.kind)))]);
      summary.detectedUnits.push(...unitSets.flat());
      let message = '';
      if (!matching.length) message = `${definition.label} not found for ${condition}.`;
      else if (matching.length > 1) message = `Multiple ${definition.label.toLowerCase()} values found for ${condition}; enter the correct value manually.`;
      else {
        const numeric = numericCellValue(matching[0].cell.value);
        const units = unitSets[0];
        if (numeric === null) message = `${definition.label} for ${condition} is missing or is not an unambiguous number.`;
        else if (definition.field === 'density') {
          summary.found = true;
          summary.messages.push(`Density detected for ${condition}; specific gravity is not inferred from density.`);
          continue;
        } else if (definition.kind === 'dimensionless' && (units.length || matching[0].unitAnnotations?.some((unit) => typeof unit === 'string' && !/^(?:\s*|[-—–]|dimensionless|none|n\/a)$/i.test(unit.trim())))) {
          message = `${definition.label} must be dimensionless; review its source units and enter the value manually.`;
        } else if (definition.kind !== 'dimensionless' && units.length !== 1) {
          message = units.length
            ? `${definition.label} has ambiguous units (${units.join(', ')}) for ${condition}; enter the value manually.`
            : `${definition.label} units not found or unsupported for ${condition}; enter the value with the calculator unit.`;
        } else {
          try {
            let converted = numeric;
            if (definition.field === 'Q') converted = convertFlow(numeric, units[0], service);
            if (definition.field === 'P1' || definition.field === 'P2') {
              converted = convertPressure(numeric, units[0]);
              refs[condition][definition.field] = pressureReference(units[0]);
            }
            if (definition.field === 'T') converted = convertTemperature(numeric, units[0], temperatureUnit);
            data[condition][definition.field] = String(converted);
            summary.found = true;
            const target = definition.kind === 'flow' ? service === 'gas' ? 'SCFM' : 'gpm'
              : definition.kind === 'pressure' ? 'psi' : definition.kind === 'temperature' ? temperatureUnit === 'F' ? '°F' : 'K' : null;
            if (target) summary.messages.push(`${condition}: ${numeric} ${units[0]} → ${converted} ${target}${definition.kind === 'pressure' ? ` (${pressureReference(units[0])} reference)` : ''}.`);
          } catch (error) { message = error.message; }
        }
      }
      if (message) {
        if (definition.field === 'density') continue;
        summary.missingConditions.push(condition);
        summary.messages.push(message);
        if (definition.field !== 'density') errors[condition][definition.field] = message;
      }
    }
  }

  for (const condition of CONDITIONS) {
    const first = refs[condition].P1;
    const second = refs[condition].P2;
    if (first && second && first !== second) {
      const message = `Pressure references differ for ${condition} (${first} inlet, ${second} outlet). Enter both pressures on the same gauge or absolute basis.`;
      warnings.push(message);
      for (const field of ['P1', 'P2']) {
        data[condition][field] = '';
        errors[condition][field] = message;
        const summary = summaries.get(field);
        summary.missingConditions.push(condition);
        summary.messages.push(message);
      }
    } else if (first === 'unspecified' || second === 'unspecified') {
      warnings.push(`Pressure reference is unspecified for ${condition}. Confirm inlet and outlet pressures use the same gauge or absolute basis.`);
    }
  }

  const relevantDefinitions = service === 'liquid'
    ? FIELD_DEFINITIONS.filter(({ field }) => ['Q', 'P1', 'P2', 'SG', 'density'].includes(field))
    : FIELD_DEFINITIONS;
  const summary = relevantDefinitions.filter(({ field }) => field !== 'density' || summaries.get(field).found).map(({ field }) => {
    const item = summaries.get(field);
    const missingConditions = [...new Set(item.missingConditions)];
    const found = field === 'density' ? item.found : CONDITIONS.some((condition) => data[condition][field] !== '');
    return {
      field, label: item.label, found, missingConditions,
      detectedUnits: [...new Set(item.detectedUnits)],
      message: item.messages.length ? [...new Set(item.messages)].join(' ') : `${item.label} imported for all operating conditions.`,
    };
  });
  return { sheetName, service, serviceData, data, temperatureUnit, summary, warnings: [...new Set(warnings)], errors: validateImportedData(data, service, temperatureUnit, errors) };
}
