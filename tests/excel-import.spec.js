import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';

const conditions = ['Minimum', 'Normal', 'Maximum'];
const workbookName = 'HEOSL-OML30-02-0420-03-DTS-00002_Rev03.xlsx';
const displayName = workbookName.replace(/\.xlsx$/i, '');
const gasTag = '100-FCV-001';
const liquidTag = '100-FCV-002';
const gasValues = {
  'Flow rate': [100, 250, 400],
  'Upstream pressure': [120, 120, 120],
  'Downstream pressure': [100, 90, 80],
  'Specific gravity': [0.65, 0.65, 0.65],
  'Expansion factor': [0.95, 0.95, 0.95],
  'Compressibility factor': [1, 1, 1],
  Temperature: [68, 68, 68],
};
const liquidValues = {
  'Flow rate': [50, 100, 150],
  'Upstream pressure': [100, 100, 100],
  'Downstream pressure': [80, 70, 60],
  'Specific gravity': [1, 1, 1],
};
const liquidCvs = [11.180339887498949, 18.257418583505537, 23.717082451262847];
const gasCvs = [18.49608777979535, 37.754981081854986, 52.3148363780597];

function setCell(rows, address, value) {
  const { r, c } = XLSX.utils.decode_cell(address);
  rows[r] ??= [];
  rows[r][c] = value;
}

function setServiceRow(rows, row, label, values = [], unit = '') {
  setCell(rows, `B${row}`, label);
  for (const [index, value] of values.entries()) {
    if (value !== undefined && value !== null) setCell(rows, `${'OPQ'[index]}${row}`, value);
  }
  if (unit) setCell(rows, `R${row}`, unit);
}

// The supplied valve family has A1 and A46 anchors, B-column labels and fixed
// O/P/Q operating values with the unit in R. Optional rows below the reference
// fields let these browser tests exercise a fully populated calculator.
function valveSheet(tag, fluidState) {
  const rows = [];
  setCell(rows, 'A1', 'CONTROL VALVE');
  setCell(rows, 'B3', 'Tag no');
  setCell(rows, 'K3', tag);
  setCell(rows, 'A46', 'SERVICE DATA');
  setServiceRow(rows, 47, 'Fluid Name', ['Hydrocarbon']);
  setServiceRow(rows, 48, 'Fluid State', [fluidState]);
  setServiceRow(rows, 49, 'Design Pressure', [undefined, undefined, 290], 'PSI');
  setServiceRow(rows, 50, 'Design Temp', [undefined, undefined, '0/80'], 'DEG C');
  setServiceRow(rows, 52, 'Vapour Pressure', [], 'PSI');
  setServiceRow(rows, 55, 'Diff. Pressure', [], 'PSI');
  setServiceRow(rows, 57, 'Critical Pressure', [], 'PSI');
  setServiceRow(rows, 58, 'Critical Temp', [], 'DEG C');
  setServiceRow(rows, 59, 'Viscosity', [], 'CP');
  setServiceRow(rows, 60, 'Density', [], 'kg/m³');
  setServiceRow(rows, 61, 'Molecular Weight', [undefined, '16']);
  setServiceRow(rows, 63, 'Cp/Cv', [undefined, '1.2']);
  return rows;
}

function gasSheet(tag = gasTag) {
  const rows = valveSheet(tag, 'Vapour');
  setServiceRow(rows, 51, 'Flow Rate', [100, 250, 400], 'SCFM');
  setServiceRow(rows, 53, 'Upstream Press.', [120, 120, 120], 'PSI');
  setServiceRow(rows, 54, 'Downstream Presssure', [100, 90, 80], 'PSI');
  setServiceRow(rows, 56, 'Temperature', [68, 68, 68], '°F');
  setServiceRow(rows, 62, 'Expansion Factor', [0.95, '0.95', 0.95]);
  setServiceRow(rows, 64, 'Specific Gravity', [0.65, 0.65, 0.65]);
  setServiceRow(rows, 65, 'Compressibility Factor', [1, 1, 1]);
  return rows;
}

function liquidSheet(tag = liquidTag) {
  const rows = valveSheet(tag, 'LIQUID');
  setServiceRow(rows, 51, 'Flow Rate', [50, 100, 150], 'gpm');
  setServiceRow(rows, 53, 'Upstream Press.', [100, 100, 100], 'psig');
  setServiceRow(rows, 54, 'Downstream Presssure', [80, 70, 60], 'psig');
  setServiceRow(rows, 64, 'Specific Gravity', [1, 1, 1]);
  return rows;
}

// Build real workbooks in memory: tests do not create a permanent fixture archive.
function excelFile(sheets, name = workbookName) {
  const workbook = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  }
  const bookType = /\.xls$/i.test(name) ? 'biff8' : 'xlsx';
  return {
    name,
    mimeType: bookType === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.ms-excel',
    buffer: XLSX.write(workbook, { bookType, type: 'buffer' }),
  };
}

function standardWorkbook(name = workbookName) {
  const cover = [];
  setCell(cover, 'A1', 'CONTROL VALVE');
  setCell(cover, 'B48', 'Fluid State');
  setCell(cover, 'O48', 'Gas');
  setServiceRow(cover, 51, 'Flow Rate', [1, 2, 3], 'SCFM');
  setServiceRow(cover, 53, 'Upstream Press.', [50, 50, 50], 'PSI');
  return excelFile({
    'Cover Sheet': cover,
    [gasTag]: gasSheet(),
    [liquidTag]: liquidSheet(),
    'Revision History': [['Revision', 'Date', 'Description'], ['03', '2026-09-16', 'Issued']],
  }, name);
}

const sheetButton = (page, name) => page.getByRole('option', { name, exact: true, hidden: true });
const resultGroup = (page) => page.getByRole('region', { name: 'Workbook calculation results', exact: true });
const card = (page, sheetName) => page.locator(`[id="workbook-result-${encodeURIComponent(sheetName)}"]`);
const input = (page, condition, variable) => {
  const field = page.getByLabel(`${condition} ${variable}`, { exact: true });
  return ['Flow rate', 'Specific gravity'].includes(variable)
    ? field.or(page.getByLabel(`${condition} Gas ${variable.toLowerCase()}`, { exact: true }))
    : field;
};

async function upload(page, file = standardWorkbook()) {
  await page.getByRole('button', { name: 'Import Excel', exact: true }).click();
  await page.getByLabel('Choose Excel File', { exact: true }).setInputFiles(file);
  await expect(page.getByText(file.name, { exact: true })).toBeVisible();
  await expect(page.getByLabel('Choose Excel File', { exact: true })).toBeEnabled();
}

test('persists workbook results and resumes unprocessed sheets after reload', async ({ page }) => {
  await page.goto('/');
  await upload(page);
  await selectSheet(page, gasTag);
  await calculate(page);
  await expectSavedResult(page, gasTag, gasCvs);
  await page.reload();
  await expect(page.getByText('Previous session restored.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Manual Entry', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(input(page, 'Minimum', 'Flow rate')).toHaveValue('');
  await expectSavedResult(page, gasTag, gasCvs);
  await page.getByRole('button', { name: 'Import Excel', exact: true }).click();
  await selectSheet(page, liquidTag);
  await expectInputs(page, liquidValues);
  await calculate(page);
  await page.reload();
  await expectSavedResult(page, gasTag, gasCvs);
  await expectSavedResult(page, liquidTag, liquidCvs);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('controlValveSizingSession')));
  expect(saved.version).toBe(1);
  expect(saved.data.workbook.workbookSession.workbook).toBeUndefined();
  expect(saved.data.workbook.workbookSession.sheets.filter(sheet => sheet.status === 'calculated')).toHaveLength(2);
  await page.getByRole('button', { name: 'Clear Session', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(card(page, gasTag)).toBeVisible();
  await page.getByRole('button', { name: 'Clear Session', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear Session', exact: true }).click();
  await expect(resultGroup(page)).toHaveCount(0);
  await page.reload();
  await expect(input(page, 'Minimum', 'Flow rate')).toHaveValue('');
  expect(await page.evaluate(() => localStorage.getItem('controlValveSizingSession'))).toBeNull();
});

test('persists manual drafts and rejects corrupted sessions', async ({ page }) => {
  await page.goto('/');
  await input(page, 'Minimum', 'Flow rate').fill('123');
  await page.reload();
  await expect(input(page, 'Minimum', 'Flow rate')).toHaveValue('123');
  const context = page.context();
  await page.close();
  for (const corrupted of ['{broken', JSON.stringify({ version: 99, data: {} }), JSON.stringify({ version: 1, data: {} })]) {
    // Inject immediately before startup, after any other page's close-time flush.
    const fresh = await context.newPage();
    await fresh.addInitScript(value => localStorage.setItem('controlValveSizingSession', value), corrupted);
    await fresh.goto('/');
    await expect(input(fresh, 'Minimum', 'Flow rate')).toHaveValue('');
    expect(await fresh.evaluate(() => localStorage.getItem('controlValveSizingSession'))).toBeNull();
    await fresh.close();
  }
});

async function selectSheet(page, name) {
  const dropdown = page.getByRole('combobox', { name: 'Workbook sheets', exact: true });
  await dropdown.click();
  await page.getByRole('option', { name, exact: true }).click();
}

async function calculate(page) {
  await page.getByRole('button', { name: 'Calculate Cv', exact: true }).click();
}

async function expectInputs(page, values) {
  for (const [variable, numbers] of Object.entries(values)) {
    for (const [index, condition] of conditions.entries()) {
      await expect.poll(async () => Number(await input(page, condition, variable).inputValue()))
        .toBeCloseTo(numbers[index], 5);
    }
  }
}

async function fillInputs(page, values) {
  for (const [variable, numbers] of Object.entries(values)) {
    for (const [index, condition] of conditions.entries()) {
      await input(page, condition, variable).fill(String(numbers[index]));
    }
  }
}

async function expectCv(output, expected) {
  await expect(output).toBeVisible();
  const value = Number((await output.innerText()).replaceAll(',', '').trim());
  expect(Number.isFinite(value)).toBe(true);
  expect(Math.abs(value - expected)).toBeLessThanOrEqual(0.0051);
}

async function expectSavedResult(page, name, cvs) {
  const result = card(page, name);
  await expect(result).toBeVisible();
  await expect(result.locator('summary')).toHaveCount(0);
  for (const [index, condition] of conditions.entries()) {
    await expectCv(result.getByLabel(`${condition} Cv result`, { exact: true }), cvs[index]);
  }
  await expectCv(result.getByLabel('Maximum Calculated Cv result', { exact: true }), Math.max(...cvs));
}

async function expectNoWorkbookCalculations(page) {
  await expect(page.locator('[id^="workbook-result-"]')).toHaveCount(0);
}

async function downloadBytes(download) {
  const path = await download.path();
  expect(path).not.toBeNull();
  return readFile(path);
}

function wordDocumentXml(bytes) {
  const archive = XLSX.CFB.read(bytes, { type: 'buffer' });
  const document = XLSX.CFB.find(archive, '/word/document.xml');
  expect(document).toBeTruthy();
  return Buffer.from(document.content).toString('utf8');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('keeps workbook data local and persists only normalized session data', async ({ page }) => {
  await page.addInitScript(() => {
    window.workbookPersistenceCalls = [];
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...args) {
      window.workbookPersistenceCalls.push(['storage', ...args]);
      return setItem.apply(this, args);
    };
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (...args) {
      window.workbookPersistenceCalls.push(['indexedDB', ...args]);
      return open.apply(this, args);
    };
  });
  await page.reload();
  const requests = [];
  page.on('request', (request) => requests.push({
    method: request.method(), url: request.url(), body: request.postData(),
  }));
  await upload(page);
  await selectSheet(page, gasTag);
  await calculate(page);
  await expectSavedResult(page, gasTag, gasCvs);
  expect(requests.filter(({ method }) => !['GET', 'HEAD'].includes(method))).toEqual([]);
  expect(requests.some(({ url, body }) => `${url}${body ?? ''}`.includes(workbookName))).toBe(false);
  await expect.poll(() => page.evaluate(() => window.workbookPersistenceCalls.length)).toBeGreaterThan(0);
  const calls = await page.evaluate(() => window.workbookPersistenceCalls);
  expect(calls.every(([type, key]) => type === 'storage' && key === 'controlValveSizingSession')).toBe(true);
  expect(calls.every(([, , value]) => !Object.hasOwn(JSON.parse(value).data.workbook.workbookSession, 'workbook'))).toBe(true);
  await page.reload();
  await expectSavedResult(page, gasTag, gasCvs);
  await expect(page.getByRole('heading', { name: displayName, exact: true })).toBeVisible();
});

test('ignores covers and maps liquid service ranges before deliberate calculation', async ({ page }) => {
  await upload(page);
  await expect(sheetButton(page, 'Cover Sheet')).toBeDisabled();
  await expect(sheetButton(page, 'Revision History')).toBeDisabled();
  await expect(sheetButton(page, liquidTag)).toContainText('Unprocessed');
  await expectNoWorkbookCalculations(page);
  await expect(resultGroup(page).getByRole('button', { name: /Download .* workbook results/i })).toHaveCount(0);
  await selectSheet(page, liquidTag);
  await expect(page.getByRole('tab', { name: 'Liquid Service', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.excel-import-summary')).toHaveCount(0);
  await expectInputs(page, liquidValues);
  await expect(sheetButton(page, liquidTag)).toContainText('Editing');
  await expectNoWorkbookCalculations(page);
  await calculate(page);
  await expectSavedResult(page, liquidTag, liquidCvs);
  await expect(resultGroup(page).getByRole('button', { name: `Download ${displayName} workbook results as PDF`, exact: true })).toBeVisible();
  await expect(resultGroup(page).getByRole('button', { name: `Download ${displayName} workbook results as Word`, exact: true })).toBeVisible();
  await expect(sheetButton(page, liquidTag)).toContainText('Calculated');
  await expect(resultGroup(page).getByRole('heading', { name: displayName, exact: true })).toHaveCount(1);
  await expect(resultGroup(page)).not.toContainText(workbookName);
});

test('recognizes vapour and imports gas values into the existing gas calculation engine', async ({ page }) => {
  await upload(page, excelFile({ [gasTag]: gasSheet() }));
  await selectSheet(page, gasTag);
  await expect(page.getByRole('tab', { name: 'Gas Service', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectInputs(page, gasValues);
  await expect(page.getByLabel('Temperature unit', { exact: true })).toHaveValue('F');
  await expectNoWorkbookCalculations(page);
  await calculate(page);
  await expectSavedResult(page, gasTag, gasCvs);
});

test('finds a shifted Flow Rate row inside SERVICE DATA and ignores a matching label above it', async ({ page }) => {
  const rows = gasSheet();
  for (const column of ['B', 'O', 'P', 'Q', 'R']) setCell(rows, `${column}51`, undefined);
  setServiceRow(rows, 44, 'Flow Rate', [999, 999, 999], 'SCFM');
  setServiceRow(rows, 69, 'Flow Rate', [100, 250, 400], 'SCFM');
  await upload(page, excelFile({ [gasTag]: rows }));
  await selectSheet(page, gasTag);
  await expectInputs(page, gasValues);
  await calculate(page);
  await expectSavedResult(page, gasTag, gasCvs);
});

test('imports the reference template cells and leaves unavailable gas inputs empty', async ({ page }) => {
  const rows = valveSheet(gasTag, 'Gas');
  setServiceRow(rows, 51, 'Flow Rate', [3.1, 3.1, 3.1], 'MMSCF/D');
  setServiceRow(rows, 53, 'Upstream Press.', [21.8, 50.8, 145], 'PSI');
  setServiceRow(rows, 54, 'Downstream Presssure', [20.3, 21.7, 74], 'PSI');
  setServiceRow(rows, 56, 'Temperature', [26, 33, 36], 'DEG C');
  setServiceRow(rows, 62, 'Expansion Factor', [0.9, '0.9', 0.9]);
  setCell(rows, 'B65', 'Calculated Valve Cv (min/norm/max)');
  setCell(rows, 'Q65', '0.5743 / 1.615 / 4.346');
  await upload(page, excelFile({ [gasTag]: rows }));
  await selectSheet(page, gasTag);
  await expect(page.getByRole('tab', { name: 'Gas Service', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectInputs(page, {
    'Flow rate': Array(3).fill(3.1 * 1_000_000 / 1440),
    'Upstream pressure': [21.8, 50.8, 145],
    'Downstream pressure': [20.3, 21.7, 74],
    Temperature: [78.8, 91.4, 96.8],
    'Expansion factor': [0.9, 0.9, 0.9],
  });
  for (const condition of conditions) {
    await expect(input(page, condition, 'Specific gravity')).toHaveValue('');
    await expect(input(page, condition, 'Compressibility factor')).toHaveValue('');
  }
  await expectNoWorkbookCalculations(page);
});

test('exports calculated worksheets with every operating Cv and the governing result', async ({ page }) => {
  await upload(page);
  await selectSheet(page, liquidTag);
  await calculate(page);
  await selectSheet(page, gasTag);
  await expect(card(page, liquidTag)).toBeVisible();
  await expect(card(page, gasTag)).toHaveCount(0);
  await calculate(page);
  await expect(resultGroup(page).locator('details')).toHaveCount(2);
  await expectSavedResult(page, gasTag, gasCvs);
  await expectSavedResult(page, liquidTag, liquidCvs);
  await expect(resultGroup(page).locator('details').nth(0)).toHaveAttribute('id', `workbook-result-${encodeURIComponent(gasTag)}`);
  await expect(resultGroup(page).locator('details').nth(1)).toHaveAttribute('id', `workbook-result-${encodeURIComponent(liquidTag)}`);
  await expect(card(page, gasTag)).toContainText(/gas/i);
  await expect(card(page, liquidTag)).toContainText(/liquid/i);
  await expect(resultGroup(page).getByRole('heading', { name: displayName, exact: true })).toHaveCount(1);
  await expect(card(page, gasTag).getByRole('button', { name: /Download/i })).toHaveCount(0);
  await expect(card(page, liquidTag).getByRole('button', { name: /Download/i })).toHaveCount(0);
  await page.evaluate(() => {
    window.__printCalls = 0;
    window.print = () => { window.__printCalls += 1; };
  });
  const [pdfDownload] = await Promise.all([
    page.waitForEvent('download'),
    resultGroup(page).getByRole('button', { name: `Download ${displayName} workbook results as PDF`, exact: true }).click(),
  ]);
  expect(pdfDownload.suggestedFilename()).toBe(`${displayName}-control-valve-results.pdf`);
  const pdf = await downloadBytes(pdfDownload);
  const pdfText = pdf.toString('latin1');
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdfText).toContain(displayName);
  expect(pdfText).toContain(gasTag);
  expect(pdfText).toContain(liquidTag);
  expect(pdfText.indexOf(displayName)).toBeLessThan(pdfText.indexOf('Sheet name'));
  expect(pdfText.indexOf('Sheet name')).toBeLessThan(pdfText.indexOf(gasTag));
  expect(pdfText.indexOf(gasTag)).toBeLessThan(pdfText.indexOf(liquidTag));
  expect(pdfText).toContain('52.315');
  expect(pdfText).toContain('23.717');
  expect(pdfText).toContain('Sheet name');
  expect(pdfText).toContain('Minimum Cv');
  expect(pdfText).toContain('Normal Cv');
  expect(pdfText).toContain('Maximum Cv');
  expect(pdfText).not.toContain('(Cv result)');
  expect(pdfText).not.toContain('Operating condition');
  expect(pdfText).not.toContain('Valve 1 of 2');
  for (const operatingValue of ['18.496', '37.755', '11.18', '18.257']) {
    expect(pdfText).toContain(operatingValue);
  }
  expect(pdfText.match(/\/Type \/Page\b/g) ?? []).toHaveLength(1);

  const [wordDownload] = await Promise.all([
    page.waitForEvent('download'),
    resultGroup(page).getByRole('button', { name: `Download ${displayName} workbook results as Word`, exact: true }).click(),
  ]);
  expect(wordDownload.suggestedFilename()).toBe(`${displayName}-control-valve-results.docx`);
  const word = await downloadBytes(wordDownload);
  expect(word.subarray(0, 4).toString('hex')).toBe('504b0304');
  const wordXml = wordDocumentXml(word);
  expect(wordXml).toContain(displayName);
  expect(wordXml).toContain(gasTag);
  expect(wordXml).toContain(liquidTag);
  expect(wordXml.indexOf(displayName)).toBeLessThan(wordXml.indexOf('Sheet name'));
  expect(wordXml.indexOf('Sheet name')).toBeLessThan(wordXml.indexOf(gasTag));
  expect(wordXml.indexOf(gasTag)).toBeLessThan(wordXml.indexOf(liquidTag));
  expect(wordXml).toContain('52.315');
  expect(wordXml).toContain('23.717');
  expect(wordXml).toContain('Sheet name');
  expect(wordXml).toContain('Minimum Cv');
  expect(wordXml).toContain('Normal Cv');
  expect(wordXml).toContain('Maximum Cv');
  expect(wordXml).not.toContain('Cv result');
  expect(wordXml).not.toContain('Operating condition');
  expect(wordXml).not.toContain('Valve 1 of 2');
  for (const operatingValue of ['18.496', '37.755', '11.18', '18.257']) {
    expect(wordXml).toContain(operatingValue);
  }
  expect(wordXml).not.toMatch(/<w:br\b[^>]*w:type="page"/);
  expect(await page.evaluate(() => window.__printCalls)).toBe(0);
  await expect(page.locator('.pdf-print-portal')).toHaveCount(0);
  await card(page, gasTag).locator('.excel-result-header').click();
  await expect(card(page, gasTag).getByRole('button', { name: 'Load Into Calculator', exact: true })).not.toBeVisible();
  await expect(card(page, gasTag).locator('.excel-result-header')).toContainText(/Maximum Cv/i);
});

test('converts detected gas flow, pressure and Celsius units without treating them as calculator units', async ({ page }) => {
  const rows = gasSheet();
  setServiceRow(rows, 51, 'Gas Flow Rate', [0.144, 0.36, 0.576], 'MMSCFD');
  setServiceRow(rows, 53, 'Inlet Pressure', [120 / 14.503773773, 120 / 14.503773773, 120 / 14.503773773], 'barg');
  setServiceRow(rows, 54, 'Downstream Pressure', [100 / 14.503773773, 90 / 14.503773773, 80 / 14.503773773], 'bar(g)');
  setServiceRow(rows, 56, 'Temperature', [20, 20, 20], 'DEG C');
  await upload(page, excelFile({ [gasTag]: rows }));
  await selectSheet(page, gasTag);
  await expectInputs(page, gasValues);
  await calculate(page);
  await expectSavedResult(page, gasTag, gasCvs);
});

test('converts cubic metres per hour and bar for a liquid worksheet in a legacy xls workbook', async ({ page }) => {
  const rows = liquidSheet();
  setServiceRow(rows, 51, 'Flow Rate', [50 / 4.4028675393, 100 / 4.4028675393, 150 / 4.4028675393], 'm³/hr');
  setServiceRow(rows, 53, 'Upstream Press.', [100 / 14.503773773, 100 / 14.503773773, 100 / 14.503773773], 'bar');
  setServiceRow(rows, 54, 'Downstream Presssure', [80 / 14.503773773, 70 / 14.503773773, 60 / 14.503773773], 'bar');
  await upload(page, excelFile({ [liquidTag]: rows }, 'Legacy-Valves.XLS'));
  await selectSheet(page, liquidTag);
  await expectInputs(page, liquidValues);
  await calculate(page);
  await expectSavedResult(page, liquidTag, liquidCvs);
  await expect(resultGroup(page).getByRole('heading', { name: 'Legacy-Valves', exact: true })).toBeVisible();
});

test('requires a service choice and highlights absent inputs without inventing engineering values', async ({ page }) => {
  const unknownTag = '100-PCV-181';
  const rows = valveSheet(unknownTag, 'Not specified');
  setServiceRow(rows, 51, 'Flow Rate', [50, 100, 150]);
  setServiceRow(rows, 53, 'Upstream Press.');
  setServiceRow(rows, 54, 'Downstream Presssure');
  setServiceRow(rows, 64, 'Specific Gravity', [1, 1, 1]);
  await upload(page, excelFile({ [unknownTag]: rows }));
  await selectSheet(page, unknownTag);
  await expect(page.getByText('Service type could not be determined.', { exact: true })).toBeVisible();
  await expectNoWorkbookCalculations(page);
  await page.getByRole('button', { name: 'Liquid', exact: true }).click();
  for (const condition of conditions) {
    await expect(input(page, condition, 'Specific gravity')).toHaveValue('1');
    for (const variable of ['Flow rate', 'Upstream pressure', 'Downstream pressure']) {
      await expect(input(page, condition, variable)).toHaveValue('');
      await expect(input(page, condition, variable)).toHaveAttribute('aria-invalid', 'true');
    }
  }
  await calculate(page);
  await expectNoWorkbookCalculations(page);
  await expect(page.locator('[aria-invalid="true"]').first()).toBeFocused();
  await fillInputs(page, liquidValues);
  await expect(page.locator('.excel-import-summary')).toHaveCount(0);
  await calculate(page);
  await expectSavedResult(page, unknownTag, liquidCvs);
});

test('offers existing results and restores saved edits for deliberate recalculation without duplicate cards', async ({ page }) => {
  await upload(page);
  await selectSheet(page, liquidTag);
  await input(page, 'Minimum', 'Flow rate').fill('60');
  await calculate(page);
  const editedCvs = [13.416407864998739, liquidCvs[1], liquidCvs[2]];
  await expectSavedResult(page, liquidTag, editedCvs);
  await card(page, liquidTag).locator('.excel-result-header').click();
  await selectSheet(page, liquidTag);
  const warning = page.getByRole('dialog');
  await expect(warning).toContainText(`${liquidTag} has already been calculated`);
  await warning.getByRole('button', { name: 'View Existing Result', exact: true }).click();
  await expect(warning).toHaveCount(0);
  await expect(card(page, liquidTag).locator('.excel-result-card-body')).toBeVisible();
  await selectSheet(page, liquidTag);
  await warning.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expectSavedResult(page, liquidTag, editedCvs);
  await selectSheet(page, liquidTag);
  await warning.getByRole('button', { name: 'Recalculate', exact: true }).click();
  await expect(input(page, 'Minimum', 'Flow rate')).toHaveValue('60');
  await input(page, 'Minimum', 'Flow rate').fill('300');
  await calculate(page);
  await expect(resultGroup(page).locator('details')).toHaveCount(1);
  const recalculated = [67.08203932499369, liquidCvs[1], liquidCvs[2]];
  await expectSavedResult(page, liquidTag, recalculated);
  await selectSheet(page, gasTag);
  await expectInputs(page, gasValues);
  await card(page, liquidTag).getByRole('button', { name: 'Load Into Calculator', exact: true }).click();
  await expect(input(page, 'Minimum', 'Flow rate')).toHaveValue('300');
  await input(page, 'Minimum', 'Flow rate').fill('50');
  await expectSavedResult(page, liquidTag, recalculated);
  await calculate(page);
  await expect(warning).toBeVisible();
  await warning.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expectSavedResult(page, liquidTag, recalculated);
  await expect(resultGroup(page).locator('details')).toHaveCount(1);
});

test('confirms replacement of a workbook with results and keeps the current session when cancelled', async ({ page }) => {
  await upload(page);
  await selectSheet(page, liquidTag);
  await calculate(page);
  const nextName = 'New-Workbook.xlsx';
  const nextTag = '200-FCV-901';
  const nextFile = excelFile({ [nextTag]: liquidSheet(nextTag) }, nextName);
  await page.getByLabel('Choose Excel File', { exact: true }).setInputFiles(nextFile);
  const confirmation = page.getByRole('dialog');
  await expect(confirmation).toContainText(/will clear the current imported worksheets and calculation results/i);
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expectSavedResult(page, liquidTag, liquidCvs);
  await expect(sheetButton(page, nextTag)).toHaveCount(0);
  await page.getByLabel('Choose Excel File', { exact: true }).setInputFiles(nextFile);
  await confirmation.getByRole('button', { name: 'Load New Workbook', exact: true }).click();
  await expectNoWorkbookCalculations(page);
  await expect(sheetButton(page, liquidTag)).toHaveCount(0);
  await selectSheet(page, nextTag);
  await calculate(page);
  await expectSavedResult(page, nextTag, liquidCvs);
  await expect(resultGroup(page).getByRole('heading', { name: 'New-Workbook', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: displayName, exact: true })).toHaveCount(0);

  const [pdfDownload] = await Promise.all([
    page.waitForEvent('download'),
    resultGroup(page).getByRole('button', { name: 'Download New-Workbook workbook results as PDF', exact: true }).click(),
  ]);
  expect(pdfDownload.suggestedFilename()).toBe('New-Workbook-control-valve-results.pdf');
  const pdfText = (await downloadBytes(pdfDownload)).toString('latin1');
  expect(pdfText).toContain('New-Workbook');
  expect(pdfText).toContain(nextTag);
  expect(pdfText).toContain('Sheet name');
  expect(pdfText).toContain('Minimum Cv');
  expect(pdfText).toContain('Normal Cv');
  expect(pdfText).toContain('Maximum Cv');
  expect(pdfText).not.toContain('(Cv result)');
  expect(pdfText).toContain('11.18');
  expect(pdfText).toContain('18.257');
  expect(pdfText).toContain('23.717');
  expect(pdfText).not.toContain(displayName);
  expect(pdfText).not.toContain(liquidTag);
  expect(pdfText.match(/\/Type \/Page\b/g) ?? []).toHaveLength(1);

  const [wordDownload] = await Promise.all([
    page.waitForEvent('download'),
    resultGroup(page).getByRole('button', { name: 'Download New-Workbook workbook results as Word', exact: true }).click(),
  ]);
  expect(wordDownload.suggestedFilename()).toBe('New-Workbook-control-valve-results.docx');
  const wordXml = wordDocumentXml(await downloadBytes(wordDownload));
  expect(wordXml).toContain('New-Workbook');
  expect(wordXml).toContain(nextTag);
  expect(wordXml).toContain('Sheet name');
  expect(wordXml).toContain('Minimum Cv');
  expect(wordXml).toContain('Normal Cv');
  expect(wordXml).toContain('Maximum Cv');
  expect(wordXml).not.toContain('Cv result');
  expect(wordXml).toContain('11.18');
  expect(wordXml).toContain('18.257');
  expect(wordXml).toContain('23.717');
  expect(wordXml).not.toContain(displayName);
  expect(wordXml).not.toContain(liquidTag);
  expect(wordXml).not.toMatch(/<w:br\b[^>]*w:type="page"/);
});

test('retains the independent manual calculator session across imported calculations', async ({ page }) => {
  await fillInputs(page, liquidValues);
  await input(page, 'Minimum', 'Flow rate').fill('300');
  await calculate(page);
  await expectCv(page.getByTestId('required-cv'), 67.08203932499369);
  await upload(page);
  await selectSheet(page, gasTag);
  await calculate(page);
  await expectSavedResult(page, gasTag, gasCvs);
  await page.getByRole('button', { name: 'Manual Entry', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Liquid Service', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(input(page, 'Minimum', 'Flow rate')).toHaveValue('300');
  await expectCv(page.getByTestId('required-cv'), 67.08203932499369);
  await page.getByRole('button', { name: 'Import Excel', exact: true }).click();
  await expectSavedResult(page, gasTag, gasCvs);
});

test('rejects unsupported and malformed files without replacing the current workbook', async ({ page }) => {
  await upload(page);
  const chooser = page.getByLabel('Choose Excel File', { exact: true });
  await chooser.setInputFiles({ name: 'not-excel.txt', mimeType: 'text/plain', buffer: Buffer.from('Not a workbook') });
  await expect(page.getByRole('alert')).toContainText(/Excel|xlsx|xls|supported/i);
  await expect(sheetButton(page, gasTag)).toHaveCount(1);
  await chooser.setInputFiles({ name: 'corrupt.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('PK\u0003\u0004invalid workbook archive') });
  await expect(page.getByRole('alert')).toContainText(/invalid|unable|could not|failed|read/i);
  await expect(sheetButton(page, gasTag)).toHaveCount(1);
  await expectNoWorkbookCalculations(page);
});

test('supports keyboard selection and accessible duplicate dialogs and workbook results', async ({ page }, testInfo) => {
  await upload(page);
  const dropdown = page.getByRole('combobox', { name: 'Workbook sheets', exact: true });
  await dropdown.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(dropdown).toContainText(liquidTag);
  await calculate(page);
  await page.getByRole('button', { name: 'Open worksheet', exact: true }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
  await expect(dialog.locator(':focus')).toHaveCount(1);
  const dialogAudit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  await testInfo.attach('excel-duplicate-accessibility.json', { body: JSON.stringify(dialogAudit, null, 2), contentType: 'application/json' });
  expect(dialogAudit.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open worksheet', exact: true })).toBeFocused();
  await expectSavedResult(page, liquidTag, liquidCvs);
  const resultsAudit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  await testInfo.attach('excel-results-accessibility.json', { body: JSON.stringify(resultsAudit, null, 2), contentType: 'application/json' });
  expect(resultsAudit.violations).toEqual([]);
});

for (const width of [375, 768]) {
  test(`keeps workbook sheets, stacked results and confirmation usable at ${width}px`, async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await upload(page);
    for (const name of [gasTag, liquidTag]) {
      await selectSheet(page, name);
      await calculate(page);
    }
    await expect(resultGroup(page).locator('details')).toHaveCount(2);
    await expectSavedResult(page, gasTag, gasCvs);
    await expectSavedResult(page, liquidTag, liquidCvs);
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.width + 1);
    await page.getByLabel('Choose Excel File', { exact: true }).setInputFiles(standardWorkbook('Replacement.xlsx'));
    const confirmation = page.getByRole('dialog');
    await expect(confirmation.getByRole('button', { name: 'Load New Workbook', exact: true })).toBeVisible();
    const dialogBounds = await confirmation.boundingBox();
    expect(dialogBounds.x).toBeGreaterThanOrEqual(0);
    expect(dialogBounds.x + dialogBounds.width).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: testInfo.outputPath(`excel-workbook-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}
