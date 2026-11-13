import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Terrain } from '../src/js/engine/terrain.js';

test('terrain clear clips its bounds without touching unrelated pixels', () => {
  const t = new Terrain(10, 10, [{ x: 0, y: 0, width: 10, height: 10 }]);
  assert.equal(t.clear(-5, -5, 8, 8), 9); assert.equal(t.solid(3, 3), true);
  assert.equal(t.solid(0, 0), false); assert.equal(t.solid(-1, 0), false);
});
test('terrain reports only real changes and their bounding region', () => {
  const t = new Terrain(20, 20, [{ x: 0, y: 10, width: 20, height: 10 }]);
  assert.equal(t.revision, 0, 'authoring is not a change');
  assert.equal(t.clear(0, 0, 20, 5), 0); assert.equal(t.revision, 0);
  assert.equal(t.changedSince(0), null);
  t.clear(2, 10, 3, 2); t.clear(8, 12, 2, 2);
  assert.deepEqual(t.changedSince(0), { x: 2, y: 10, width: 8, height: 4 });
  assert.deepEqual(t.changedSince(1), { x: 8, y: 12, width: 2, height: 2 });
  assert.equal(t.changedSince(2), null);
  t.fill(2, 10, 1, 1); assert.equal(t.solid(2, 10), true);
});
test('a viewer too far behind the change history repaints everything', () => {
  const t = new Terrain(300, 4, [{ x: 0, y: 0, width: 300, height: 4 }]);
  for (let x = 0; x < 200; x++) t.clear(x, 0, 1, 1);
  assert.deepEqual(t.changedSince(0), { x: 0, y: 0, width: 300, height: 4 });
  assert.deepEqual(t.changedSince(199), { x: 199, y: 0, width: 1, height: 1 });
  assert.deepEqual(t.changedSince(999), { x: 0, y: 0, width: 300, height: 4 });
});
test('simulation and engine modules stay free of browser and nondeterministic APIs', () => {
  const forbidden = /\b(document|window|localStorage|sessionStorage|requestAnimationFrame|setTimeout|setInterval|Math\.random|Date\.now|performance\.now|AudioContext|fetch)\b/;
  for (const dir of ['engine', 'game']) {
    const path = join(import.meta.dirname, '../src/js', dir);
    for (const file of readdirSync(path).filter(f => f.endsWith('.js'))) {
      const code = readFileSync(join(path, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      assert.doesNotMatch(code, forbidden, `${dir}/${file}`);
    }
  }
});
