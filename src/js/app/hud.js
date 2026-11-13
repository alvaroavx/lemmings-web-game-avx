import { $, setText, clock } from './dom.js';

const INTERVAL = 0.1;

/** HUD and toolbar counters. Throttled; every write is skipped when unchanged. */
export class Hud {
  constructor() {
    this.nodes = Object.fromEntries(['remaining', 'active', 'saved', 'time', 'diggers', 'rate', 'goal',
      'saved-total', 'goal-total', 'slower', 'faster', 'dig'].map(id => [id, $(id)]));
    this.elapsed = 0;
  }
  setLevel(level) {
    const n = this.nodes;
    setText(n.goal, level.required);
    setText(n['saved-total'], ` / ${level.total}`); setText(n['goal-total'], ` / ${level.total}`);
    this.elapsed = 0;
  }
  /** Call every frame with real elapsed seconds; `force` refreshes immediately. */
  tick(world, elapsed, force = false) {
    this.elapsed += elapsed;
    if (!force && this.elapsed < INTERVAL) return;
    this.elapsed = 0;
    const n = this.nodes;
    setText(n.remaining, world.remaining); setText(n.active, world.activeCount); setText(n.saved, world.saved);
    setText(n.diggers, world.diggers); setText(n.rate, world.rate);
    setText(n.time, clock(world.level.seconds - world.time));
    n.slower.disabled = world.rate <= 50; n.faster.disabled = world.rate >= 99;
    n.dig.disabled = world.diggers <= 0;
  }
}
