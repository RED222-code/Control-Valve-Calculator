import test from 'node:test';
import assert from 'node:assert/strict';
import { detectValveSheet } from '../src/importers/sheetDetector.js';
import { parseValveSheet } from '../src/importers/valveSheetParser.js';
import { put, templateSheet } from './template-fixture.js';

const CONDITIONS = ['minimum', 'normal', 'maximum'];

test('recognizes the supplied control-valve template and ignores its cover and revision sheets', () => {
  const valve = detectValveSheet(templateSheet(), 'XX-PCV-YYY ');
  assert.equal(valve.relevant, true);
  assert.equal(valve.usefulProcessData, true);
  assert.equal(valve.service, 'gas');
  assert.equal(valve.valveTag, 'XX-PCV-YYY');

  const cover = { A6: { t: 's', v: 'Control Valve Datasheets' }, '!ref': 'A1:H43' };
  const revision = { A1: { t: 's', v: 'Revision History' }, B5: { t: 's', v: 'Flow Rate' }, '!ref': 'A1:G91' };
  assert.equal(detectValveSheet(cover, 'Cover Sheet ').relevant, false);
  assert.equal(detectValveSheet(revision, 'Revision History').relevant, false);
});

test('maps supplied O/P/Q/R operating cells by SERVICE DATA label and converts units', () => {
  const result = parseValveSheet(templateSheet(), 'XX-PCV-YYY ');
  assert.equal(result.service, 'gas');
  assert.equal(result.temperatureUnit, 'F');
  for (const [index, condition] of CONDITIONS.entries()) {
    assert.equal(Number(result.data[condition].Q), 3.1e6 / 1440);
    assert.equal(Number(result.data[condition].P1), [21.8, 50.8, 145][index]);
    assert.equal(Number(result.data[condition].P2), [20.3, 21.7, 74][index]);
    assert.equal(Number(result.data[condition].T), [78.8, 91.4, 96.8][index]);
    assert.equal(result.data[condition].Y, '0.9');
    assert.equal(result.data[condition].SG, '');
  }
  assert.deepEqual(result.summary.find(({ field }) => field === 'Q').detectedUnits, ['MMSCFD']);
  assert.equal(result.summary.find(({ field }) => field === 'density').found, true);
  assert.deepEqual(result.serviceData.flowRate, {
    row: 51, minimum: 3.1, normal: 3.1, maximum: 3.1, unit: 'MMSCF/D',
  });
  assert.equal(result.serviceData.fluidName.minimum, 'Hydrocarbon');
  assert.equal(result.serviceData.fluidState.minimum, 'Gas');
  assert.equal(result.serviceData.designPressure.maximum, 290);
  assert.equal(result.serviceData.designTemperature.maximum, '0/80');
  assert.equal(result.serviceData.molecularWeight.normal, 16);
  assert.equal(result.serviceData.heatCapacityRatio.normal, 1.2);
});

test('follows shifted service rows and aliases while keeping O/P/Q/R fixed', () => {
  const worksheet = templateSheet({
    shift: 2,
    overrides: {
      'Flow Rate': { label: 'Gas Flow Rate', values: [1, 2, 3, 'MMSCF/D'] },
      'Upstream Press.': { label: 'Inlet Pressure', values: [30, 40, 50, 'PSI'] },
      'Downstream Presssure': { label: 'Downstream Pressure', values: [20, 25, 30, 'PSI'] },
      'Expansion Factor': { label: 'Y Factor', values: [0.8, 0.9, 1] },
    },
  });
  const result = parseValveSheet(worksheet, 'XX-PCV-YYY');
  assert.deepEqual(CONDITIONS.map((condition) => Number(result.data[condition].Q)), [1, 2, 3].map((value) => value * 1e6 / 1440));
  assert.deepEqual(CONDITIONS.map((condition) => Number(result.data[condition].P1)), [30, 40, 50]);
  assert.deepEqual(CONDITIONS.map((condition) => Number(result.data[condition].P2)), [20, 25, 30]);
  assert.deepEqual(CONDITIONS.map((condition) => Number(result.data[condition].Y)), [0.8, 0.9, 1]);
});

test('keeps partial operating rows partial and excludes values outside SERVICE DATA', () => {
  const worksheet = templateSheet({ overrides: { 'Flow Rate': { values: [null, 3.1, null, 'MMSCF/D'] } } });
  put(worksheet, 'B35', 'Flow Rate');
  put(worksheet, 'O35', 999);
  put(worksheet, 'P35', 999);
  put(worksheet, 'Q35', 999);
  put(worksheet, 'R35', 'MMSCF/D');
  put(worksheet, 'B66', 'Flow Rate');
  put(worksheet, 'O66', 999);
  put(worksheet, 'P66', 999);
  put(worksheet, 'Q66', 999);
  put(worksheet, 'R66', 'MMSCF/D');
  const result = parseValveSheet(worksheet, 'XX-PCV-YYY');
  assert.equal(result.data.minimum.Q, '');
  assert.equal(Number(result.data.normal.Q), 3.1e6 / 1440);
  assert.equal(result.data.maximum.Q, '');
  assert.match(result.errors.minimum.Q, /missing|not found/i);
});

test('duplicate SERVICE DATA labels are ambiguous and leave operating values blank', () => {
  const worksheet = templateSheet({
    overrides: { 'Critical Temp': { label: 'Flow Rate', values: [10, 20, 30, 'MMSCF/D'] } },
  });
  const result = parseValveSheet(worksheet, 'XX-PCV-YYY');
  assert.equal(result.serviceData.flowRate, null);
  for (const condition of CONDITIONS) {
    assert.equal(result.data[condition].Q, '');
    assert.match(result.errors[condition].Q, /multiple/i);
  }
});

test('rejects missing units and incompatible pressure references in template rows', () => {
  const worksheet = templateSheet({
    overrides: {
      'Flow Rate': { values: [1, 2, 3, null] },
      'Upstream Press.': { values: [30, 40, 50, 'psig'] },
      'Downstream Presssure': { values: [20, 25, 30, 'psia'] },
    },
  });
  const result = parseValveSheet(worksheet, 'XX-PCV-YYY');
  for (const condition of CONDITIONS) {
    assert.equal(result.data[condition].Q, '');
    assert.match(result.errors[condition].Q, /unit/i);
    assert.equal(result.data[condition].P1, '');
    assert.equal(result.data[condition].P2, '');
    assert.match(result.errors[condition].P1, /reference/i);
  }
});

test('does not infer a service or invent flow values when Fluid State is unknown', () => {
  const worksheet = templateSheet({ overrides: { 'Fluid State': { values: ['Not specified'] } } });
  const result = parseValveSheet(worksheet, 'XX-PCV-YYY');
  assert.equal(result.service, null);
  assert.equal(result.data.normal.Q, '');
  assert.match(result.warnings.join(' '), /select gas or liquid/i);
});
