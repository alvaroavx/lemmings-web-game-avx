import test from 'node:test';
import assert from 'node:assert/strict';
import { World, RULES } from '../src/js/game/world.js';
import { FIRST_LEVEL, LEVELS, levelErrors } from '../src/js/game/levels.js';
import { replay } from '../src/js/game/replay.js';
import { Clock } from '../src/js/engine/clock.js';

function run(world, seconds, act = () => {}) {
  for (let i = 0; i < seconds * 60 && !world.result; i++) { act(world); world.update(1 / 60); world.drainEvents(); }
  return world;
}
function solution(w) {
  if (w.diggers !== w.level.skills.dig) return;
  const first = w.lemmings[0];
  if (first?.state === 'walking' && first.x >= 262) w.dig(first.id);
}
// Small flat arena for movement rules: ground at y = 50.
const arena = (terrain, extra = {}) => ({
  id: 'arena', number: 0, name: 'Arena', width: 200, height: 80, total: 1, required: 0, seconds: 60, rate: 50,
  skills: { dig: 1 }, spawn: { x: 20, y: 40 }, exit: { x: 190, y: 50, width: 4 },
  terrain: [{ x: 0, y: 50, width: 200, height: 30 }, ...terrain], ...extra,
});
const walkerOn = level => {
  const w = new World(level);
  w.spawn(); const l = w.lemmings[0]; l.state = 'walking'; l.y = 50; l.x = 20;
  return { w, l };
};

test('every authored level validates', () => {
  for (const level of LEVELS) assert.deepEqual(levelErrors(level), [], level.id);
});
test('invalid levels are rejected with readable reasons', () => {
  assert.ok(levelErrors({ ...FIRST_LEVEL, required: 11 }).some(e => e.includes('objetivo')));
  assert.ok(levelErrors({ ...FIRST_LEVEL, spawn: { x: 200, y: 140 } }).some(e => e.includes('entrada')));
  assert.ok(levelErrors({ ...FIRST_LEVEL, exit: { x: 623, y: 200, width: 25 } }).some(e => e.includes('salida')));
  assert.ok(levelErrors({ ...FIRST_LEVEL, skills: { fly: 1 } }).some(e => e.includes('fly')));
  assert.throws(() => new World({ ...FIRST_LEVEL, width: 0 }), /inválido/);
});
test('first stage can rescue all ten with one digger', () => {
  const w = run(new World(), 100, solution);
  assert.equal(w.result, 'won'); assert.equal(w.saved, 10); assert.equal(w.lost, 0);
  assert.equal(w.diggers, 9); assert.equal(w.active.length, 0); assert.equal(w.activeCount, 0);
  assert.equal(w.terrain.solid(262, 145), false); assert.equal(w.terrain.solid(262, 185), false);
});
test('without excavation, walled walkers pace the upper platform until time runs out', () => {
  const w = run(new World(), 100);
  assert.equal(w.result, null); assert.equal(w.lost, 0); assert.equal(w.activeCount, 10);
  assert.ok(w.active.every(l => l.y === 134 && l.x > 112 && l.x < 704), 'nobody falls off the ends');
  run(w, 300);
  assert.equal(w.result, 'lost'); assert.equal(w.saved, 0); assert.equal(w.lost, 10);
});
test('no skill is consumed while falling, after death or on invalid targets', () => {
  const w = run(new World(), 1);
  assert.equal(w.dig(1), false); assert.equal(w.dig(999), false); assert.equal(w.assign(1, 'fly'), false);
  assert.equal(w.diggers, 10);
  run(w, 400); assert.equal(w.result, 'lost'); assert.equal(w.dig(1), false); assert.equal(w.diggers, 10);
});
test('dig command cannot be assigned twice to the same worker', () => {
  const w = run(new World(), 2.5);
  assert.equal(w.dig(1), true); assert.equal(w.dig(1), false); assert.equal(w.diggers, 9);
});
test('an empty inventory refuses assignments', () => {
  const w = run(new World({ ...FIRST_LEVEL, skills: { dig: 0 } }), 2.5);
  assert.equal(w.dig(1), false); assert.equal(w.diggers, 0); assert.equal(w.lemmings[0].state, 'walking');
});
test('restart creates fresh terrain, counters, time and inventory', () => {
  const w = run(new World(), 100, solution), fresh = new World();
  assert.equal(fresh.time, 0); assert.equal(fresh.saved, 0); assert.equal(fresh.diggers, 10);
  assert.equal(fresh.terrain.solid(262, 145), true); assert.notEqual(w.terrain.cells, fresh.terrain.cells);
  assert.equal(FIRST_LEVEL.skills.dig, 10, 'level data is never mutated');
});
test('rate clamps to 50–99, remains finite, and never emits more than ten', () => {
  const w = new World(); w.setRate(NaN); assert.equal(w.rate, 50);
  w.setRate(1000); assert.equal(w.rate, 99); run(w, 20);
  assert.equal(w.lemmings.length, 10); assert.equal(w.remaining, 0);
  w.setRate(-10); assert.equal(w.rate, 50);
});
test('timeout counts unspawned and active workers as lost and empties the hatch', () => {
  const w = run(new World({ ...FIRST_LEVEL, seconds: 2 }), 4);
  assert.equal(w.result, 'lost'); assert.equal(w.saved + w.lost, 10);
  assert.equal(w.active.length, 0); assert.equal(w.remaining, 0);
});
test('completed worlds are immutable under further updates and commands', () => {
  const w = run(new World(), 100, solution), before = JSON.stringify(w);
  w.update(1); w.setRate(80); w.dig(1); assert.equal(JSON.stringify(w), before);
});
test('walkers climb small steps and descend small drops without falling', () => {
  const { w, l } = walkerOn(arena([{ x: 40, y: 47, width: 30, height: 3 }]));
  for (let i = 0; i < 200; i++) w.update(1 / 60);
  assert.equal(l.direction, 1); assert.ok(l.x > 75, `x=${l.x}`); assert.equal(l.y, 50); assert.equal(l.state, 'walking');
});
test('walkers turn at walls taller than a step and never enter terrain', () => {
  const { w, l } = walkerOn(arena([{ x: 40, y: 50 - RULES.stepUp - 2, width: 6, height: RULES.stepUp + 2 }]));
  for (let i = 0; i < 120; i++) {
    w.update(1 / 60);
    assert.equal(w.terrain.solid(l.x, l.y - 1), false, 'feet stay on the surface');
  }
  assert.equal(l.direction, -1); assert.ok(l.x < 40);
});
test('a digger becomes a faller when the ground ends', () => {
  const { w, l } = walkerOn(arena([], { terrain: [{ x: 0, y: 50, width: 200, height: 6 }] }));
  assert.equal(w.dig(1), true);
  for (let i = 0; i < 60; i++) w.update(1 / 60);
  assert.notEqual(l.state, 'digging'); assert.equal(w.terrain.solid(20, 52), false);
});
test('same commands produce identical world at 30, 60 and 120 Hz', () => {
  const simulate = fps => {
    const clock = new Clock(), world = new World();
    for (let i = 0; i < fps * 60; i++) clock.advance(1 / fps, 1, dt => { solution(world); world.update(dt); world.drainEvents(); });
    return JSON.stringify(world);
  };
  assert.equal(simulate(30), simulate(60)); assert.equal(simulate(60), simulate(120));
});
test('a command log replays to the identical final world', () => {
  const live = run(new World(), 30, w => { solution(w); if (w.tick === 90) w.setRate(70); });
  run(live, 100);
  assert.equal(live.log.length, 2);
  assert.equal(JSON.stringify(replay(FIRST_LEVEL, live.log)), JSON.stringify(live));
});
test('clock reset drops backlog and a stalled frame has bounded catch-up', () => {
  const c = new Clock(); let calls = 0;
  assert.equal(c.advance(10, 3, () => calls++), 18); assert.equal(calls, 18);
  c.advance(.001, 1, () => {}); c.reset(); assert.equal(c.pending, 0);
  assert.equal(c.advance(NaN, 1, () => calls++), 0); assert.equal(c.advance(-1, 1, () => calls++), 0);
});
test('event queue stays bounded when nobody drains it', () => {
  const w = new World();
  for (let i = 0; i < 60 * 120 && !w.result; i++) { solution(w); w.update(1 / 60); }
  assert.ok(w.events.length <= RULES.maxEvents);
});
test('digging is slow alone and scales with a crew in the same pit', () => {
  const slab = { ...arena([], { terrain: [{ x: 0, y: 30, width: 200, height: 34 }, { x: 0, y: 70, width: 200, height: 10 }] }),
    total: 4, skills: { dig: 4 }, spawn: { x: 20, y: 5 }, exit: { x: 190, y: 70, width: 4 } };
  const breakthrough = n => {
    const w = new World(slab);
    for (let k = 0; k < n; k++) { w.spawn(); Object.assign(w.lemmings[k], { state: 'walking', x: 100 + k * 2, y: 30 }); }
    w.spawnTimer = Infinity;
    for (let k = 1; k <= n; k++) assert.equal(w.dig(k), true);
    assert.equal(new Set(w.lemmings.map(l => l.x)).size, 1, 'crew aligns to one pit');
    let ticks = 0;
    while (w.terrain.solid(100, 63) && ticks < 3600) { w.update(1 / 60); ticks++; }
    return ticks / 60;
  };
  const solo = breakthrough(1), crew = breakthrough(4);
  assert.ok(solo > 7 && solo < 8.5, `solo ${solo}s`);
  assert.ok(Math.abs(solo / crew - 4) < 0.25, `solo ${solo}s vs crew ${crew}s`);
});
test('cancelling a digger refunds the use, keeps the pit and the lemming walks on', () => {
  const w = run(new World(), 2.5);
  assert.equal(w.dig(1), true); assert.equal(w.diggers, 9);
  run(w, 1.5);
  const l = w.lemmings[0], depth = l.y;
  assert.ok(depth > 134, 'some ground was dug');
  assert.equal(w.cancel(1), true); assert.equal(w.diggers, 10); assert.equal(l.state, 'walking');
  assert.equal(w.cancel(1), false, 'a walker has nothing to cancel'); assert.equal(w.diggers, 10);
  assert.equal(w.terrain.solid(l.x, 135), false, 'the pit stays');
  assert.equal(w.dig(1), true, 'the refunded use can be assigned again'); assert.equal(w.diggers, 9);
  assert.equal(w.cancel(999), false);
});
test('cancel commands replay exactly', () => {
  const live = new World();
  for (let i = 0; i < 60 * 100 && !live.result; i++) {
    const first = live.lemmings[0];
    if (first?.state === 'walking' && first.x >= 262 && live.diggers === 10 && live.log.length === 0) live.dig(1);
    if (live.tick === 400 && live.lemmings[0]?.state === 'digging') live.cancel(1);
    if (live.tick === 520) live.dig(1);
    live.update(1 / 60); live.drainEvents();
  }
  assert.ok(live.log.some(c => c.type === 'cancel'));
  assert.equal(JSON.stringify(replay(FIRST_LEVEL, live.log)), JSON.stringify(live));
});
