export const FLOW_UNITS = {
  liquid: { gpm: 1, 'm³/h': 1 / (0.003785411784 * 60), 'L/min': 1 / 3.785411784, 'L/s': 60 / 3.785411784, bpd: 42 / 1440 },
  gas: { SCFM: 1, SCFH: 1 / 60, SCFD: 1 / 1440, MMSCFD: 1000000 / 1440 },
};
export const PRESSURE_UNITS = { psi: 1, bar: 100000 / 6894.757293168, kPa: 1000 / 6894.757293168, MPa: 1000000 / 6894.757293168, Pa: 1 / 6894.757293168 };

export function unitFactor(field, unit, service) {
  const options = field === 'Q' ? FLOW_UNITS[service] : PRESSURE_UNITS;
  if (!Object.hasOwn(options, unit)) throw new Error('Unsupported unit.');
  return options[unit];
}

export function convertInputUnit(value, factor) {
  const converted = value * factor;
  if (!Number.isFinite(converted) || (value !== 0 && converted === 0)) throw new Error('Converted value is outside the supported numerical range.');
  return converted;
}
