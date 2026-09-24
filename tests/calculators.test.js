import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLiquidCv } from '../src/calculators/liquidCalculator.js';
import { calculateGasCv } from '../src/calculators/gasCalculator.js';
import { parseNumericInput, validateOperatingConditions } from '../src/utils/validation.js';
import { formatCv, formatNumber } from '../src/utils/formatting.js';

function closeTo(actual, expected, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * tolerance, `${actual} ≈ ${expected}`);
}

function operatingData(overrides = {}) {
  return Object.fromEntries(['minimum', 'normal', 'maximum'].map((condition) => [condition, {
    Q: '100', P1: '100', P2: '75', SG: '1', Y: '0.9', Z: '0.95', T: '70',
    ...overrides[condition],
  }]));
}

test('liquid equation matches hand calculations and retains precision', () => {
  assert.deepEqual(calculateLiquidCv(100, 1, 100, 75), { deltaP: 25, cv: 20 });
  closeTo(calculateLiquidCv(125, 0.85, 100, 80).cv, 25.76941016011038);
});

test('simplified gas equation uses Y and Z independently', () => {
  assert.deepEqual(calculateGasCv(100, 1, 100, 75, 1, 1), { deltaP: 25, cv: 20 });
  // Reference evaluated independently with 50-digit decimal arithmetic.
  closeTo(calculateGasCv(100, 0.65, 100, 75, 0.9, 0.95).cv, 17.438278792686564);
  closeTo(calculateGasCv(100, 1, 100, 75, 0.25, 1).cv, 40);
  closeTo(calculateGasCv(100, 1, 100, 75, 1, 0.25).cv, 40);
});

test('zero flow is valid but does not skip invalid pressure or gas factors', () => {
  assert.equal(calculateLiquidCv(0, 1, 100, 75).cv, 0);
  assert.equal(calculateGasCv(0, 1, 100, 75, 1, 1).cv, 0);
  assert.throws(() => calculateLiquidCv(0, 1, 75, 75), /Upstream pressure/);
  assert.throws(() => calculateGasCv(0, 1, 100, 75, 0, 1), /Expansion factor/);
});

test('pressure reference may be negative while pressure drop must remain positive', () => {
  assert.deepEqual(calculateLiquidCv(100, 1, -5, -9), { deltaP: 4, cv: 50 });
  assert.equal(validateOperatingConditions(operatingData({ normal: { P1: '-5', P2: '-9' } }), 'gas').isValid, true);
  assert.throws(() => calculateLiquidCv(100, 1, 50, 50), /Upstream pressure/);
  assert.throws(() => calculateLiquidCv(100, 1, 45, 50), /Upstream pressure/);
});

test('calculator functions reject malformed, nonfinite, and out-of-domain numeric inputs', () => {
  for (const invalid of [undefined, null, '', '1', NaN, Infinity, -Infinity, true]) {
    for (let index = 0; index < 4; index += 1) {
      const args = [100, 1, 100, 75];
      args[index] = invalid;
      assert.throws(() => calculateLiquidCv(...args), /finite number/);
    }
    for (const index of [4, 5]) {
      const args = [100, 1, 100, 75, 0.9, 0.95];
      args[index] = invalid;
      assert.throws(() => calculateGasCv(...args), /finite number/);
    }
  }
  assert.throws(() => calculateLiquidCv(-1, 1, 100, 75), /negative/);
  assert.throws(() => calculateLiquidCv(100, 0, 100, 75), /greater than zero/);
  assert.throws(() => calculateGasCv(100, 1, 100, 75, 1, -1), /Compressibility/);
});

test('intermediate overflow and underflow preserve representable Cv values', () => {
  closeTo(calculateLiquidCv(1e-100, 1e300, 1e-100, 0).cv, 1e100, 1e-11);
  closeTo(calculateLiquidCv(1e100, 1e-300, 1e100, 0).cv, 1e-100, 1e-11);
  closeTo(calculateGasCv(1e150, 1e300, 1e200, 0, 1e200, 1).cv, 1e100, 1e-11);
  closeTo(calculateGasCv(1e-100, 1e-200, 1e-200, 0, 1e-200, 1).cv, 1, 1e-11);
});

test('unrepresentable results and pressure drops fail without exposing Infinity or zero', () => {
  assert.throws(() => calculateLiquidCv(1e308, 1e308, 1e-308, 0), /Calculated Cv.*numerical range/);
  assert.throws(() => calculateLiquidCv(1e-308, 1e-308, 1e308, 0), /Calculated Cv.*numerical range/);
  assert.throws(() => calculateLiquidCv(1, 1, Number.MAX_VALUE, -Number.MAX_VALUE), /Pressure drop.*numerical range/);
});

test('nonzero subnormal intermediates do not silently reduce result precision', () => {
  const flow = 1e160;
  const gravity = Number.MIN_VALUE * 2;
  // Taking square roots before division gives an independent stable reference.
  const stableLiquid = flow * (Math.sqrt(gravity) / Math.sqrt(3));
  closeTo(calculateLiquidCv(flow, gravity, 3, 0).cv, stableLiquid, 1e-11);

  // The first product is subnormal, then Z restores the denominator's scale.
  closeTo(calculateGasCv(1, 1, 1e-308, 0, 1e-15, 1e308).cv, Math.sqrt(1e15), 1e-11);
});

test('decimal parsing accepts scientific notation and rejects invalid characters and partial numbers', () => {
  for (const [raw, expected] of [[' 12.5 ', 12.5], ['+1e3', 1000], ['-.25', -0.25], ['1.', 1], ['-0', 0], [0, 0]]) {
    assert.equal(parseNumericInput(raw), expected);
  }
  for (const raw of ['', ' ', null, undefined, '12 gpm', '1,000', '0x10', '1_000', '1e', 'NaN', 'Infinity', '1e999', '1e-999', true, {}, '1\n2']) {
    assert.throws(() => parseNumericInput(raw));
  }
});

test('all three operating columns validate and calculate independently', () => {
  const result = validateOperatingConditions(operatingData({
    minimum: { Q: '50', P1: '90', P2: '65' },
    normal: { Q: '100', P1: '100', P2: '75' },
    maximum: { Q: '150', P1: '120', P2: '95' },
  }), 'liquid');
  assert.equal(result.isValid, true);
  assert.deepEqual(Object.values(result.values).map(({ Q, SG, P1, P2 }) => calculateLiquidCv(Q, SG, P1, P2).cv), [10, 20, 30]);

  const invalid = validateOperatingConditions(operatingData({
    minimum: { Q: '' }, normal: { SG: '0' }, maximum: { P1: '75', P2: '75' },
  }), 'liquid');
  assert.equal(invalid.isValid, false);
  assert.match(invalid.errors.minimum.Q, /required/);
  assert.match(invalid.errors.normal.SG, /greater than zero/);
  assert.match(invalid.errors.maximum.P1, /greater than downstream/);
  assert.match(invalid.errors.maximum.P2, /below upstream/);
  assert.equal(invalid.values.normal.Q, 100);
});

test('gas metadata is required only for gas and rejects absolute zero in F and K', () => {
  const withoutGas = operatingData({ minimum: { T: '', Y: '', Z: '' } });
  assert.equal(validateOperatingConditions(withoutGas, 'liquid').isValid, true);
  const gas = validateOperatingConditions(withoutGas, 'gas');
  assert.equal(gas.isValid, false);
  for (const field of ['T', 'Y', 'Z']) assert.match(gas.errors.minimum[field], /required/);
  assert.match(validateOperatingConditions(operatingData({ normal: { T: '-459.67' } }), 'gas').errors.normal.T, /absolute zero/);
  assert.equal(validateOperatingConditions(operatingData({ normal: { T: '-459.66' } }), 'gas').isValid, true);
  assert.match(validateOperatingConditions(operatingData({ normal: { T: '0' } }), 'gas', 'K').errors.normal.T, /greater than 0 K/);
  assert.equal(validateOperatingConditions(operatingData({ normal: { T: '0.1' } }), 'gas', 'K').isValid, true);
});

test('validation rejects overflowed pressure subtraction and unsafe configuration', () => {
  const result = validateOperatingConditions(operatingData({ minimum: { P1: '1.7976931348623157e308', P2: '-1.7976931348623157e308' } }), 'liquid');
  assert.equal(result.isValid, false);
  assert.match(result.errors.minimum.P1, /numerical range/);
  assert.equal(validateOperatingConditions(null, 'liquid').isValid, false);
  assert.throws(() => validateOperatingConditions({}, 'steam'), /Service/);
  assert.throws(() => validateOperatingConditions({}, 'gas', 'R'), /Temperature unit/);
});

test('display formatting rounds only for presentation and never disguises tiny values as zero', () => {
  assert.equal(formatCv(20), '20.00');
  assert.equal(formatCv(20.1234567), '20.123');
  assert.equal(formatNumber(25), '25');
  assert.equal(formatNumber(1234.5678), '1,234.568');
  assert.equal(formatCv(0), '0.00');
  assert.equal(formatCv(-0), '0.00');
  assert.equal(formatCv(1e-8), '1.000e-8');
  assert.equal(formatCv(1e100), '1.000e+100');
  for (const invalid of [NaN, Infinity, -Infinity, undefined, null, '10']) {
    assert.equal(formatCv(invalid), '—');
    assert.equal(formatNumber(invalid), '—');
  }
});
