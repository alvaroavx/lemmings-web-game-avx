import test from 'node:test';
import assert from 'node:assert/strict';
import { generateEasy, generateStage, shiftedProof } from '../src/js/game/stage/generate.js';
import { proofNeeds } from '../src/js/game/stage/compile.js';
import { levelErrors, LEVELS } from '../src/js/game/levels.js';
import { autoplay, withoutSkill } from '../src/js/game/autoplay.js';
import { replay } from '../src/js/game/replay.js';
import { StageGenerator } from '../src/js/platform/generator.js';
import { GameApp } from '../src/js/app/game-app.js';

const seeds = [...Array(64).keys(), 0xffffffff, 0x80000000];
test('easy routes are valid, solvable with limited inventory, and reproducible across a seed corpus', () => {
  const kinds = new Set(), orders = new Set(), maps = new Set();
  for (const seed of seeds) {
    const level = generateEasy(seed);
    assert.deepEqual(levelErrors(level), [], `seed ${seed}`);
    assert.equal(level.mode, 'random'); assert.equal(level.difficulty, 'easy'); assert.equal(level.challenges.length, 3);
    assert.equal(level.total, 10); assert.equal(level.required, 7);
    assert.deepEqual(level.skills, proofNeeds(level.proof.triggers, level.total));
    assert.equal(autoplay(level).result, 'won', `seed ${seed}`);
    Object.keys(level.skills).forEach(id => kinds.add(id));
    orders.add(level.challenges.join('/')); maps.add(JSON.stringify(level.terrain));
  }
  assert.equal(kinds.size, 8, 'all eight skills can appear');
  assert.ok(orders.size >= 25, 'combines obstacle order, not just colors');
  assert.equal(maps.size, seeds.length, 'geometry differs across this corpus');
});

test('the same seed reproduces geometry, inventory, proof and final simulation', () => {
  const before = JSON.stringify(LEVELS);
  for (const seed of [0, 2, 8, 17, 0xffffffff]) {
    const level = generateEasy(seed);
    assert.deepEqual(generateEasy(seed), level);
    const won = autoplay(level);
    assert.equal(JSON.stringify(replay(level, won.log)), JSON.stringify(won));
    for (const offset of [-8, 8]) assert.equal(autoplay(level, { triggers: shiftedProof(level, offset) }).result, 'won');
    // Easy intentionally allows alternate routes, including persistent climbing.
  }
  assert.equal(JSON.stringify(LEVELS), before, 'tutorial remains intact');
  for (const seed of [-1, 1.5, NaN, Infinity, 0x100000000, '10']) assert.throws(() => generateEasy(seed), /Semilla/);
});

test('generated results never offer tutorial stage 1 as their next stage', () => {
  const app = Object.create(GameApp.prototype); app.levels = LEVELS;
  app.level = generateEasy(0); assert.equal(app.nextLevel(), null);
  app.level = LEVELS[0]; assert.equal(app.nextLevel(), LEVELS[1]);
  app.level = LEVELS.at(-1); assert.equal(app.nextLevel(), null);
});

function workerFactory() {
  const workers = [];
  return { workers, createWorker: () => {
    const worker = { terminated: false, postMessage(seed) { this.seed = seed; }, terminate() { this.terminated = true; } };
    workers.push(worker); return worker;
  } };
}
test('generation cancellation terminates workers and ignores late replies', async () => {
  const factory = workerFactory(), generator = new StageGenerator({ ...factory, seed: () => 7 });
  const first = generator.generate(), rejected = assert.rejects(first, { name: 'AbortError' });
  const second = generator.generate(); await rejected;
  assert.ok(factory.workers[0].terminated);
  factory.workers[0].onmessage({ data: { level: { id: 'stale' } } });
  assert.equal(factory.workers[1].seed.seed, 8, 'avoids consecutive identical random seeds');
  factory.workers[1].onmessage({ data: { level: { id: 'current' } } });
  assert.deepEqual(await second, { id: 'current' }); assert.ok(factory.workers[1].terminated);
  const third = generator.generate(), cancelled = assert.rejects(third, { name: 'AbortError' });
  generator.cancel(); await cancelled; assert.equal(generator.pending, null);
});
test('worker failure, invalid message and timeout release the worker and permit retry', async () => {
  const factory = workerFactory(), generator = new StageGenerator({ ...factory, seed: () => 9, timeout: 10 });
  const failed = generator.generate(); factory.workers[0].onerror(); await assert.rejects(failed);
  const rejected = generator.generate(); factory.workers[1].onmessage({ data: { error: 'No hay ruta válida' } });
  await assert.rejects(rejected, /ruta válida/);
  const invalid = generator.generate(); factory.workers[2].onmessageerror(); await assert.rejects(invalid);
  const timedOut = generator.generate(); await assert.rejects(timedOut, /tardó/);
  assert.ok(factory.workers.every(w => w.terminated)); assert.equal(generator.pending, null);
});

test('spending the only dig at the hatch loses instead of receiving extra uses', () => {
  const level = generateEasy(0);
  const failed = autoplay(level, { triggers: [{ skill: 'dig', x: 110, y: 100, who: 'one' }, ...level.proof.triggers] });
  assert.equal(failed.result, 'lost'); assert.equal(failed.inventory.dig, 0);
  assert.ok(failed.saved < level.required); assert.ok(failed.time < level.seconds);
});

for (const difficulty of ['normal', 'hard']) {
  test(`${difficulty}: limited traits, verified obstacles and repeated command logs`, () => {
    const counts = new Set();
    for (const seed of [0, 1, 2, 3, 7, 11, 17, 31, 63, 0xffffffff]) {
      const level = generateStage(seed, difficulty);
      counts.add(level.challenges.length);
      assert.equal(level.singleUseSkills, true);
      assert.equal(level.difficulty, difficulty);
      assert.deepEqual(levelErrors(level), []);
      assert.deepEqual(level.skills, proofNeeds(level.proof.triggers, level.total));
      assert.ok(difficulty === 'hard' ? level.challenges.length > 5 : level.challenges.length >= 3 && level.challenges.length <= 5);
      if (difficulty === 'hard') {
        assert.equal(level.platformTiers, 3); assert.equal(level.required, 9);
        const floors = new Set(level.terrain.filter(r => r.width >= 100 && r.height === 16).map(r => r.y));
        assert.equal(floors.size, 3, 'three real main platform heights, not just metadata');
      }
      const won = autoplay(level);
      assert.equal(won.result, 'won');
      assert.equal(JSON.stringify(replay(level, won.log)), JSON.stringify(won));
      for (const lock of new Set(level.proof.triggers.map(t => t.lock))) {
        assert.equal(autoplay(level, { triggers: level.proof.triggers.filter(t => t.lock !== lock) }).result, 'lost');
      }
    }
    assert.ok(counts.size > 1, 'varies the challenge count');
  });
}
