import { World } from './world.js';

/**
 * Deterministic proof player. Follows a stage's triggers through the normal
 * command API, so its log replays exactly like a human match.
 *
 * Trigger: { skill, x?, y?, dir = 1, who: 'one' | 'all', state = 'walking',
 *            limit?, id?, after?, delay? }
 *  - fires on a living lemming in `state`, facing `dir`, within 8 px of `y`,
 *    that has just crossed `x` (window of 10 px);
 *  - 'one' fires once; 'all' fires once per lemming (up to `limit`);
 *  - `after` waits for the trigger with that `id` to have fired, plus `delay` s.
 * A trigger keeps retrying while World refuses (an invalid assignment costs nothing).
 */
export function autoplay(level, { triggers = level.proof?.triggers ?? [], step = 1 / 60 } = {}) {
  const world = new World(level), fired = new Map(), served = triggers.map(() => new Set());
  const limit = Math.ceil(world.level.seconds / step) + 1;
  const ready = tr => !tr.after || (fired.has(tr.after) && world.time >= fired.get(tr.after) + (tr.delay ?? 0));
  const matches = (tr, l) => {
    if (l.state !== (tr.state ?? 'walking')) return false;
    if (tr.y !== undefined && Math.abs(l.y - tr.y) > 8) return false;
    if (tr.x === undefined) return true;
    const dir = tr.dir ?? 1, ahead = (l.x - tr.x) * dir;
    return l.direction === dir && ahead >= 0 && ahead < 10;
  };
  while (!world.result && world.tick < limit) {
    triggers.forEach((tr, i) => {
      if (!ready(tr) || (tr.who !== 'all' && served[i].size) || served[i].size >= (tr.limit ?? Infinity)) return;
      for (const l of world.lemmings) {
        if (served[i].has(l.id) || !matches(tr, l) || !world.assign(l.id, tr.skill)) continue;
        served[i].add(l.id);
        if (tr.id && !fired.has(tr.id)) fired.set(tr.id, world.time);
        if (tr.who !== 'all') break;
      }
    });
    world.update(step); world.drainEvents();
  }
  return world;
}

/** Proof without one skill: what the stage looks like if that key is never used. */
export const withoutSkill = (level, skill) => autoplay(level, { triggers: level.proof.triggers.filter(t => t.skill !== skill) });
