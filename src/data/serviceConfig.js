export const CONDITIONS = [
  { key: 'minimum', label: 'Minimum', detail: 'LOW OPERATING POINT' },
  { key: 'normal', label: 'Normal', detail: 'TYPICAL OPERATION' },
  { key: 'maximum', label: 'Maximum', detail: 'HIGH OPERATING POINT' },
];

export const INPUT_ROWS = [
  { key: 'Q', label: 'Flow rate', gasLabel: 'Gas flow rate', symbol: 'Q', unit: 'gpm', gasUnit: 'SCFM', placeholder: '0.00' },
  { key: 'P1', label: 'Upstream pressure', symbol: 'P₁', unit: 'psi', placeholder: '0.00' },
  { key: 'P2', label: 'Downstream pressure', symbol: 'P₂', unit: 'psi', placeholder: '0.00' },
  { key: 'deltaP', label: 'Pressure drop', symbol: 'ΔP', unit: 'psi', type: 'automatic' },
  { key: 'SG', label: 'Specific gravity', gasLabel: 'Gas specific gravity', symbol: 'SG', unit: '—', placeholder: '1.00' },
  { key: 'Y', label: 'Expansion factor', symbol: 'Y', unit: '—', placeholder: '1.00', gasOnly: true },
  { key: 'Z', label: 'Compressibility factor', symbol: 'Z', unit: '—', placeholder: '1.00', gasOnly: true },
  { key: 'T', label: 'Temperature', symbol: 'T', unit: '°F', placeholder: '68.00', gasOnly: true },
];

export function createEmptyData() {
  return Object.fromEntries(CONDITIONS.map(({ key }) => [key, { Q: '', P1: '', P2: '', SG: '', Y: '', Z: '', T: '' }]));
}

export function createSession() {
  return { data: createEmptyData(), errors: {}, results: null, temperatureUnit: 'F', submitted: false, feedback: null };
}
