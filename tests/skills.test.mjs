import test from 'node:test';
import assert from 'node:assert/strict';
import { World, RULES } from '../src/js/game/world.js';

// Flat arena: ground at y = 80 unless a test supplies its own terrain.
const arena = ({ terrain = [], skills = {}, total = 1, hazards = [], hatches, width = 300, height = 300 } = {}) => ({
  id: 'arena', number: 0, name: 'Arena', width, height, total, required: 0, seconds: 120, rate: 99, skills,
  hatches: hatches ?? [{ x: 20, y: 70 }], exits: [{ x: width - 6, y: 80, width: 4 }], hazards,
  terrain: [{ x: 0, y: 80, width, height: 20 }, ...terrain],
});
const walker = (w, x = 20, y = 80, direction = 1) => {
  w.spawn(); const l = w.lemmings.at(-1); Object.assign(l, { state: 'walking', x, y, direction }); w.spawnTimer = Infinity; return l;
};
const run = (w, seconds) => { for (let i = 0; i < seconds * 60 && !w.result; i++) { w.update(1 / 60); w.drainEvents(); } return w; };

test('a floater survives a fall that kills a walker', () => {
  const level = { ...arena({ skills: { float: 1 }, total: 2 }), exits: [{ x: 294, y: 260, width: 4 }],
    terrain: [{ x: 0, y: 260, width: 300, height: 20 }, { x: 0, y: 40, width: 60, height: 6 }] };
  for (const floating of [true, false]) {
    const w = new World(level), l = walker(w, 20, 40);
    if (floating) assert.equal(w.assign(l.id, 'float'), true);
    run(w, 14);
    assert.equal(l.state === 'lost', !floating, `floater=${floating} state=${l.state}`);
  }
});
test('a climber scales a wall, walks over its top and keeps the trait', () => {
  const w = new World(arena({ skills: { climb: 1 }, terrain: [{ x: 80, y: 30, width: 10, height: 50 }] }));
  const l = walker(w); assert.equal(w.assign(l.id, 'climb'), true); assert.equal(w.assign(l.id, 'climb'), false, 'traits are not stacked');
  run(w, 3); assert.equal(l.state, 'climbing');
  run(w, 12); assert.ok(l.x > 90, `x=${l.x}`); assert.equal(l.traits.climb, true);
});
test('a climber lets go under an overhang', () => {
  const w = new World(arena({ skills: { climb: 1 }, terrain: [{ x: 80, y: 10, width: 10, height: 70 }, { x: 60, y: 30, width: 30, height: 4 }] }));
  const l = walker(w); w.assign(l.id, 'climb'); run(w, 8);
  assert.equal(l.direction, -1); assert.notEqual(l.state, 'climbing');
});
test('blockers hold the colony', () => {
  const w = new World(arena({ skills: { block: 2 }, total: 3 }));
  const b = walker(w, 100), left = walker(w, 60, 80, 1), right = walker(w, 140, 80, -1);
  assert.equal(w.assign(b.id, 'block'), true);
  run(w, 5);
  assert.ok(left.x < 100 && right.x > 100, `left=${left.x} right=${right.x}`);
  b.x = 100; const twin = walker(w, 104); assert.equal(w.assign(twin.id, 'block'), false, 'no blocker on top of another');
});
test('when only blockers remain the stage resolves instead of waiting for the clock', () => {
  const w = new World(arena({ skills: { block: 1 }, total: 1 }));
  const b = walker(w, 100); w.assign(b.id, 'block'); w.update(1 / 60);
  assert.equal(w.result, 'won'); assert.equal(b.state, 'lost'); assert.ok(w.time < 1);
});
test('a builder lays a 12-step stair, 24 px up and 48 px across, and nobody overtakes it', () => {
  const w = new World(arena({ skills: { build: 1 }, total: 2 }));
  const b = walker(w, 100), follower = walker(w, 60);
  assert.equal(w.assign(b.id, 'build'), true); run(w, 3);
  assert.ok(follower.x < b.x, 'the follower waits behind');
  while (b.state === 'building') w.update(1 / 60);
  assert.equal(b.y, 56); assert.equal(b.x, 148);
  assert.equal(w.terrain.solid(147, 57), true); assert.equal(w.terrain.solid(147, 55), false);
});
test('a basher tunnels through earth and is stopped and turned by steel', () => {
  const w = new World(arena({ skills: { bash: 2 }, total: 2, terrain: [{ x: 60, y: 40, width: 30, height: 40 }, { x: 180, y: 40, width: 20, height: 40 }, { x: 200, y: 40, width: 10, height: 40, material: 'steel' }] }));
  const l = walker(w, 50); assert.equal(w.assign(l.id, 'bash'), true); run(w, 8);
  assert.equal(w.terrain.solid(75, 74), false); assert.equal(w.terrain.solid(75, 80), true, 'the floor stays');
  assert.ok(l.x > 90);
  const k = walker(w, 170); assert.equal(w.assign(k.id, 'bash'), true); run(w, 4);
  assert.equal(k.direction, -1); assert.equal(w.terrain.solid(205, 70), true, 'steel stands');
  assert.equal(w.terrain.solid(190, 70), false, 'the earth before it was cut');
});
test('bashing needs earth ahead, so a useless assignment costs nothing', () => {
  const w = new World(arena({ skills: { bash: 1 } })), l = walker(w);
  assert.equal(w.assign(l.id, 'bash'), false); assert.equal(w.inventory.bash, 1);
});
test('a miner descends diagonally through earth', () => {
  const w = new World(arena({ skills: { mine: 1 }, terrain: [{ x: 0, y: 80, width: 300, height: 60 }] }));
  const l = walker(w, 40); assert.equal(w.assign(l.id, 'mine'), true); run(w, 4);
  assert.ok(l.x > 60 && l.y > 90, `x=${l.x} y=${l.y}`);
  assert.ok((l.y - 80) / (l.x - 40) > 0.35, 'goes down as it goes forward');
});
test('steel stops digging and cannot be dug into', () => {
  const w = new World(arena({ skills: { dig: 2 }, total: 2, terrain: [{ x: 0, y: 90, width: 300, height: 10, material: 'steel' }] }));
  const l = walker(w, 40); assert.equal(w.assign(l.id, 'dig'), true); run(w, 6);
  assert.equal(l.state, 'walking'); assert.equal(l.y, 90);
  const k = walker(w, 200, 90); assert.equal(w.assign(k.id, 'dig'), false, 'no digging on steel'); assert.equal(w.inventory.dig, 1);
});
test('a bomb counts down, carves a crater of earth only and the bomber is lost', () => {
  const w = new World(arena({ skills: { bomb: 1 }, total: 2 }));
  const l = walker(w, 100);
  w.terrain.fill(0, 86, 300, 14, 2); // steel under the earth
  assert.equal(w.assign(l.id, 'bomb'), true); assert.equal(w.assign(l.id, 'bomb'), false);
  run(w, 3.9); assert.equal(l.state, 'walking');
  run(w, 0.2); assert.equal(l.state, 'lost'); assert.equal(w.blasts.length, 1);
  assert.equal(w.terrain.solid(l.x, 82), false); assert.equal(w.terrain.solid(l.x, 87), true, 'steel survives');
  run(w, 1); assert.equal(w.blasts.length, 0);
});
test('water drowns and two hatches alternate', () => {
  const w = new World(arena({ total: 2, hatches: [{ x: 20, y: 70 }, { x: 150, y: 70, direction: -1 }],
    hazards: [{ x: 100, y: 70, width: 20, height: 30, type: 'water' }], terrain: [] }));
  w.terrain.clear(100, 80, 20, 20);
  w.setRate(99); run(w, 1.5);
  assert.deepEqual(w.lemmings.map(l => [l.x, l.direction]), [[20, 1], [150, -1]].map(([x, d], i) => [w.lemmings[i].x, d]));
  run(w, 10);
  assert.ok(w.lemmings.every(l => l.state === 'lost' || l.state === 'saved'));
  assert.ok(w.lemmings.some(l => l.state === 'lost'), 'someone met the water');
});
test('physics constants are shared, not duplicated', () => { assert.equal(RULES.safeFall, 125); });
