/**
 * Skill table. Each skill declares when it may be assigned, how it starts and
 * which lemming state it drives. World dispatches by state, consumes inventory
 * only after `canAssign` succeeds, and records the command for replay.
 *
 * To add a skill: add an entry here, its inventory in the level data, a sprite
 * pose in the view and its tests. The world loop does not change.
 */
export const SKILLS = Object.freeze({
  /**
   * Digging is work: one digger removes `depth` rows every `period` seconds.
   * Diggers assigned inside the same pit join the crew (aligned to its axis)
   * and, because each one follows the shared floor down, the pit deepens
   * proportionally faster: four diggers ≈ four times one.
   */
  dig: Object.freeze({
    id: 'dig', state: 'digging', label: 'Cavar', period: 0.48, width: 16, depth: 2, follow: 12,
    canAssign: (world, l) => l.state === 'walking' && world.terrain.solid(l.x, l.y),
    begin(world, l) {
      const crew = world.lemmings.find(o => o !== l && o.state === 'digging'
        && Math.abs(o.x - l.x) <= this.width / 2 && Math.abs(o.y - l.y) <= this.follow);
      if (crew) { l.x = crew.x; l.direction = crew.direction; }
      l.state = 'digging'; l.timer = 0;
    },
    update(world, l, dt) {
      // Follow the floor the crew keeps lowering; with no floor nearby, fall.
      let drop = 0;
      while (!world.terrain.solid(l.x, l.y + drop)) {
        if (++drop > this.follow) { world.startFall(l); return; }
      }
      l.y += drop;
      l.timer -= dt;
      if (l.timer > 0) return;
      l.timer += this.period;
      world.terrain.clear(l.x - this.width / 2, l.y, this.width, this.depth);
      l.y += this.depth;
      world.emit({ type: 'debris', x: l.x, y: l.y });
    },
  }),
});
export const SKILL_BY_STATE = Object.freeze(Object.fromEntries(Object.values(SKILLS).map(s => [s.state, s])));
