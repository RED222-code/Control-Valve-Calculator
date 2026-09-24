import { validateOperatingConditions } from '../utils/validation.js';

export function validateImportedData(data, service, temperatureUnit, importErrors) {
  if (!service) return importErrors;
  const checked = validateOperatingConditions(data, service, temperatureUnit);
  const applicableErrors = (fields) => service === 'liquid'
    ? Object.fromEntries(Object.entries(fields).filter(([field]) => ['Q', 'P1', 'P2', 'SG'].includes(field))) : fields;
  return Object.fromEntries(Object.entries(checked.errors).map(([condition, fields]) => [condition, {
    ...fields, ...applicableErrors(importErrors[condition]),
  }]));
}
