import { RULES } from './rules.js';
import { MATERIAL } from '../engine/terrain.js';

/**
 * Skill table. Three kinds, one contract:
 *  - job:   changes the lemming's state; `states` maps each state it drives to an updater.
 *  - trait: permanent ability stored in `lemming.traits`; reacts through `hooks`.
 *  - fuse:  a timer stored in `lemming.traits`; ticks through `hooks.tick`.
 * World consumes inventory only after `canAssign` approves, then calls `begin`.
 * `cancellable` jobs can be undone with World.cancel: the lemming walks on and
 * the use returns (the terrain already changed stays). Blockers are not
 * cancellable: that would make releasing them with a bomb pointless.
 * World never names a skill: it dispatches states through SKILL_BY_STATE and
 * reactions (wall, fallCap, survives, tick) through the lemming's traits.
 *
 * `role` is the lock a skill can open. Stage pieces use it (see stage/pieces.js).
 */
const walkingOnGround = (world, l) => l.state === 'walking' && world.terrain.solid(l.x, l.y);
const earthAt = (world, x, y) => world.terrain.at(x, y) === MATERIAL.earth;
const earthAhead = (world, l, distance) => {
  for (let d = 1; d <= distance; d++) {
    if (earthAt(world, l.x + l.direction * d, l.y - 4) || earthAt(world, l.x + l.direction * d, l.y - 9)) return true;
  }
  return false;
};
/** Drops a worker onto the floor below its feet; false (and a fall) if there is none within `reach`. */
const follow = (world, l, reach) => {
  let drop = 0;
  while (!world.terrain.solid(l.x, l.y + drop)) if (++drop > reach) { world.startFall(l); return false; }
  l.y += drop; return true;
};
/** Shared stroke clock for jobs: true once per `period`. */
const stroke = (l, dt, period) => {
  l.timer -= dt;
  if (l.timer > 0) return false;
  l.timer += period; return true;
};
const stop = (world, l, turn = false) => {
  l.state = 'walking'; l.timer = 0; l.work = 0;
  if (turn) l.direction = -l.direction;
  world.emit({ type: 'shrug', id: l.id, x: l.x, y: l.y });
};

export const SKILLS = Object.freeze({
  /** Floater: permanent. Falls slowly after the first few pixels and never dies of height. */
  float: Object.freeze({
    id: 'float', kind: 'trait', label: 'Paracaídas', role: 'descend-high', after: 16, speed: 32,
    canAssign: (world, l) => !l.traits.float,
    begin(world, l) { l.traits.float = true; },
    hooks: {
      fallCap(world, l) { return l.y - l.fallStart > SKILLS.float.after ? SKILLS.float.speed : undefined; },
      survives: () => true,
    },
  }),
  /** Climber: permanent. Scales walls instead of turning; lets go under an overhang. */
  climb: Object.freeze({
    id: 'climb', kind: 'trait', label: 'Escalar', role: 'scale', speed: 14,
    canAssign: (world, l) => !l.traits.climb,
    begin(world, l) { l.traits.climb = true; },
    hooks: {
      wall(world, l) { l.state = 'climbing'; l.vy = 0; return true; },
    },
    states: {
      climbing(world, l, dt) {
        const t = world.terrain, dir = l.direction, wx = l.x + dir * (RULES.wallProbe + 1);
        if (t.solid(l.x, l.y - 14)) { l.direction = -dir; world.startFall(l); return; }
        l.y -= SKILLS.climb.speed * dt;
        const fy = Math.floor(l.y);
        if (t.solid(wx, fy - 1)) return;
        // Topped out: step onto the wall's upper surface.
        for (let d = 0; d <= RULES.stepUp; d++) {
          if (t.solid(wx, fy + d)) { l.x = wx; l.y = fy + d; l.state = 'walking'; return; }
        }
        world.startFall(l);
      },
    },
  }),
  /** Bomber: a 4 s fuse; the explosion carves a crater of earth and the bomber is lost. */
  bomb: Object.freeze({
    id: 'bomb', kind: 'fuse', label: 'Detonar', role: 'blast', fuse: 4, radius: 14, lift: 5,
    canAssign: (world, l) => !('bomb' in l.traits),
    begin(world, l) { l.traits.bomb = SKILLS.bomb.fuse; },
    hooks: {
      tick(world, l, dt) {
        l.traits.bomb -= dt;
        if (l.traits.bomb <= 0) world.explode(l, SKILLS.bomb.radius, SKILLS.bomb.lift);
      },
    },
  }),
  /** Blocker: stands still and turns every walker that reaches it. */
  block: Object.freeze({
    id: 'block', kind: 'job', label: 'Bloquear', role: 'turn', turnsWalkers: true,
    canAssign: (world, l) => walkingOnGround(world, l)
      && !world.lemmings.some(o => o.state === 'blocking' && Math.abs(o.x - l.x) < 10 && Math.abs(o.y - l.y) < 10),
    begin(world, l) { l.state = 'blocking'; },
    states: {
      blocking(world, l) { if (!world.terrain.solid(l.x, l.y)) world.startFall(l); },
    },
  }),
  /**
   * Builder: lays 12 bricks, each 2 px higher and 4 px further; stops if its
   * head would hit terrain. While it works nobody overtakes it (`turnsWalkers`),
   * so the colony never walks off an unfinished stair nor gets trapped under it.
   */
  build: Object.freeze({
    id: 'build', kind: 'job', label: 'Construir', role: 'span', turnsWalkers: true, cancellable: true, bricks: 12, period: 0.45, brick: 8, rise: 2, run: 4,
    canAssign: walkingOnGround,
    begin(world, l) { l.state = 'building'; l.timer = 0; l.work = SKILLS.build.bricks; },
    states: {
      building(world, l, dt) {
        const s = SKILLS.build, t = world.terrain, dir = l.direction;
        if (!t.solid(l.x, l.y)) { world.startFall(l); return; }
        if (!stroke(l, dt, s.period)) return;
        if (t.solid(l.x + dir * 6, l.y - 12) || t.solid(l.x + dir * 6, l.y - 7)) { stop(world, l, true); return; }
        const x = Math.floor(l.x);
        t.fill(dir > 0 ? x : x - s.brick + 1, l.y - s.rise, s.brick, s.rise);
        l.x += dir * s.run; l.y -= s.rise; l.work--;
        world.emit({ type: 'brick', x: l.x, y: l.y });
        if (l.work <= 0) stop(world, l);
      },
    },
  }),
  /** Basher: horizontal tunnel through earth at body height; steel stops it and turns it back. */
  bash: Object.freeze({
    id: 'bash', kind: 'job', label: 'Perforar', role: 'pierce', cancellable: true, period: 0.3, reach: 8, height: 12, step: 3, probe: 16,
    canAssign: (world, l) => walkingOnGround(world, l) && earthAhead(world, l, SKILLS.bash.probe),
    begin(world, l) { l.state = 'bashing'; l.timer = 0; },
    states: {
      bashing(world, l, dt) {
        const s = SKILLS.bash, dir = l.direction;
        if (!world.ground(l)) { world.startFall(l); return; }
        if (!stroke(l, dt, s.period)) return;
        const x = Math.floor(l.x), cut = world.terrain.carve(dir > 0 ? x + 1 : x - s.reach, l.y - s.height, s.reach, s.height);
        if (cut.steel) { stop(world, l, true); return; }
        if (!cut.earth && !earthAhead(world, l, s.probe)) { stop(world, l); return; }
        l.x += dir * s.step;
        if (cut.earth) world.emit({ type: 'debris', x: l.x, y: l.y });
        if (!world.ground(l)) world.startFall(l);
      },
    },
  }),
  /** Miner: diagonal tunnel down and forward, 2 px down every 4 px. */
  mine: Object.freeze({
    id: 'mine', kind: 'job', label: 'Minar', role: 'descend-diagonal', cancellable: true, period: 0.4, width: 10, height: 13, step: 4, drop: 2,
    canAssign: (world, l) => walkingOnGround(world, l) && earthAt(world, l.x + l.direction * 3, l.y),
    begin(world, l) { l.state = 'mining'; l.timer = 0; },
    states: {
      mining(world, l, dt) {
        const s = SKILLS.mine, dir = l.direction;
        if (!follow(world, l, 4) || !stroke(l, dt, s.period)) return;
        const x = Math.floor(l.x);
        const cut = world.terrain.carve(dir > 0 ? x - 2 : x - s.width + 3, l.y - s.height + 2, s.width, s.height);
        if (cut.steel) { stop(world, l, true); return; }
        if (!cut.earth) { stop(world, l); return; }
        l.x += dir * s.step; l.y += s.drop;
        world.emit({ type: 'debris', x: l.x, y: l.y });
        follow(world, l, 4);
      },
    },
  }),
  /**
   * Digger: vertical pit. One digger removes `depth` rows every `period`
   * seconds. Diggers assigned inside the same pit join the crew (aligned to its
   * axis) and the pit deepens proportionally faster. Steel stops the pit.
   */
  dig: Object.freeze({
    id: 'dig', kind: 'job', label: 'Cavar', role: 'descend-vertical', cancellable: true, period: 0.48, width: 16, depth: 2, follow: 12,
    canAssign: (world, l) => walkingOnGround(world, l) && earthAt(world, l.x, l.y),
    begin(world, l) {
      const crew = world.lemmings.find(o => o !== l && o.state === 'digging'
        && Math.abs(o.x - l.x) <= this.width / 2 && Math.abs(o.y - l.y) <= this.follow);
      if (crew) { l.x = crew.x; l.direction = crew.direction; }
      l.state = 'digging'; l.timer = 0;
    },
    states: {
      digging(world, l, dt) {
        const s = SKILLS.dig;
        if (!follow(world, l, s.follow) || !stroke(l, dt, s.period)) return;
        const cut = world.terrain.carve(l.x - s.width / 2, l.y, s.width, s.depth);
        if (cut.steel) { stop(world, l); return; }
        l.y += s.depth;
        world.emit({ type: 'debris', x: l.x, y: l.y });
      },
    },
  }),
});

/** Canonical toolbar order. */
export const SKILL_ORDER = Object.freeze(['climb', 'float', 'bomb', 'block', 'build', 'bash', 'mine', 'dig']);
/** States whose lemmings turn walkers around, like a wall. */
export const STOPPER_STATES = Object.freeze(new Set(Object.values(SKILLS)
  .filter(skill => skill.turnsWalkers).flatMap(skill => Object.keys(skill.states ?? {}))));
/** State → the skill that drives it. */
export const SKILL_OF_STATE = Object.freeze(Object.fromEntries(Object.values(SKILLS)
  .flatMap(skill => Object.keys(skill.states ?? {}).map(state => [state, skill]))));
export const SKILL_BY_STATE = Object.freeze(Object.fromEntries(Object.values(SKILLS)
  .flatMap(skill => Object.entries(skill.states ?? {}).map(([state, update]) => [state, update]))));
