import { parseNumericInput } from './validation.js';

const ABSOLUTE_ZERO_F = -459.67;

function isAboveAbsoluteZero(value, unit) {
  return value > (unit === 'K' ? 0 : unit === 'C' ? -273.15 : ABSOLUTE_ZERO_F);
}

/**
 * Convert one temperature input while preserving blank/malformed text for the
 * field validator. Temperatures remain reference metadata in the gas method.
 * Domain-changing precision loss is an error, so callers can keep the old unit.
 */
export function convertTemperatureInput(raw, fromUnit, toUnit) {
  if (!['C', 'F', 'K'].includes(fromUnit) || !['C', 'F', 'K'].includes(toUnit)) {
    throw new Error('Temperature unit must be C, F or K.');
  }

  const input = typeof raw === 'string' ? raw : String(raw ?? '');
  if (fromUnit === toUnit) return input;

  let value;
  try {
    value = parseNumericInput(raw, 'Temperature');
  } catch {
    return input;
  }

  let converted;
  if (fromUnit === 'C') {
    converted = toUnit === 'K' ? value + 273.15 : value / 5 * 9 + 32;
  } else if (toUnit === 'C') {
    converted = fromUnit === 'K' ? value - 273.15 : (value - 32) / 9 * 5;
  } else if (toUnit === 'K') {
    // Divide before multiplying to avoid unnecessary intermediate overflow.
    converted = (value - ABSOLUTE_ZERO_F) / 9 * 5;
  } else if (Math.abs(value) < 1) {
    // Near zero K, an offset from absolute zero avoids cancellation around 273.15.
    converted = value / 5 * 9 + ABSOLUTE_ZERO_F;
  } else {
    // Centering around the freezing point keeps common conversions readable.
    converted = (value - 273.15) / 5 * 9 + 32;
  }

  if (!Number.isFinite(converted)) {
    throw new Error('Temperature is outside the supported numerical range in the selected unit.');
  }

  const sourceIsValid = isAboveAbsoluteZero(value, fromUnit);
  if (isAboveAbsoluteZero(converted, toUnit) !== sourceIsValid) {
    throw new Error('Temperature is too close to absolute zero to represent accurately in the selected unit. Keep the current unit.');
  }

  // Remove ordinary binary arithmetic noise without rounding a valid value to
  // absolute zero. Retain the full available value when that precision matters.
  const rounded = Number(converted.toPrecision(15));
  const result = Number.isFinite(rounded) && isAboveAbsoluteZero(rounded, toUnit) === sourceIsValid
    ? rounded
    : converted;
  return String(Object.is(result, -0) ? 0 : result);
}
