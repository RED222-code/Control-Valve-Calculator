function put(sheet, address, value) {
  sheet[address] = { t: typeof value === 'number' ? 'n' : 's', v: value };
}

// Reproduces the supplied datasheet's occupied cells without committing its
// project-specific content. Its labels are in B and its values are in O:R.
export function templateSheet({ shift = 0, overrides = {} } = {}) {
  const worksheet = { '!ref': `A1:BC${78 + shift}` };
  put(worksheet, 'A1', 'CONTROL VALVE');
  put(worksheet, 'B3', 'Tag no');
  put(worksheet, 'K3', 'XX-PCV-YYY');
  put(worksheet, 'B4', 'Service');
  put(worksheet, 'K4', 'Inlet Pressure Control');
  put(worksheet, `A${46 + shift}`, 'SERVICE DATA');
  const rows = [
    [47, 'Fluid Name', 'Hydrocarbon'],
    [48, 'Fluid State', 'Gas'],
    [49, 'Design Pressure', null, null, 290, 'PSI'],
    [50, 'Design Temp', null, null, '0/80', 'Deg C'],
    [51, 'Flow Rate', 3.1, 3.1, 3.1, 'MMSCF/D'],
    [52, 'Vapour Pressure', 28, 28, 28, 'PSI'],
    [53, 'Upstream Press.', 21.8, 50.8, 145, 'PSI'],
    [54, 'Downstream Presssure', 20.3, 21.7, 74, 'PSI'],
    [55, 'Diff. Pressure', 1.8, 29.1, 71, 'PSI'],
    [56, 'Temperature', 26, 33, 36, 'DEG C'],
    [57, 'Critical Pressure', 40, 40, 40, 'DEG C'],
    [58, 'Critical Temp', 50, 50, 50, 'Cp'],
    [59, 'Viscosity', 1.13, 1.13, 1.13, 'Cp'],
    [60, 'Density', 0.02, 0.02, 0.02, 'kg/m³'],
    [61, 'Molecular Weight', 16, '16', 16, 'Kg'],
    [62, 'Expansion Factor', 0.9, '0.9', 0.9],
    [63, 'Cp/Cv', 1.2, '1.2', 1.2],
  ];
  for (const [originalRow, originalLabel, ...originalValues] of rows) {
    const row = originalRow + shift;
    const { label = originalLabel, values = originalValues } = overrides[originalLabel] ?? {};
    put(worksheet, `B${row}`, label);
    put(worksheet, `N${row}`, ':');
    for (const [index, value] of values.entries()) {
      if (value !== null && value !== undefined) put(worksheet, `${'OPQR'[index]}${row}`, value);
    }
  }
  put(worksheet, `A${64 + shift}`, 'SELECTED VALVE CV');
  put(worksheet, `B${65 + shift}`, 'Calculated Valve Cv (min/norm/max)');
  put(worksheet, `Q${65 + shift}`, '0.5743 / 1.615 / 4.346');
  return worksheet;
}

export { put };
