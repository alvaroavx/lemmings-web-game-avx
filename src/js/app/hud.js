import { $, setText, clock } from './dom.js';

const INTERVAL = 0.1;

/** HUD and toolbar counters. Throttled; every write is skipped when unchanged. */
export class Hud {
  constructor() {
    this.nodes = Object.fromEntries(['remaining', 'active', 'saved', 'time', 'rate', 'goal',
      'saved-total', 'goal-total', 'slower', 'faster'].map(id => [id, $(id)]));
    this.skills = new Map(); this.elapsed = 0;
  }
  setLevel(level) {
    const n = this.nodes;
    setText(n.goal, level.required);
    setText(n['saved-total'], ` / ${level.total}`); setText(n['goal-total'], ` / ${level.total}`);
    this.elapsed = 0;
  }
  /** Skill buttons of the current stage: id → { button, count }. */
  setSkills(skills) { this.skills = skills; }
  /** Call every frame with real elapsed seconds; `force` refreshes immediately. */
  tick(world, elapsed, force = false) {
    this.elapsed += elapsed;
    if (!force && this.elapsed < INTERVAL) return;
    this.elapsed = 0;
    const n = this.nodes;
    setText(n.remaining, world.remaining); setText(n.active, world.activeCount); setText(n.saved, world.saved);
    setText(n.rate, world.rate);
    setText(n.time, clock(world.level.seconds - world.time));
    n.slower.disabled = world.rate <= 50; n.faster.disabled = world.rate >= 99;
    for (const [id, { button, count }] of this.skills) {
      const left = world.inventory[id] ?? 0;
      setText(count, left); button.disabled = left <= 0;
    }
  }
}
