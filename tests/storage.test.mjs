import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSettings, saveSettings, bestFor, recordBest } from '../src/js/platform/storage.js';
import { FIRST_LEVEL } from '../src/js/game/levels.js';

const DEFAULTS = { muted: false, music: 0.6, best: {} };
function storage(t, value) {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value });
  t.after(() => { if (before) Object.defineProperty(globalThis, 'localStorage', before); else delete globalThis.localStorage; });
}
test('blocked storage never prevents playing or finishing', t => {
  storage(t, { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  assert.deepEqual(loadSettings(), DEFAULTS);
  assert.doesNotThrow(() => saveSettings({ muted: true, best: { 'just-dig': 10 } }));
});
test('malformed and unexpected settings fall back safely', t => {
  let raw = 'not-json'; storage(t, { getItem: () => raw });
  assert.deepEqual(loadSettings(), DEFAULTS);
  raw = 'null'; assert.deepEqual(loadSettings(), DEFAULTS);
  raw = '{"muted":"false","best":"10"}'; assert.deepEqual(loadSettings(), DEFAULTS);
  raw = '{"muted":true,"best":{"just-dig":-1,"x":2.5,"y":3}}'; assert.deepEqual(loadSettings(), { muted: true, music: 0.6, best: { y: 3 } });
  raw = '{"music":2}'; assert.equal(loadSettings().music, 0.6);
  raw = '{"music":0.34}'; assert.equal(loadSettings().music, 0.3);
});
test('legacy single best is migrated to the first stage and clamped on read', t => {
  storage(t, { getItem: () => '{"muted":true,"best":999}' });
  const settings = loadSettings();
  assert.deepEqual(settings, { muted: true, music: 0.6, best: { 'just-dig': 999 } });
  assert.equal(bestFor(settings, FIRST_LEVEL), 10);
});
test('best only changes when a rescue improves it', () => {
  const settings = { muted: false, best: { 'just-dig': 5 } };
  assert.equal(recordBest(settings, FIRST_LEVEL, 3), false); assert.equal(bestFor(settings, FIRST_LEVEL), 5);
  assert.equal(recordBest(settings, FIRST_LEVEL, 7), true); assert.equal(bestFor(settings, FIRST_LEVEL), 7);
});
test('preferences round-trip through a single namespaced key', t => {
  const values = new Map(); storage(t, { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) });
  saveSettings({ muted: true, music: 0.2, best: { 'just-dig': 7 } });
  assert.deepEqual(loadSettings(), { muted: true, music: 0.2, best: { 'just-dig': 7 } });
  assert.deepEqual([...values.keys()], ['avx-lemmings-v1']);
});
