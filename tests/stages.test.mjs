import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, levelErrors } from '../src/js/game/levels.js';
import { compileStage, proofNeeds } from '../src/js/game/stage/compile.js';
import { autoplay, withoutSkill } from '../src/js/game/autoplay.js';
import { replay } from '../src/js/game/replay.js';

// ── Every stage carries its own proof ─────────────────────────────────────────
test('the campaign has ten numbered stages with unique ids', () => {
  assert.deepEqual(LEVELS.map(l => l.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(new Set(LEVELS.map(l => l.id)).size, LEVELS.length);
});
for (const level of LEVELS) {
  test(`stage ${level.number} (${level.id}): proof wins, replays exactly and every skill it uses is necessary`, () => {
    assert.deepEqual(levelErrors(level), []);
    const needs = proofNeeds(level.proof.triggers, level.total);
    for (const [skill, n] of Object.entries(needs)) assert.ok(level.skills[skill] >= n, `${skill}: ${n} > inventario`);
    const won = autoplay(level);
    assert.equal(won.result, 'won');
    assert.ok(won.saved >= level.proof.saves, `salva ${won.saved}, la prueba promete ${level.proof.saves}`);
    assert.equal(JSON.stringify(replay(level, won.log)), JSON.stringify(won), 'el registro reproduce la partida');
    for (const skill of Object.keys(needs)) {
      const without = withoutSkill(level, skill);
      assert.ok(without.saved < level.required, `sin ${skill} se salvan ${without.saved} y bastaría con ${level.required}`);
    }
  });
}

// ── The compiler refuses broken stages with readable reasons ──────────────────
const base = { id: 'probe', number: 0, name: 'Prueba', width: 600, height: 300, total: 4, required: 1, seconds: 60, skills: {} };
const errorsOf = (course, extra = {}) => compileStage({ ...base, ...extra, course: [['start'], ['hatch'], ...course, ['exit']] }).authoring;
test('a lock without a key is an authoring error', () => {
  assert.match(errorsOf([['drop', { down: 200 }]]).join(), /cerradura sin llave/);
  assert.match(errorsOf([['wall', { height: 30 }]]).join(), /cerradura sin llave/);
  assert.deepEqual(errorsOf([['drop', { down: 60 }], ['run', { length: 50 }]]), [], 'a safe drop needs no key');
});
test('keys must fit the lock, the material and the inventory', () => {
  assert.match(errorsOf([['drop', { down: 200, key: 'dig' }]]).join(), /no abre/);
  assert.match(errorsOf([['wall', { height: 30, material: 'steel', key: 'bash' }]], { skills: { bash: 1 } }).join(), /acero/);
  assert.match(errorsOf([['wall', { height: 30, key: 'bash' }]]).join(), /inventario tiene 0/);
  assert.match(errorsOf([['drop', { down: 200, key: 'float' }]], { skills: { float: 3 } }).join(), /4 × float/);
  assert.match(errorsOf([['bogus']]).join(), /desconocida/);
});
test('invalid compiled stages never reach World', () => {
  const broken = compileStage({ ...base, course: [['start'], ['hatch'], ['drop', { down: 200 }], ['exit']] });
  assert.ok(levelErrors(broken).length > 0);
});
test('pieces lay geometry relative to the turtle and emit a proof per key', () => {
  const level = compileStage({ ...base, skills: { dig: 1 }, origin: { x: 50, y: 100 },
    course: [['start'], ['hatch', { length: 100 }], ['descend', { length: 120, thick: 20, down: 30, at: 40, key: 'dig' }], ['exit']] });
  assert.deepEqual(level.authoring, []);
  assert.deepEqual(level.hatches, [{ x: 90, y: 50 }]);
  assert.deepEqual(level.exits, [{ x: 190, y: 150, width: 25 }]);
  assert.deepEqual(level.proof.triggers, [{ skill: 'dig', x: 190, y: 100, who: 'one', lock: 2 }]);
  assert.equal(autoplay(level).result, 'won');
});
