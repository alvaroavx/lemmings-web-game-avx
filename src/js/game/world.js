import { FIRST_LEVEL, assertLevel, normalizeLevel } from './levels.js';
import { SKILLS, SKILL_BY_STATE, SKILL_OF_STATE, STOPPER_STATES } from './skills.js';
import { RULES } from './rules.js';
import { Terrain } from '../engine/terrain.js';

export { RULES };
const ENDED = new Set(['saved', 'lost']);
const alive = l => !ENDED.has(l.state);
const inside = (r, x, y) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;

/**
 * Deterministic simulation. No DOM, audio, timers, storage, randomness or
 * canvas. Player commands are validated here and logged with their tick so a
 * match can be replayed exactly (see replay.js). World never names a skill:
 * jobs run through SKILL_BY_STATE and abilities through trait hooks.
 */
export class World {
  #stoppers = []; #forecast = null; #lookahead = true;
  constructor(level = FIRST_LEVEL) {
    this.level = assertLevel(normalizeLevel(level));
    this.terrain = new Terrain(this.level.width, this.level.height, this.level.terrain);
    this.lemmings = []; this.tick = 0; this.time = 0;
    this.spawnTimer = RULES.firstSpawn; this.released = 0;
    this.rate = this.level.rate; this.inventory = { ...this.level.skills };
    this.saved = 0; this.lost = 0; this.result = null;
    /** Set once the stage can no longer be won: { at, reason }; it ends `RULES.doomGrace` s later. */
    this.doom = null;
    this.blasts = []; this.events = []; this.log = [];
  }
  get remaining() { return this.level.total - this.released; }
  get active() { return this.lemmings.filter(alive); }
  get activeCount() { let n = 0; for (const l of this.lemmings) n += alive(l); return n; }
  get diggers() { return this.inventory.dig ?? 0; }
  /** Seconds left before a doomed stage ends; null while it can still be won. */
  get doomLeft() { return this.doom ? Math.max(0, this.doom.at + RULES.doomGrace - this.time) : null; }

  // ── Commands (validated, logged, replayable) ───────────────────────────────
  setRate(rate) {
    if (this.result || !Number.isFinite(rate)) return false;
    const next = Math.min(99, Math.max(50, Math.round(rate)));
    if (next === this.rate) return false;
    this.#forecast = null;
    this.rate = next; this.log.push({ tick: this.tick, type: 'rate', rate: next });
    return true;
  }
  assign(id, skillId) {
    const skill = Object.hasOwn(SKILLS, skillId) ? SKILLS[skillId] : null, l = this.lemmings.find(item => item.id === id);
    if (this.result || !skill || !l || !alive(l) || !(this.inventory[skillId] > 0) || !skill.canAssign(this, l)) return false;
    skill.begin(this, l); this.inventory[skillId]--; this.#forecast = null;
    this.log.push({ tick: this.tick, type: 'assign', id, skill: skillId });
    this.emit({ type: skillId, id, x: l.x, y: l.y });
    return true;
  }
  dig(id) { return this.assign(id, 'dig'); }
  /** Undoes a cancellable job: the lemming walks on and the use is refunded. */
  cancel(id) {
    const l = this.lemmings.find(item => item.id === id), skill = l && SKILL_OF_STATE[l.state];
    if (this.result || !skill?.cancellable) return false;
    l.state = 'walking'; l.timer = 0; l.work = 0; this.#forecast = null;
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
  /** First non-undefined answer of the lemming's trait hooks, in assignment order. */
  hook(l, name, ...args) {
    for (const id in l.traits) {
      const fn = SKILLS[id].hooks?.[name];
      if (!fn) continue;
      const answer = fn(this, l, ...args);
      if (answer !== undefined) return answer;
    }
    return undefined;
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
    this.#stoppers = this.lemmings.filter(l => STOPPER_STATES.has(l.state));
    for (const l of this.lemmings) {
      if (!alive(l)) continue;
      this.hook(l, 'tick', dt);
      if (!alive(l)) continue;
      const update = SKILL_BY_STATE[l.state];
      if (update) update(this, l, dt);
      else if (l.state === 'walking') this.walk(l, dt);
      else this.fall(l, dt);
      if (!alive(l)) continue;
      if (l.y > level.height + RULES.outOfWorld || l.x < 0 || l.x >= level.width) this.settle(l, 'lost');
      else if (level.hazards.some(h => inside(h, l.x, l.y - 1))) this.settle(l, 'lost', 'drown');
      else if (l.state === 'walking' && level.exits.some(e => Math.abs(l.x - e.x) < e.width / 2
        && Math.abs(l.y - e.y) < RULES.exitTolerance)) this.settle(l, 'saved');
    }
    this.blasts = this.blasts.filter(b => this.time - b.time < RULES.blastLife);
    // Once the hatch is empty, a crew made only of blockers can never change again.
    if (this.remaining === 0 && this.lemmings.some(l => l.state === 'blocking')
      && this.lemmings.every(l => !alive(l) || (l.state === 'blocking' && !l.traits.bomb))
      && !(this.inventory.bomb > 0)) {
      for (const l of this.lemmings) if (alive(l)) this.settle(l, 'lost', 'stranded');
    }
    if (!this.doom && this.saved + this.lost < level.total) {
      const reason = this.hopeless();
      if (reason) { this.doom = { at: this.time, reason }; this.emit({ type: 'doom', reason }); }
    }
    const timeout = this.time >= level.seconds, doomed = this.doomLeft === 0;
    const rescued = level.required > 0 && this.saved >= level.required && this.#forecast === this.saved;
    if (timeout || doomed || rescued) {
      for (const l of this.lemmings) if (alive(l)) this.settle(l, 'lost', rescued ? 'stranded' : doomed ? 'doom' : 'lost');
      this.lost += this.remaining; this.released = level.total;
    }
    if (timeout || doomed || rescued || this.saved + this.lost === level.total) {
      this.result = this.saved >= level.required ? 'won' : 'lost';
      this.emit({ type: this.result === 'won' ? 'victory' : 'defeat' });
    }
  }
  /**
   * Why the stage can no longer be won, or null. Two cases:
   *  - 'count': even if every lemming still alive or in the hatch got home,
   *    the goal would not be reached;
   *  - 'fate':  the player has nothing left to change (hatch empty, no skill
   *    uses, no job to cancel) and the rest of the match, now fully
   *    determined, is simulated once on a copy and ends below the goal.
   */
  hopeless() {
    const { level } = this;
    if (this.saved + this.activeCount + this.remaining < level.required) return 'count';
    if (!this.#lookahead || this.#forecast !== null || this.remaining > 0) return null;
    // Before the goal, unused skills may still change the outcome. After it,
    // forecast the remaining rescues so a trapped tail cannot hold victory open.
    if ((level.required === 0 || this.saved < level.required)
      && Object.values(this.inventory).some(n => n > 0)) return null;
    if (this.lemmings.some(l => alive(l) && SKILL_OF_STATE[l.state]?.cancellable)) return null;
    this.#forecast = this.copy().finish().saved;
    return this.#forecast < level.required ? 'fate' : null;
  }
  /** Independent copy of the current state that never forecasts itself. */
  copy() {
    const twin = new World(this.level);
    twin.#lookahead = false;
    twin.terrain.cells.set(this.terrain.cells);
    for (const key of ['tick', 'time', 'spawnTimer', 'released', 'rate', 'saved', 'lost']) twin[key] = this[key];
    twin.inventory = { ...this.inventory };
    twin.lemmings = this.lemmings.map(l => ({ ...l, traits: { ...l.traits } }));
    return twin;
  }
  /** Runs without commands until the match resolves. */
  finish(dt = 1 / 60) {
    while (!this.result) { this.update(dt); this.events.length = 0; }
    return this;
  }
  spawn() {
    const hatches = this.level.hatches, hatch = hatches[this.released % hatches.length];
    this.released++;
    this.lemmings.push({ id: this.released, x: hatch.x, y: hatch.y, direction: hatch.direction ?? 1,
      state: 'falling', vy: 0, fallStart: hatch.y, timer: 0, work: 0, traits: {} });
    this.emit({ type: 'spawn' });
  }
  settle(l, state, cause = state) {
    l.state = state; this[state]++;
    if (state === 'lost') delete l.traits.bomb;
    this.emit({ type: state, cause, id: l.id, x: l.x, y: l.y });
  }
  explode(l, radius, lift = 0) {
    this.terrain.carveDisc(l.x, l.y - lift, radius);
    this.blasts.push({ x: l.x, y: l.y - lift, radius, time: this.time });
    this.emit({ type: 'explode', x: l.x, y: l.y });
    this.settle(l, 'lost', 'explode');
  }
  startFall(l) { l.state = 'falling'; l.fallStart = l.y; l.vy = 0; l.timer = 0; l.work = 0; }
  /** Keeps feet on ground, descending small steps; false means there is no ground. */
  ground(l) {
    for (let d = 0; d <= RULES.stepDown; d++) if (this.terrain.solid(l.x, l.y + d)) { l.y += d; return true; }
    return false;
  }
  blockedAhead(l) {
    for (const b of this.#stoppers) {
      const ahead = (b.x - l.x) * l.direction;
      if (b !== l && ahead > 0 && ahead <= RULES.blockReach && Math.abs(b.y - l.y) <= RULES.blockHeight) return true;
    }
    return false;
  }
  /** A wall ahead: trait hooks (climbing) may take it; otherwise turn around. */
  meetWall(l) { if (!this.hook(l, 'wall')) l.direction = -l.direction; }
  walk(l, dt) {
    if (!this.ground(l)) { this.startFall(l); return; }
    if (this.blockedAhead(l)) { l.direction = -l.direction; return; }
    const t = this.terrain, dir = l.direction, nx = l.x + dir * RULES.walkSpeed * dt;
    // A wall is anything ahead taller than a climbable step.
    if (t.blocks(nx + dir * RULES.wallProbe, l.y - 1 - RULES.stepUp, dir)) { this.meetWall(l); return; }
    let y = l.y;
    for (let climbed = 0; t.blocks(nx, y - 1, dir); climbed++) {
      if (climbed >= RULES.stepUp) { this.meetWall(l); return; }
      y--;
    }
    l.x = nx; l.y = y;
    if (!this.ground(l)) this.startFall(l);
  }
  fall(l, dt) {
    l.vy = Math.min(this.hook(l, 'fallCap') ?? RULES.maxFallSpeed, l.vy + RULES.gravity * dt);
    const nextY = l.y + l.vy * dt;
    // Scan crossed rows, so thin ground cannot be skipped even at terminal speed.
    for (let y = Math.floor(l.y); y <= Math.ceil(nextY); y++) {
      if (!this.terrain.solid(l.x, y)) continue;
      l.y = y; l.vy = 0;
      if (l.y - l.fallStart > RULES.safeFall && !this.hook(l, 'survives')) this.settle(l, 'lost', 'fall');
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
