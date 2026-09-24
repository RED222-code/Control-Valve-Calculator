import { unitFactor, convertInputUnit } from './displayUnits.js';
export const OPERATING_CONDITIONS = ['minimum', 'normal', 'maximum'];

const FIELD_LABELS = {
  Q: 'Flow rate',
  P1: 'Upstream pressure',
  P2: 'Downstream pressure',
  SG: 'Specific gravity',
  Y: 'Expansion factor Y',
  Z: 'Compressibility factor Z',
  T: 'Temperature',
};

const LIQUID_FIELDS = ['Q', 'P1', 'P2', 'SG'];
const GAS_FIELDS = [...LIQUID_FIELDS, 'Y', 'Z', 'T'];
const DECIMAL_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/** Accept ordinary/scientific decimal input, never partial parses or hex. */
export function parseNumericInput(raw, label = 'Value') {
  if (raw === null || raw === undefined || (typeof raw === 'string' && !raw.trim())) {
    throw new Error(`${label} is required.`);
  }

  if (typeof raw !== 'number' && typeof raw !== 'string') {
    throw new Error(`${label} must be a valid number.`);
  }

  const text = String(raw).trim();
  if (!DECIMAL_NUMBER.test(text)) {
    throw new Error(`${label} must be a valid number (for example, 12.5 or 1e3).`);
  }

  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number within the supported range.`);
  }
  // Detect nonzero decimal input that Number() would silently round to zero.
  const significand = text.split(/[eE]/)[0];
  if (value === 0 && /[1-9]/.test(significand)) {
    throw new Error(`${label} is too small for the supported numerical range.`);
  }

  return Object.is(value, -0) ? 0 : value;
}

/**
 * Validate all columns independently and collect field-level messages.
 * T is required gas metadata, not a factor in the simplified gas equation.
 * Parsed values must only be calculated when their condition has no errors.
 */
export function validateOperatingConditions(data, service, temperatureUnit = 'F', units = {}) {
  if (service !== 'liquid' && service !== 'gas') {
    throw new Error('Service must be liquid or gas.');
  }
  if (!['C', 'F', 'K'].includes(temperatureUnit)) {
    throw new Error('Temperature unit must be C, F or K.');
  }

  const fields = service === 'gas' ? GAS_FIELDS : LIQUID_FIELDS;
  const values = {};
  const errors = {};

  for (const condition of OPERATING_CONDITIONS) {
    values[condition] = Object.fromEntries(GAS_FIELDS.map((field) => [field, undefined]));
    errors[condition] = {};
    const source = data?.[condition] ?? {};
    const parsed = values[condition];
    const fieldErrors = errors[condition];

    for (const field of fields) {
      const label = field === 'SG' && service === 'gas' ? 'Gas specific gravity' : FIELD_LABELS[field];
      try {
        parsed[field] = parseNumericInput(source[field], label);
        if (field === 'Q' || field === 'P1' || field === 'P2') {
          const unit = field === 'Q' ? units.flow ?? (service === 'gas' ? 'SCFM' : 'gpm') : units.pressure ?? 'psi';
          parsed[field] = convertInputUnit(parsed[field], unitFactor(field, unit, service));
        }
      } catch (error) {
        fieldErrors[field] = error.message;
      }
    }

    if (parsed.Q !== undefined && parsed.Q < 0) {
      fieldErrors.Q = 'Flow rate cannot be negative.';
    }
    for (const field of service === 'gas' ? ['SG', 'Y', 'Z'] : ['SG']) {
      if (parsed[field] !== undefined && parsed[field] <= 0) {
        fieldErrors[field] = `${field === 'SG' && service === 'gas' ? 'Gas specific gravity' : FIELD_LABELS[field]} must be greater than zero.`;
      }
    }

    if (parsed.P1 !== undefined && parsed.P2 !== undefined) {
      const deltaP = parsed.P1 - parsed.P2;
      if (!Number.isFinite(deltaP)) {
        fieldErrors.P1 = 'Pressure drop is outside the supported numerical range.';
        fieldErrors.P2 = 'Pressure drop is outside the supported numerical range.';
      } else if (deltaP <= 0) {
        fieldErrors.P1 = 'Upstream pressure must be greater than downstream pressure.';
        fieldErrors.P2 = 'Downstream pressure must be below upstream pressure.';
      }
    }

    if (service === 'gas' && parsed.T !== undefined) {
      if (temperatureUnit === 'C' && parsed.T <= -273.15) {
        fieldErrors.T = 'Temperature must be above absolute zero (-273.15 °C).';
      } else if (temperatureUnit === 'K' && parsed.T <= 0) {
        fieldErrors.T = 'Absolute temperature must be greater than 0 K.';
      } else if (temperatureUnit === 'F' && parsed.T <= -459.67) {
        fieldErrors.T = 'Temperature must be above absolute zero (−459.67 °F).';
      }
    }
  }

  return {
    values,
    errors,
    isValid: OPERATING_CONDITIONS.every((condition) => Object.keys(errors[condition]).length === 0),
  };
}
