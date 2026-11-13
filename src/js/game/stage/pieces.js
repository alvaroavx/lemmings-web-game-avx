import { RULES } from '../rules.js';
import { SKILLS } from '../skills.js';

/**
 * Stage vocabulary. A stage is the ROUTE the colony walks, written as a list
 * of pieces. Each piece is laid by a turtle that walks that route (see
 * compile.js) and does three things at once:
 *
 *   1. lays terrain, hazards, hatches and exits relative to the turtle;
 *   2. declares the LOCK it creates, if any (a drop that kills, a wall, a
 *      floor that seals the way…);
 *   3. for each KEY that opens the lock, emits the proof: triggers a
 *      deterministic player (autoplay.js) follows to open it.
 *
 * Authors (and, later, a generator) pick pieces and keys; the compiler
 * refuses locks without keys and keys a piece does not accept. Because every
 * key carries its own solution fragment, every stage carries its own proof.
 *
 * Geometry: the turtle stands at (x, y) where y is the walking surface
 * (first solid row) and x is where the next piece begins. Pieces lay floors
 * `t.thick` px deep unless they say otherwise. The colony walks right.
 */
const BUILD = SKILLS.build, STAIR = { run: BUILD.bricks * BUILD.run, rise: BUILD.bricks * BUILD.rise };
const SAFE = RULES.safeFall - 5;

/**
 * Builder chain that climbs `up` px to a face at `face`: `n` builders, each
 * starting on the last step of the previous one. The last one must start
 * where its stairs meet the face top; the first starts further back.
 */
function stairsTo(t, face, up, chain = 'stairs') {
  const n = Math.ceil(up / STAIR.rise), first = face - 46 - STAIR.run * (n - 1);
  const triggers = [];
  for (let k = 0; k < n; k++) {
    triggers.push({ id: `${chain}${k}`, after: k ? `${chain}${k - 1}` : undefined, skill: 'build',
      x: first + STAIR.run * k, y: t.y - STAIR.rise * k, who: 'one' });
  }
  return { first, triggers };
}

export const PIECES = Object.freeze({
  /** Back wall where the route begins. */
  start: {
    lay(t, { wall = 30 }) { t.rect(t.x - 10, t.y - wall, 10, wall + t.thick); t.landing(); },
  },
  /** Flat floor. */
  run: {
    lay(t, { length, material }) { t.floor(length, { material }); },
  },
  /** Floor with a hatch above it. `height` is the fall from the hatch. */
  hatch: {
    lay(t, { length = 120, at = 40, height = 50, direction }) {
      t.hatch(t.x + at, t.y - height, direction); t.floor(length);
      if (height > SAFE) t.fail(`la escotilla cae ${height} px: más que una caída segura`);
    },
  },
  /** Floor with an exit, optionally closed by a wall. */
  exit: {
    lay(t, { length = 80, at = 40, width = 25, wall = true }) {
      t.exit(t.x + at, t.y, width); t.floor(length);
      if (wall) PIECES.end.lay(t, {});
    },
  },
  /** Closing wall. */
  end: {
    lay(t, { wall = 30 }) { t.rect(t.x, t.y - wall, 10, wall + t.thick); t.x += 10; },
  },
  /** Moves the turtle without laying anything: a second route, a new level. */
  goto: {
    lay(t, { x, y }) { t.x = x; t.y = y; t.landing(); },
  },
  /** Raw rectangles relative to the turtle: the escape hatch of the vocabulary. */
  shape: {
    lay(t, { rects }) { for (const r of rects) t.rect(t.x + r.x, t.y + r.y, r.width, r.height, r.material); },
  },

  /** A wall across the route: higher than a step, so it is a lock. */
  wall: {
    lay(t, { height, width = 12, material }) {
      const g = { x: t.x, y: t.y, height, width, material };
      t.rect(t.x, t.y - height, width, height + t.thick, material); t.x += width;
      if (height > SAFE) t.fail('un muro más alto que una caída segura deja a los escaladores sin bajada');
      return g;
    },
    locked: g => g.height > RULES.stepUp,
    keys: {
      bash: (t, g) => g.material === 'steel' ? t.fail('el acero no se perfora')
        : [{ skill: 'bash', x: g.x - 12, y: g.y, who: 'one' }],
      climb: (t, g) => [{ skill: 'climb', x: g.x - 40, y: g.y, who: 'all' }],
      build: (t, g) => g.height > STAIR.rise ? t.fail('un constructor sube 24 px: muro demasiado alto')
        : stairsTo(t, g.x, g.height, `wall${g.x}-`).triggers,
    },
  },
  /** A step up to a higher floor of `length`. */
  ledge: {
    lay(t, { up, length = 100, material }) {
      const g = { x: t.x, y: t.y, up, landingX: t.landingX };
      t.rect(t.x, t.y - up, length, up + t.thick, material); t.y -= up; t.landing(); t.x += length;
      return g;
    },
    locked: g => g.up > RULES.stepUp,
    keys: {
      climb: (t, g) => [{ skill: 'climb', x: g.x - 40, y: g.y, who: 'all' }],
      build: (t, g) => {
        const { first, triggers } = stairsTo({ y: g.y }, g.x, g.up, `ledge${g.x}-`);
        if (first < g.landingX) t.fail('no cabe la escalera antes del escalón');
        return triggers;
      },
    },
  },
  /** The floor ends and continues `down` px lower. */
  drop: {
    lay(t, { down }) {
      const g = { x: t.x, y: t.y, down }; t.y += down; t.landing(); return g;
    },
    locked: g => g.down > SAFE,
    keys: {
      float: (t, g) => [{ skill: 'float', x: g.x - 60, y: g.y, who: 'all' }],
    },
  },
  /**
   * A sealed floor of `length` and `thick`: the colony paces on it until it
   * opens a way down. The route continues `down` px under it, starting at its
   * left end. `end: 'cliff'` replaces the closing wall with a fatal edge.
   */
  descend: {
    lay(t, { length, thick = 20, down = 40, at = 40, end = 'wall', material, wall = 30, wallMaterial }) {
      const g = { x: t.x, y: t.y, length, thick, down, at, end };
      t.rect(t.x, t.y, length, thick, material);
      if (end === 'wall') t.rect(t.x + length, t.y - wall, 10, wall + thick, wallMaterial);
      const low = t.y + thick + down;
      t.rect(t.x - 10, t.y, 10, low + t.thick - t.y); // left wall of the lower route
      t.y = low; t.landing();
      if (thick + down > SAFE) t.fail('la caída tras abrir el suelo sería mortal');
      return g;
    },
    locked: () => true,
    keys: {
      dig: (t, g) => [{ skill: 'dig', x: g.x + g.at, y: g.y, who: 'one' }],
      mine: (t, g) => {
        if (g.at + g.thick * 2 + 12 > g.length) t.fail('el túnel del minero no cabe en el suelo');
        return [{ skill: 'mine', x: g.x + g.at, y: g.y, who: 'one' }];
      },
      /** Hold the colony with a blocker, then blow the blocker through the floor. */
      'block+bomb': (t, g) => {
        if (g.thick > SKILLS.bomb.radius - SKILLS.bomb.lift - 1) t.fail('el suelo es demasiado grueso para una explosión');
        return [{ id: 'hold', skill: 'block', x: g.x + g.at, y: g.y, who: 'one' },
          { skill: 'bomb', state: 'blocking', after: 'hold', delay: 4, who: 'one' }];
      },
    },
  },
  /** A fatal edge: walkers that reach it are lost. */
  cliff: {
    lay(t, { length = 40 }) { const g = { x: t.x + length, y: t.y }; t.floor(length); return g; },
    locked: () => true,
    keys: {
      block: (t, g) => [{ skill: 'block', x: g.x - 12, y: g.y, who: 'one' }],
    },
  },
  /**
   * An open gap of `width`, with water (`water: true`) or void below, bridged
   * by a chain of builders. Nobody overtakes a working builder, so the colony
   * waits behind the bridge until it stands.
   */
  gap: {
    lay(t, { width, water = true }) {
      const g = { x: t.x, y: t.y, width };
      if (water) t.hazard(t.x, t.y + 6, width, t.height - t.y - 6);
      t.x += width; return g;
    },
    locked: () => true,
    keys: { build: (t, g) => bridge(t, g) },
  },
});

function bridge(t, g) {
  const n = Math.ceil((g.width + 2) / STAIR.run), x0 = g.x - 3, triggers = [];
  if (STAIR.rise * n > SAFE) t.fail('el puente sería tan alto que la bajada mataría');
  for (let k = 0; k < n; k++) {
    triggers.push({ id: `gap${g.x}-${k}`, after: k ? `gap${g.x}-${k - 1}` : undefined, skill: 'build',
      x: x0 + STAIR.run * k, y: g.y - STAIR.rise * k, who: 'one' });
  }
  return triggers;
}
