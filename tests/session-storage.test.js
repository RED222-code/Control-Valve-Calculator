import test from 'node:test';
import assert from 'node:assert/strict';
import { saveSession, loadSession, clearSession } from '../src/utils/sessionStorage.js';
import { createSession } from '../src/data/serviceConfig.js';

test('stores and restores a versioned manual session and clears it', () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const data = { service: 'gas', manualService: 'gas', inputSource: 'manual',
    sessions: { liquid: createSession(), gas: createSession() },
    workbook: { workbookSession: null, currentSheetName: null, pendingImport: null } };
  data.sessions.gas.data.normal.Q = '125';
  assert.equal(saveSession(data), true);
  assert.deepEqual(loadSession(), data);
  assert.equal(JSON.parse(values.get('controlValveSizingSession')).version, 1);
  clearSession();
  assert.equal(loadSession(), null);
  delete globalThis.localStorage;
});

test('storage denial and quota failures do not throw', () => {
  globalThis.localStorage = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('quota'); },
    removeItem() { throw new Error('denied'); },
  };
  assert.equal(loadSession(), null);
  assert.equal(saveSession({}), false);
  assert.equal(clearSession(), false);
  delete globalThis.localStorage;
});
