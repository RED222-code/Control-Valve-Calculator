import test from 'node:test';
import assert from 'node:assert/strict';
import { convertTemperatureInput } from '../src/utils/temperature.js';

test('common Fahrenheit/kelvin conversions remain readable in both directions', () => {
  for (const [fahrenheit, kelvin] of [['68', '293.15'], ['32', '273.15'], ['212', '373.15'], ['-40', '233.15']]) {
    assert.equal(convertTemperatureInput(fahrenheit, 'F', 'K'), kelvin);
    assert.equal(convertTemperatureInput(kelvin, 'K', 'F'), fahrenheit);
    const intermediate = convertTemperatureInput(fahrenheit, 'F', 'K');
    assert.equal(convertTemperatureInput(intermediate, 'K', 'F'), fahrenheit);
  }
});

test('blank and invalid input stays intact so field validation can explain it', () => {
  for (const input of ['', '  ', '12 K', 'Infinity', 'NaN', '1e999', '1e-999', '0x10']) {
    assert.equal(convertTemperatureInput(input, 'F', 'K'), input);
  }
  assert.equal(convertTemperatureInput(undefined, 'F', 'K'), '');
  assert.equal(convertTemperatureInput('  68.00 ', 'F', 'F'), '  68.00 ');
});

test('absolute zero stays exactly invalid in either unit', () => {
  assert.equal(convertTemperatureInput('-459.67', 'F', 'K'), '0');
  assert.equal(convertTemperatureInput('0', 'K', 'F'), '-459.67');
  assert.ok(Number(convertTemperatureInput('-500', 'F', 'K')) < 0);
  assert.ok(Number(convertTemperatureInput('-1', 'K', 'F')) < -459.67);
});

test('conversion refuses to turn valid near-zero temperatures into invalid values', () => {
  for (const kelvin of ['1e-14', '1e-15', '5e-324']) {
    assert.throws(() => convertTemperatureInput(kelvin, 'K', 'F'), /too close to absolute zero/);
  }
  for (const kelvin of ['1e-12', '1e-10', '0.001', '0.5']) {
    assert.ok(Number(convertTemperatureInput(kelvin, 'K', 'F')) > -459.67);
  }
  assert.ok(Number(convertTemperatureInput('-459.66999999999995', 'F', 'K')) > 0);
});

test('large temperatures convert without intermediate overflow when the result fits', () => {
  const converted = Number(convertTemperatureInput(String(Number.MAX_VALUE), 'F', 'K'));
  assert.ok(Number.isFinite(converted));
  assert.ok(Math.abs(converted / (Number.MAX_VALUE / 9 * 5) - 1) < 1e-14);
  const nearMaximumKelvin = Number.MAX_VALUE / 1.8 * (1 - Number.EPSILON);
  const nearMaximumFahrenheit = Number(convertTemperatureInput(String(nearMaximumKelvin), 'K', 'F'));
  assert.ok(Number.isFinite(nearMaximumFahrenheit), 'display rounding must not turn a finite conversion into Infinity');
  assert.ok(nearMaximumFahrenheit > 1.79e308);
  assert.throws(() => convertTemperatureInput(String(Number.MAX_VALUE), 'K', 'F'), /numerical range/);
  assert.throws(() => convertTemperatureInput(String(-Number.MAX_VALUE), 'K', 'F'), /numerical range/);
});

test('unsupported temperature units are explicit configuration errors', () => {
  assert.throws(() => convertTemperatureInput('68', 'R', 'K'), /Temperature unit/);
  assert.throws(() => convertTemperatureInput('68', 'F', 'R'), /Temperature unit/);
});

test('Celsius conversions preserve common temperatures and absolute zero', () => {
  assert.equal(convertTemperatureInput('68', 'F', 'C'), '20');
  assert.equal(convertTemperatureInput('20', 'C', 'F'), '68');
  assert.equal(convertTemperatureInput('20', 'C', 'K'), '293.15');
  assert.equal(convertTemperatureInput('293.15', 'K', 'C'), '20');
  assert.equal(convertTemperatureInput('-273.15', 'C', 'K'), '0');
});
