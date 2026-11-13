import { World } from './world.js';

/**
 * Rebuilds a match from its command log. Commands are applied before the
 * update of the tick they were issued on, exactly as during live play.
 */
export function replay(level, log, { step = 1 / 60, maxTicks = Infinity } = {}) {
  const world = new World(level);
  const commands = [...log].sort((a, b) => a.tick - b.tick);
  const limit = Math.min(maxTicks, Math.ceil(level.seconds / step) + 1);
  let next = 0;
  while (!world.result && world.tick < limit) {
    while (next < commands.length && commands[next].tick <= world.tick) world.apply(commands[next++]);
    world.update(step); world.drainEvents();
  }
  return world;
}
