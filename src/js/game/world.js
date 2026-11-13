import { FIRST_LEVEL, assertLevel } from './levels.js';
import { SKILLS, SKILL_BY_STATE } from './skills.js';
import { Terrain } from '../engine/terrain.js';

export const RULES = Object.freeze({
  walkSpeed: 19, gravity: 190, maxFallSpeed: 95, safeFall: 125,
  stepUp: 4, stepDown: 3, wallProbe: 3, exitTolerance: 3, outOfWorld: 12,
  firstSpawn: 0.8, maxEvents: 512,
});
const ENDED = new Set(['saved', 'lost']);
const alive = l => !ENDED.has(l.state);

/**
 * Deterministic simulation. No DOM, audio, timers, storage, randomness or
 * canvas. Player commands are validated here and logged with their tick so a
 * match can be replayed exactly (see replay.js).
 */
export class World {
  constructor(level = FIRST_LEVEL) {
    this.level = assertLevel(level);
    this.terrain = new Terrain(level.width, level.height, level.terrain);
    this.lemmings = []; this.tick = 0; this.time = 0;
    this.spawnTimer = RULES.firstSpawn; this.released = 0;
    this.rate = level.rate; this.inventory = { ...level.skills };
    this.saved = 0; this.lost = 0; this.result = null;
    this.events = []; this.log = [];
  }
  get remaining() { return this.level.total - this.released; }
  get active() { return this.lemmings.filter(alive); }
  get activeCount() { let n = 0; for (const l of this.lemmings) n += alive(l); return n; }
  get diggers() { return this.inventory.dig ?? 0; }

  // ── Commands (validated, logged, replayable) ───────────────────────────────
  setRate(rate) {
    if (this.result || !Number.isFinite(rate)) return false;
    const next = Math.min(99, Math.max(50, Math.round(rate)));
    if (next === this.rate) return false;
    this.rate = next; this.log.push({ tick: this.tick, type: 'rate', rate: next });
    return true;
  }
  assign(id, skillId) {
    const skill = SKILLS[skillId], l = this.lemmings.find(item => item.id === id);
    if (this.result || !skill || !l || !alive(l) || !(this.inventory[skillId] > 0) || !skill.canAssign(this, l)) return false;
    skill.begin(this, l); this.inventory[skillId]--;
    this.log.push({ tick: this.tick, type: 'assign', id, skill: skillId });
    this.emit({ type: skillId, x: l.x, y: l.y });
    return true;
  }
  dig(id) { return this.assign(id, 'dig'); }
  /** Stops an ongoing skill (e.g. digging) and refunds its use: the lemming walks on. */
  cancel(id) {
    const l = this.lemmings.find(item => item.id === id), skill = l && SKILL_BY_STATE[l.state];
    if (this.result || !skill) return false;
    l.state = 'walking'; l.timer = 0;
    this.inventory[skill.id] = (this.inventory[skill.id] ?? 0) + 1;
    this.log.push({ tick: this.tick, type: 'cancel', id });
    this.emit({ type: 'cancel', id, skill: skill.id, x: l.x, y: l.y });
    return true;
  }
  apply(command) {
    if (command.type === 'assign') return this.assign(command.id, command.skill);
    if (command.type === 'rate') return this.setRate(command.rate);
    if (command.type === 'cancel') return this.cancel(command.id);
    return false;
  }

  // ── Queries ────────────────────────────────────────────────────────────────
  findAt(x, y, radius = 14) {
    // Lemmings are ordered by id, so strict comparison keeps the lowest id on ties.
    let best = null, bestDistance = Infinity;
    for (const l of this.lemmings) {
      if (!alive(l)) continue;
      const d = Math.hypot(l.x - x, l.y - 6 - y);
      if (d <= radius && d < bestDistance) { best = l; bestDistance = d; }
    }
    return best;
  }

  // ── Simulation ─────────────────────────────────────────────────────────────
  update(dt) {
    if (this.result) return;
    this.tick++; this.time += dt;
    this.spawnTimer -= dt;
    if (this.remaining > 0 && this.spawnTimer <= 0) {
      this.spawn(); this.spawnTimer += 0.25 + (99 - this.rate) * 0.029;
    }
    const { level } = this;
    for (const l of this.lemmings) {
      if (!alive(l)) continue;
      const skill = SKILL_BY_STATE[l.state];
      if (skill) skill.update(this, l, dt);
      else if (l.state === 'walking') this.walk(l, dt);
      else this.fall(l, dt);
      if (!alive(l)) continue;
      if (l.y > level.height + RULES.outOfWorld || l.x < 0 || l.x >= level.width) this.settle(l, 'lost');
      else if (l.state === 'walking' && Math.abs(l.x - level.exit.x) < level.exit.width / 2
        && Math.abs(l.y - level.exit.y) < RULES.exitTolerance) this.settle(l, 'saved');
    }
    const timeout = this.time >= level.seconds;
    if (timeout) {
      for (const l of this.lemmings) if (alive(l)) this.settle(l, 'lost');
      this.lost += this.remaining; this.released = level.total;
    }
    if (timeout || this.saved + this.lost === level.total) {
      this.result = this.saved >= level.required ? 'won' : 'lost';
      this.emit({ type: this.result === 'won' ? 'victory' : 'defeat' });
    }
  }
  spawn() {
    this.released++;
    this.lemmings.push({ id: this.released, x: this.level.spawn.x, y: this.level.spawn.y,
      direction: 1, state: 'falling', vy: 0, fallStart: this.level.spawn.y, timer: 0 });
    this.emit({ type: 'spawn' });
  }
  settle(l, state) {
    l.state = state; this[state]++;
    this.emit({ type: state, id: l.id, x: l.x, y: l.y });
  }
  startFall(l) { l.state = 'falling'; l.fallStart = l.y; l.vy = 0; }
  /** Keeps feet on ground, descending small steps; false means there is no ground. */
  ground(l) {
    for (let d = 0; d <= RULES.stepDown; d++) if (this.terrain.solid(l.x, l.y + d)) { l.y += d; return true; }
    return false;
  }
  walk(l, dt) {
    if (!this.ground(l)) { this.startFall(l); return; }
    const t = this.terrain, dir = l.direction, nx = l.x + dir * RULES.walkSpeed * dt;
    // A wall is anything ahead taller than a climbable step.
    if (t.solid(nx + dir * RULES.wallProbe, l.y - 1 - RULES.stepUp)) { l.direction = -dir; return; }
    let y = l.y;
    for (let climbed = 0; t.solid(nx, y - 1); climbed++) {
      if (climbed >= RULES.stepUp) { l.direction = -dir; return; }
      y--;
    }
    l.x = nx; l.y = y;
    if (!this.ground(l)) this.startFall(l);
  }
  fall(l, dt) {
    l.vy = Math.min(RULES.maxFallSpeed, l.vy + RULES.gravity * dt);
    const nextY = l.y + l.vy * dt;
    // Scan crossed rows, so thin ground cannot be skipped even at terminal speed.
    for (let y = Math.floor(l.y); y <= Math.ceil(nextY); y++) {
      if (!this.terrain.solid(l.x, y)) continue;
      l.y = y; l.vy = 0;
      if (l.y - l.fallStart > RULES.safeFall) this.settle(l, 'lost');
      else l.state = 'walking';
      return;
    }
    l.y = nextY;
  }
  emit(event) {
    this.events.push(event);
    if (this.events.length > RULES.maxEvents) this.events.splice(0, this.events.length - RULES.maxEvents);
  }
  drainEvents() { return this.events.splice(0); }
}
