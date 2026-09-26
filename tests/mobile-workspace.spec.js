import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as XLSX from 'xlsx';
import { put, templateSheet } from './template-fixture.js';

const conditions = ['Minimum', 'Normal', 'Maximum'];
const values = {
  liquid: {
    Q: [50, 100, 150],
    P1: [100, 100, 100],
    P2: [80, 70, 60],
    SG: [1, 1, 1],
  },
  gas: {
    Q: [100, 250, 400],
    P1: [120, 120, 120],
    P2: [100, 90, 80],
    SG: [0.65, 0.65, 0.65],
    Y: [0.95, 0.95, 0.95],
    Z: [1, 1, 1],
    T: [68, 68, 68],
  },
};
const fieldLabels = {
  Q: 'flow rate', P1: 'upstream pressure', P2: 'downstream pressure',
  SG: 'specific gravity', Y: 'expansion factor', Z: 'compressibility factor', T: 'temperature',
};
const expectedCvs = {
  liquid: [11.180339887498949, 18.257418583505537, 23.717082451262847],
  gas: [18.49608777979535, 37.754981081854986, 52.3148363780597],
};

function input(page, service, condition, field) {
  return page.locator(`#${service}-${condition.toLowerCase()}-${field}`);
}

async function expectUsableLayout(page, service, width) {
  const pageDimensions = await page.evaluate(() => ({
    available: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(pageDimensions.content).toBeLessThanOrEqual(pageDimensions.available + 1);
  await expect(page.locator('.sizing-table input')).toHaveCount(Object.keys(values[service]).length * 3);

  for (const field of Object.keys(values[service])) {
    for (const condition of conditions) {
      const control = input(page, service, condition, field);
      await expect(control).toHaveCount(1);
      await expect(control).toBeVisible();
      await expect(control).toHaveAccessibleName(new RegExp(`^${condition} (?:Gas )?${fieldLabels[field]}$`, 'i'));
      if (width <= 700) {
        const bounds = await control.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
      }
    }
  }

  if (width <= 700) {
    const tableDimensions = await page.locator('.table-scroll').evaluate(element => ({
      available: element.clientWidth, content: element.scrollWidth,
    }));
    expect(tableDimensions.content).toBeLessThanOrEqual(tableDimensions.available + 1);
    for (const control of await page.locator('.workspace-toolbar button, .sizing-table select, .form-actions button').all()) {
      const bounds = await control.boundingBox();
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.width).toBeGreaterThanOrEqual(44);
    }
  }
}

async function expectStickySwitches(page) {
  await page.evaluate(() => window.scrollTo({ top: 650, behavior: 'instant' }));
  await expect.poll(() => page.locator('.workspace-toolbar').evaluate(element => element.getBoundingClientRect().top))
    .toBeCloseTo(0, 0);
  for (const control of [
    page.getByRole('button', { name: 'Manual Entry', exact: true }),
    page.getByRole('button', { name: 'Import Excel', exact: true }),
    page.getByRole('tab', { name: 'Liquid Service', exact: true }),
    page.getByRole('tab', { name: 'Gas Service', exact: true }),
  ]) {
    await expect(control).toBeInViewport();
    expect(await control.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
      return element === hit || element.contains(hit);
    })).toBe(true);
  }
}

async function fillAndCalculate(page, service) {
  for (const [field, operatingValues] of Object.entries(values[service])) {
    for (const [index, condition] of conditions.entries()) {
      await input(page, service, condition, field).fill(String(operatingValues[index]));
    }
  }
  await page.getByRole('button', { name: 'Calculate Cv', exact: true }).click();
  await expectResults(page, service);
}

async function expectResults(page, service) {
  for (const [index, condition] of conditions.entries()) {
    const text = await page.getByTestId(`${condition.toLowerCase()}-cv`).innerText();
    expect(Number(text.replaceAll(',', ''))).toBeCloseTo(expectedCvs[service][index], 2);
  }
}

for (const width of [320, 375, 768, 1440]) {
  test(`calculator remains operable with sticky switches at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expectUsableLayout(page, 'liquid', width);
    await expectStickySwitches(page);

    await page.getByRole('button', { name: 'Calculate Cv', exact: true }).click();
    const firstError = input(page, 'liquid', 'Minimum', 'Q');
    await expect(firstError).toBeFocused();
    await expect(firstError).toHaveAttribute('aria-invalid', 'true');
    await expect.poll(() => firstError.evaluate(element => {
      const toolbar = document.querySelector('.workspace-toolbar').getBoundingClientRect();
      return element.getBoundingClientRect().top - toolbar.bottom;
    })).toBeGreaterThanOrEqual(0);
    await expectUsableLayout(page, 'liquid', width);

    await fillAndCalculate(page, 'liquid');
    await page.getByRole('combobox', { name: 'Flow rate unit', exact: true }).selectOption('L/min');
    await page.getByRole('combobox', { name: 'Upstream pressure unit', exact: true }).selectOption('bar');
    await expect(page.getByRole('combobox', { name: 'Downstream pressure unit', exact: true })).toHaveValue('bar');
    await page.getByRole('button', { name: 'Calculate Cv', exact: true }).click();
    await expectResults(page, 'liquid');

    await expectStickySwitches(page);
    await page.getByRole('tab', { name: 'Gas Service', exact: true }).click();
    await expectUsableLayout(page, 'gas', width);
    await fillAndCalculate(page, 'gas');
    await page.getByRole('combobox', { name: 'Temperature unit', exact: true }).selectOption('C');
    await expect(input(page, 'gas', 'Normal', 'T')).toHaveValue('20');
    await page.getByRole('combobox', { name: 'Gas flow rate unit', exact: true }).selectOption('SCFH');
    await page.getByRole('button', { name: 'Calculate Cv', exact: true }).click();
    await expectResults(page, 'gas');
    await expectUsableLayout(page, 'gas', width);

    await expectStickySwitches(page);
    await page.getByRole('button', { name: 'Import Excel', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Import Excel workbook', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Manual Entry', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Gas Service', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expectResults(page, 'gas');
    await page.getByRole('tab', { name: 'Liquid Service', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Flow rate unit', exact: true })).toHaveValue('L/min');
    await expectResults(page, 'liquid');
  });
}

test('mobile calculator retains accessible controls and errors in both service views', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/');
  for (const service of ['liquid', 'gas']) {
    await page.getByRole('tab', { name: `${service === 'liquid' ? 'Liquid' : 'Gas'} Service`, exact: true }).click();
    await page.getByRole('button', { name: 'Calculate Cv', exact: true }).click();
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(audit.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
  }
});

test('mobile workbook returns to worksheet selection after calculating', async ({ page }, testInfo) => {
  const sheetNames = ['Gas valve 001', 'Gas valve 002'];
  const workbook = XLSX.utils.book_new();
  for (const name of sheetNames) {
    const sheet = templateSheet();
    put(sheet, 'K3', name);
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }

  await page.setViewportSize({ width: 375, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Import Excel', exact: true }).click();
  await page.getByLabel('Choose Excel File', { exact: true }).setInputFiles({
    name: 'Mobile-Valves.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }),
  });
  const dropdown = page.getByRole('combobox', { name: 'Workbook sheets', exact: true });
  await dropdown.click();
  await page.getByRole('option', { name: sheetNames[0], exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Gas Service', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(input(page, 'gas', 'Minimum', 'SG')).toHaveValue('');
  for (const [field, operatingValues] of Object.entries(values.gas)) {
    for (const [index, condition] of conditions.entries()) {
      await input(page, 'gas', condition, field).fill(String(operatingValues[index]));
    }
  }
  await page.getByRole('button', { name: 'Calculate Cv', exact: true }).click();

  const resultGroup = page.getByRole('region', { name: 'Workbook calculation results', exact: true });
  const resultCard = resultGroup.locator('details');
  await expect(resultCard).toHaveCount(1);
  await expect(resultCard.locator('.excel-result-card-body')).toBeVisible();
  for (const [index, condition] of conditions.entries()) {
    const text = await resultCard.getByLabel(`${condition} Cv result`, { exact: true }).innerText();
    expect(Number(text.replaceAll(',', ''))).toBeCloseTo(expectedCvs.gas[index], 2);
  }
  await resultGroup.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('mobile-workbook-results.png') });

  await resultGroup.getByRole('button', { name: 'Download Mobile-Valves workbook results', exact: true }).click();
  await expect(page.getByRole('button', { name: 'PDF', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Word', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'PDF', exact: true })).toBeHidden();

  await resultGroup.getByRole('button', { name: 'Select Another Sheet', exact: true }).click();
  await expect(dropdown).toBeFocused();
  await expect(dropdown).toBeInViewport();
  await expect.poll(() => dropdown.evaluate(element => {
    const toolbar = document.querySelector('.workspace-toolbar').getBoundingClientRect();
    return element.getBoundingClientRect().top - toolbar.bottom;
  })).toBeGreaterThanOrEqual(0);
  await dropdown.click();
  await expect(page.getByRole('listbox', { name: 'Workbook sheets', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mobile-workbook-sheet-selection.png') });
  await page.getByRole('option', { name: sheetNames[1], exact: true }).click();
  await expect(dropdown).toContainText(sheetNames[1]);
  await expect(resultCard).toContainText(sheetNames[0]);
  await expect(input(page, 'gas', 'Minimum', 'SG')).toHaveValue('');
  await expectUsableLayout(page, 'gas', 375);
});
