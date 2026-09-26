import assert from 'node:assert/strict';
import test from 'node:test';
import { createResultExportModel, createWorkbookExportModel, sanitizeFilename } from '../src/utils/resultExportModel.js';

test('exports saved operating inputs with selected units for each worksheet', () => {
  const inputs = Object.fromEntries(['minimum', 'normal', 'maximum'].map((key, i) => [key,
    { Q: String(10 + i), P1: '12', P2: '9', SG: '0.7', Y: '0.9', Z: '1', T: '25' }]));
  const model = createWorkbookExportModel({ workbookName: 'Process.xlsx', calculations: [{
    sheetName: 'PCV-1', service: 'gas', inputs, units: { flow: 'MMSCFD', pressure: 'bar' },
    temperatureUnit: 'C', results: { minimumCv: 1, normalCv: 2, maximumCv: 3 },
  }] }).sheets[0];
  assert.deepEqual(model.operatingConditions.find(row => row.label === 'Gas flow rate'),
    { label: 'Gas flow rate', unit: 'MMSCFD', values: ['10', '11', '12'] });
  assert.deepEqual(model.operatingConditions.find(row => row.label === 'Pressure drop'),
    { label: 'Pressure drop', unit: 'bar', values: ['3', '3', '3'] });
  assert.deepEqual(model.operatingConditions.find(row => row.label === 'Temperature'),
    { label: 'Temperature', unit: 'C', values: ['25', '25', '25'] });
});

test('builds a result-only export model from manual calculator results', () => {
  const model = createResultExportModel({
    service: 'liquid',
    results: {
      minimum: { cv: 11.180339887498949 },
      normal: { cv: 18.257418583505537 },
      maximum: { cv: 23.717082451262847 },
    },
  });

  assert.equal(model.serviceLabel, 'Liquid');
  assert.equal(model.sourceLabel, 'Manual entry');
  assert.deepEqual(model.values.map(({ value }) => value), ['11.18', '18.257', '23.717']);
  assert.equal(model.maximumValue, '23.717');
  assert.equal(model.governingText, 'Maximum condition governs');
  assert.equal(model.filename, 'control-valve-liquid-cv-result');
  assert.equal('inputs' in model, false);
});

test('normalizes saved worksheet results and creates a safe file name', () => {
  const model = createResultExportModel({
    service: 'gas',
    workbookName: 'Valve <Register>.xlsx',
    sheetName: '100/FCV:002',
    results: {
      minimumCv: 52,
      normalCv: 52,
      maximumCv: 12,
      maximumCalculatedCv: 52,
    },
  });

  assert.equal(model.sourceLabel, 'Excel worksheet');
  assert.equal(model.workbookName, 'Valve <Register>');
  assert.equal(model.sheetName, '100/FCV:002');
  assert.equal(model.maximumValue, '52.00');
  assert.equal(model.governingText, 'Minimum, Normal conditions govern');
  assert.equal(model.filename, 'Valve-Register-100-FCV-002-cv-result');
});

test('refuses incomplete output and sanitizes hostile file-name characters', () => {
  assert.throws(
    () => createResultExportModel({ service: 'liquid', results: { minimumCv: 1 } }),
    /Complete calculation results/,
  );
  assert.equal(sanitizeFilename('  ../bad:* name?.  '), 'bad-name');
  assert.equal(sanitizeFilename('***', 'fallback'), 'fallback');
});

test('builds an ordered workbook summary using each worksheet maximum calculated Cv', () => {
  const calculations = [
    {
      sheetName: '100-FCV-001',
      service: 'gas',
      results: { minimumCv: 52, normalCv: 37.755, maximumCv: 12, maximumCalculatedCv: 52 },
    },
    {
      sheetName: '100-FCV-002',
      service: 'liquid',
      results: { minimumCv: 11.18, normalCv: 18.257, maximumCv: 23.717 },
    },
  ];
  const model = createWorkbookExportModel({ workbookName: 'Valve <Register>.xlsx', calculations });

  assert.equal(model.workbookName, 'Valve <Register>');
  assert.equal(model.filename, 'Valve-Register-control-valve-results');
  assert.deepEqual(model.sheets.map(({ sheetName }) => sheetName), ['100-FCV-001', '100-FCV-002']);
  assert.deepEqual(model.sheets.map(({ serviceLabel }) => serviceLabel), ['Gas', 'Liquid']);
  assert.deepEqual(model.sheets.map(({ maximumValue }) => maximumValue), ['52.00', '23.717']);
  assert.deepEqual(calculations.map(({ sheetName }) => sheetName), ['100-FCV-001', '100-FCV-002']);
});

test('rejects empty, duplicate, and malformed workbook result collections', () => {
  assert.throws(
    () => createWorkbookExportModel({ workbookName: 'Empty.xlsx', calculations: [] }),
    /At least one completed worksheet/,
  );
  assert.throws(
    () => createWorkbookExportModel({
      workbookName: 'Duplicate.xlsx',
      calculations: [
        { sheetName: 'FCV-1', service: 'liquid', results: { minimumCv: 1, normalCv: 2, maximumCv: 3 } },
        { sheetName: 'fcv-1', service: 'liquid', results: { minimumCv: 4, normalCv: 5, maximumCv: 6 } },
      ],
    }),
    /duplicate worksheet result/,
  );
  assert.throws(
    () => createResultExportModel({ service: 'steam', results: { minimumCv: 1, normalCv: 2, maximumCv: 3 } }),
    /either liquid or gas/,
  );
  assert.equal(sanitizeFilename('report\u202Efdp.xlsx'), 'reportfdp.xlsx');
});
