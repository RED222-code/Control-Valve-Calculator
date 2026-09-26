import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';

const conditions = ['Minimum', 'Normal', 'Maximum'];
const liquidFields = ['Flow rate', 'Upstream pressure', 'Downstream pressure', 'Specific gravity'];
const input = (page, condition, variable) => {
  const field = page.getByLabel(`${condition} ${variable}`, { exact: true });
  return ['Flow rate', 'Specific gravity'].includes(variable)
    ? field.or(page.getByLabel(`${condition} Gas ${variable.toLowerCase()}`, { exact: true }))
    : field;
};
const requiredCv = (page) => page.getByTestId('required-cv');

async function fillOperatingConditions(page, mode = 'Liquid') {
  await page.getByRole('tab', { name: `${mode} Service`, exact: true }).click();
  const values = mode === 'Liquid'
    ? {
      'Flow rate': [50, 100, 150],
      'Upstream pressure': [100, 100, 100],
      'Downstream pressure': [80, 70, 60],
      'Specific gravity': [1, 1, 1],
    }
    : {
      'Flow rate': [100, 250, 400],
      'Upstream pressure': [120, 120, 120],
      'Downstream pressure': [100, 90, 80],
      'Specific gravity': [0.65, 0.65, 0.65],
      'Expansion factor': [0.95, 0.95, 0.95],
      'Compressibility factor': [1, 1, 1],
      Temperature: [68, 68, 68],
    };
  for (const [variable, conditionValues] of Object.entries(values)) {
    for (const [index, condition] of conditions.entries()) {
      await input(page, condition, variable).fill(String(conditionValues[index]));
    }
  }
}

async function calculate(page) {
  await page.getByRole('button', { name: 'Calculate Cv', exact: true }).click();
}

async function expectCv(page, id, expected) {
  const output = page.getByTestId(id);
  await expect(output).toBeVisible();
  const displayed = Number((await output.innerText()).replaceAll(',', '').trim());
  expect(Number.isFinite(displayed)).toBe(true);
  // Display rounding may use either two or three decimal places.
  expect(Math.abs(displayed - expected)).toBeLessThanOrEqual(0.0051);
}

async function expectNoCalculatedResults(page) {
  const results = await requiredCv(page).allTextContents();
  expect(results.join('')).not.toMatch(/\d|NaN|Infinity/);
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

test('keeps the calculator free of secondary instructional copy', async ({ page }) => {
  const removedCopy = [
    'Enter your liquid service values for each operating point.',
    'LIQUID SIZING',
    'User input',
    'Automatically calculated',
    'Full precision retained in calculations',
    'All three conditions are required.',
    'Awaiting calculation',
    'This is a calculated flow coefficient. Final valve selection may require additional engineering margin and manufacturer valve data.',
    'Built for clarity. Calculated with care.',
    'Version 1.0',
  ];

  for (const copy of removedCopy) {
    await expect(page.getByText(copy, { exact: true })).toHaveCount(0);
  }

  await expect(page.locator('.section-index')).toHaveCount(0);
  await page.getByRole('button', { name: 'Import Excel', exact: true }).click();

  const removedImportCopy = [
    'Select a worksheet, review its values in the calculator, then calculate each valve individually.',
    '.xlsx, .xls, .xlsm or .xlsb · One workbook at a time',
    'Your Excel file is processed locally in your browser and is not uploaded or stored.',
    'BROWSER ONLY',
  ];

  for (const copy of removedImportCopy) {
    await expect(page.getByText(copy, { exact: true })).toHaveCount(0);
  }

  await expect(page.getByRole('heading', { name: 'Import Excel workbook', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose Excel File', exact: true })).toBeVisible();
});

test('opens with a blank liquid table and calculates only on request', async ({ page }) => {
  await expect(page.getByRole('tab', { name: 'Liquid Service', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Minimum Expansion factor', { exact: true })).toHaveCount(0);
  for (const condition of conditions) {
    for (const variable of liquidFields) {
      await expect(input(page, condition, variable)).toHaveValue('');
    }
  }
  await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download Word', exact: true })).toHaveCount(0);
  await expectNoCalculatedResults(page);
  await fillOperatingConditions(page);
  await expectNoCalculatedResults(page);
  await expect(page.getByLabel('Minimum pressure drop', { exact: true })).toHaveText('20');
  await expect(page.getByLabel('Normal pressure drop', { exact: true })).toHaveText('30');
  await expect(page.getByLabel('Maximum pressure drop', { exact: true })).toHaveText('40');
  await calculate(page);
  await expectCv(page, 'minimum-cv', 11.180339887498949);
  await expectCv(page, 'normal-cv', 18.257418583505537);
  await expectCv(page, 'maximum-cv', 23.717082451262847);
  await expectCv(page, 'required-cv', 23.717082451262847);
  await expect(page.getByRole('heading', { name: 'Maximum Calculated Cv', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download Word', exact: true })).toBeVisible();
});

test('downloads the result section directly as PDF and Word without printing the page', async ({ page }) => {
  const originalTitle = await page.title();
  await fillOperatingConditions(page);
  await calculate(page);
  await page.evaluate(() => {
    window.__printCalls = 0;
    window.print = () => { window.__printCalls += 1; };
  });

  await page.getByRole('button', { name: 'Download', exact: true }).click();
  const [pdfDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF', exact: true }).click(),
  ]);
  expect(pdfDownload.suggestedFilename()).toBe('control-valve-liquid-cv-result.pdf');
  const pdf = await downloadBytes(pdfDownload);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.toString('latin1')).toContain('Maximum Cv');
  expect(pdf.toString('latin1')).not.toContain('WORKBOOK NAME');
  expect(pdf.toString('latin1')).toContain('23.717');
  expect(pdf.toString('latin1')).toContain('Flow rate');
  expect(pdf.toString('latin1')).toContain('Upstream pressure');
  expect(pdf.subarray(-1_024).toString('latin1')).toContain('%%EOF');

  await page.getByRole('button', { name: 'Download', exact: true }).click();
  const [wordDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Word', exact: true }).click(),
  ]);
  expect(wordDownload.suggestedFilename()).toBe('control-valve-liquid-cv-result.docx');
  const word = await downloadBytes(wordDownload);
  expect(word.subarray(0, 4).toString('hex')).toBe('504b0304');
  const wordXml = wordDocumentXml(word);
  expect(wordXml).toContain('Maximum Cv');
  expect(wordXml).not.toContain('Workbook calculation summary');
  expect(wordXml).toContain('Manual calculation');
  expect(wordXml).toContain('23.717');
  expect(wordXml).toContain('Flow rate');
  expect(wordXml).toContain('Upstream pressure');
  expect(wordXml).toContain('gpm');

  expect(await page.evaluate(() => window.__printCalls)).toBe(0);
  await expect(page.locator('.pdf-print-portal')).toHaveCount(0);
  await expect(page).toHaveTitle(originalTitle);
});

test('finds the largest computed result even when it is the Minimum condition', async ({ page }) => {
  await fillOperatingConditions(page);
  await input(page, 'Minimum', 'Flow rate').fill('300');
  await calculate(page);
  await expectCv(page, 'minimum-cv', 67.08203932499369);
  await expectCv(page, 'normal-cv', 18.257418583505537);
  await expectCv(page, 'maximum-cv', 23.717082451262847);
  await expectCv(page, 'required-cv', 67.08203932499369);
});

test('calculates all three gas conditions and explains the simplified method', async ({ page }) => {
  await fillOperatingConditions(page, 'Gas');
  await calculate(page);
  await expectCv(page, 'minimum-cv', 18.49608777979535);
  await expectCv(page, 'normal-cv', 37.754981081854986);
  await expectCv(page, 'maximum-cv', 52.31483637805970);
  await expectCv(page, 'required-cv', 52.31483637805970);
  await expect(page.getByText(/simplified sizing method/i).first()).toBeVisible();
  await expect(page.getByText(/IEC\/ISA|IEC.*ISA/).first()).toBeVisible();
});

test('keeps service inputs and completed results separate', async ({ page }) => {
  await fillOperatingConditions(page);
  await input(page, 'Minimum', 'Flow rate').fill('300');
  await calculate(page);
  await page.getByRole('tab', { name: 'Gas Service', exact: true }).click();
  await expect(input(page, 'Minimum', 'Flow rate')).toHaveValue('');
  await expectNoCalculatedResults(page);
  await fillOperatingConditions(page, 'Gas');
  await calculate(page);
  await page.getByRole('tab', { name: 'Liquid Service', exact: true }).click();
  await expect(input(page, 'Minimum', 'Flow rate')).toHaveValue('300');
  await expectCv(page, 'required-cv', 67.08203932499369);
  await page.getByRole('tab', { name: 'Gas Service', exact: true }).click();
  await expectCv(page, 'required-cv', 52.31483637805970);
});

test('clears stale results on an edit and resets the current service only', async ({ page }) => {
  await fillOperatingConditions(page, 'Gas');
  await calculate(page);
  await fillOperatingConditions(page);
  await calculate(page);
  await input(page, 'Normal', 'Flow rate').fill('110');
  await expectNoCalculatedResults(page);
  await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download Word', exact: true })).toHaveCount(0);
  await calculate(page);
  await expectCv(page, 'normal-cv', 20.08316044185609);
  await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download Word', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  for (const condition of conditions) {
    for (const variable of liquidFields) {
      await expect(input(page, condition, variable)).toHaveValue('');
    }
  }
  await expectNoCalculatedResults(page);
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Gas Service', exact: true }).click();
  await expect(input(page, 'Normal', 'Flow rate')).toHaveValue('250');
  await expectCv(page, 'required-cv', 52.31483637805970);
});

test('reports blank required inputs inline and focuses the first invalid field', async ({ page }) => {
  await calculate(page);
  await expect(input(page, 'Minimum', 'Flow rate')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[aria-invalid="true"]').first()).toBeFocused();
  await expect(input(page, 'Minimum', 'Flow rate')).toHaveAccessibleDescription(/required|enter|number/i);
  await expectNoCalculatedResults(page);
});

for (const scenario of [
  { name: 'negative flow', variable: 'Flow rate', value: '-1', error: /negative|zero|0/i },
  { name: 'zero specific gravity', variable: 'Specific gravity', value: '0', error: /greater than|positive/i },
  { name: 'non-numeric text', variable: 'Flow rate', value: 'water', error: /number|numeric/i },
  { name: 'non-finite input', variable: 'Flow rate', value: '1e309', error: /number|numeric|finite|large/i },
]) {
  test(`rejects ${scenario.name} without rendering invalid results`, async ({ page }) => {
    await fillOperatingConditions(page);
    const field = input(page, 'Minimum', scenario.variable);
    await field.fill(scenario.value);
    await calculate(page);
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(scenario.error);
    await expect(field).toBeFocused();
    await expectNoCalculatedResults(page);
    await expect(page.getByRole('region', { name: 'Calculation results' })).not.toContainText(/NaN|Infinity/);
  });
}

for (const pressure of ['80', '70']) {
  test(`rejects upstream pressure ${pressure} at downstream pressure 80`, async ({ page }) => {
    await fillOperatingConditions(page);
    await input(page, 'Minimum', 'Upstream pressure').fill(pressure);
    await calculate(page);
    await expect(page.locator('[aria-invalid="true"]').first()).toBeFocused();
    await expect(page.getByText(/upstream pressure must be greater than downstream pressure/i).first()).toBeVisible();
    await expectNoCalculatedResults(page);
  });
}

test('accepts zero flow for all conditions', async ({ page }) => {
  await fillOperatingConditions(page);
  for (const condition of conditions) {
    await input(page, condition, 'Flow rate').fill('0');
  }
  await calculate(page);
  await expectCv(page, 'minimum-cv', 0);
  await expectCv(page, 'normal-cv', 0);
  await expectCv(page, 'maximum-cv', 0);
  await expectCv(page, 'required-cv', 0);
});

for (const variable of ['Expansion factor', 'Compressibility factor']) {
  test(`rejects a non-positive gas ${variable.toLowerCase()}`, async ({ page }) => {
    await fillOperatingConditions(page, 'Gas');
    const field = input(page, 'Normal', variable);
    await field.fill('0');
    await calculate(page);
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(/greater than|positive/i);
    await expect(field).toBeFocused();
    await expectNoCalculatedResults(page);
  });
}

test('converts temperature units while preserving the physical temperature', async ({ page }) => {
  await fillOperatingConditions(page, 'Gas');
  await calculate(page);
  await page.getByLabel('Temperature unit', { exact: true }).selectOption('K');
  for (const condition of conditions) {
    expect(Number(await input(page, condition, 'Temperature').inputValue())).toBeCloseTo(293.15, 2);
  }
  await calculate(page);
  // Temperature is collected for context; it is absent from this simplified equation.
  await expectCv(page, 'required-cv', 52.31483637805970);
  await page.getByLabel('Temperature unit', { exact: true }).selectOption('F');
  expect(Number(await input(page, 'Minimum', 'Temperature').inputValue())).toBeCloseTo(68, 2);
});

test('unit selectors preserve calculated Cv and restore selected units', async ({ page }) => {
  await fillOperatingConditions(page);
  await page.getByLabel('Flow rate unit', { exact: true }).selectOption('m³/h');
  await page.getByLabel('Upstream pressure unit', { exact: true }).selectOption('bar');
  await expect(page.getByLabel('Downstream pressure unit', { exact: true })).toHaveValue('bar');
  await calculate(page);
  await expectCv(page, 'required-cv', 23.717082451262847);
  await page.reload();
  await expect(page.getByLabel('Flow rate unit', { exact: true })).toHaveValue('m³/h');
  await expect(page.getByLabel('Upstream pressure unit', { exact: true })).toHaveValue('bar');
  await calculate(page);
  await expectCv(page, 'required-cv', 23.717082451262847);
  await fillOperatingConditions(page, 'Gas');
  await page.getByLabel('Temperature unit', { exact: true }).selectOption('C');
  await expect(input(page, 'Minimum', 'Temperature')).toHaveValue('20');
  await page.getByLabel('Gas flow rate unit', { exact: true }).selectOption('SCFH');
  await page.getByLabel('Upstream pressure unit', { exact: true }).selectOption('kPa');
  await calculate(page);
  await expectCv(page, 'required-cv', 52.31483637805970);
  await input(page, 'Minimum', 'Temperature').fill('-273.15');
  await calculate(page);
  await expect(input(page, 'Minimum', 'Temperature')).toHaveAttribute('aria-invalid', 'true');
});

for (const temperature of [{ unit: 'F', value: '-459.67' }, { unit: 'K', value: '0' }]) {
  test(`rejects gas temperature at absolute zero in ${temperature.unit}`, async ({ page }) => {
    await fillOperatingConditions(page, 'Gas');
    await page.getByLabel('Temperature unit', { exact: true }).selectOption(temperature.unit);
    const field = input(page, 'Minimum', 'Temperature');
    await field.fill(temperature.value);
    await calculate(page);
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(/absolute zero|greater than|above/i);
    await expect(field).toBeFocused();
    await expectNoCalculatedResults(page);
  });
}

test('supports keyboard navigation between service tabs', async ({ page }) => {
  const liquid = page.getByRole('tab', { name: 'Liquid Service', exact: true });
  const gas = page.getByRole('tab', { name: 'Gas Service', exact: true });
  await liquid.focus();
  await page.keyboard.press('ArrowRight');
  await expect(gas).toBeFocused();
  await expect(gas).toHaveAttribute('aria-selected', 'true');
  await expect(input(page, 'Minimum', 'Expansion factor')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(liquid).toBeFocused();
  await expect(liquid).toHaveAttribute('aria-selected', 'true');
});

test('has no WCAG A/AA violations in both completed service views', async ({ page }, testInfo) => {
  const violations = [];
  for (const mode of ['Liquid', 'Gas']) {
    await fillOperatingConditions(page, mode);
    await calculate(page);
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    await testInfo.attach(`${mode.toLowerCase()}-accessibility.json`, {
      body: JSON.stringify(audit, null, 2),
      contentType: 'application/json',
    });
    violations.push(...audit.violations.map((violation) => ({
      mode,
      rule: violation.id,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        message: node.failureSummary,
      })),
    })));
  }
  expect(violations).toEqual([]);
});

for (const width of [375, 768]) {
  test(`works at ${width}px without horizontal page overflow`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    for (const mode of ['Liquid', 'Gas']) {
      await fillOperatingConditions(page, mode);
      await calculate(page);
      await expect(requiredCv(page)).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(dimensions.content).toBeLessThanOrEqual(dimensions.width + 1);
      await page.screenshot({ path: testInfo.outputPath(`${mode.toLowerCase()}-${width}.png`), fullPage: true });
    }
  });
}

test('renders a clean desktop view without runtime errors', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  await fillOperatingConditions(page);
  await calculate(page);
  await page.screenshot({ path: testInfo.outputPath('liquid-desktop.png'), fullPage: true });
  await fillOperatingConditions(page, 'Gas');
  await calculate(page);
  await page.screenshot({ path: testInfo.outputPath('gas-desktop.png'), fullPage: true });
  expect(errors).toEqual([]);
});
