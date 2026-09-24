import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const edgeInstalled = process.platform === 'win32'
  && existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL
  || (edgeInstalled ? 'msedge' : undefined);
const serverPort = Number(process.env.PLAYWRIGHT_PORT || 5173);
if (!Number.isInteger(serverPort) || serverPort < 1024 || serverPort > 65535) throw new Error('PLAYWRIGHT_PORT must be a valid port from 1024 to 65535.');
const serverUrl = `http://127.0.0.1:${serverPort}`;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: serverUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      channel: browserChannel,
      viewport: { width: 1440, height: 1000 },
    },
  }],
  webServer: {
    command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run dev -- --port ${serverPort} --strictPort`,
    url: serverUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
