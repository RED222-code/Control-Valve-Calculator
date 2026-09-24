// NIST SP 811: US gallon = 0.003785411784 m³; oil barrel = 42 US gallons;
// psi = 6894.757293168 Pa. Standard gas-volume units share the same basis.
import { convertTemperatureInput } from './temperature.js';
const PSI_PER_BAR = 100000 / 6894.757293168;
const GPM_PER_M3_HOUR = 1 / (0.003785411784 * 60);

export function convertFlow(value, unit, service) {
  assertNumeric(value);
  const factors = service === 'liquid'
    ? { gpm: 1, 'm3/hr': GPM_PER_M3_HOUR, bpd: 42 / 1440, kbpd: 42000 / 1440 }
    : service === 'gas' ? { SCFM: 1, SCFH: 1 / 60, MMSCFD: 1000000 / 1440 } : {};
  if (!Object.hasOwn(factors, unit)) {
    throw new Error(service === 'gas' && (unit === 'm3/hr' || unit === 'ACFM')
      ? 'Actual-volume gas flow requires standard reference conditions; enter SCFM manually.'
      : `Flow unit ${unit || '(missing)'} cannot be converted for ${service || 'unknown'} service.`);
  }
  return checked(value * factors[unit], value);
}

export function convertPressure(value, unit) {
  assertNumeric(value);
  if (['psi', 'psig', 'psia'].includes(unit)) return checked(value, value);
  if (['bar', 'bar(g)', 'bar(a)'].includes(unit)) return checked(value * PSI_PER_BAR, value);
  throw new Error(`Pressure unit ${unit || '(missing)'} is unsupported; enter psi manually.`);
}

export function convertTemperature(value, sourceUnit, targetUnit = 'F') {
  assertNumeric(value);
  if (!['C', 'F', 'K'].includes(sourceUnit) || !['F', 'K'].includes(targetUnit)) {
    throw new Error('Temperature units could not be determined; enter °F or K manually.');
  }
  if (sourceUnit === targetUnit) return checked(value, value);
  if (sourceUnit !== 'C') return Number(convertTemperatureInput(value, sourceUnit, targetUnit));
  const offsetFromAbsoluteZero = value + 273.15;
  const converted = checked(targetUnit === 'K' ? offsetFromAbsoluteZero
    : Math.abs(offsetFromAbsoluteZero) < 1 ? offsetFromAbsoluteZero / 5 * 9 - 459.67
      : value / 5 * 9 + 32, value, false);
  const sourceIsValid = value > -273.15;
  const targetIsValid = (number) => number > (targetUnit === 'K' ? 0 : -459.67);
  if (sourceIsValid !== targetIsValid(converted)) throw new Error('Temperature is too close to absolute zero to convert accurately; enter it manually in the original unit.');
  const rounded = Number(converted.toPrecision(15));
  return Number.isFinite(rounded) && sourceIsValid === targetIsValid(rounded) ? rounded : converted;
}

function assertNumeric(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Value must be a finite number.');
}

function checked(converted, original, rejectUnderflow = true) {
  if (!Number.isFinite(converted) || (rejectUnderflow && converted === 0 && original !== 0)) {
    throw new Error('Converted value is outside the supported numerical range.');
  }
  return Object.is(converted, -0) ? 0 : converted;
}
