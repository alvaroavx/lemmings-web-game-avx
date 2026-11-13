/**
 * Bounded fixed-step accumulator. The browser owns scheduling; the simulation
 * only ever receives `step`. Speed multiplies steps, never their size.
 */
export class Clock {
  constructor(step = 1 / 60, maxFrame = 0.1) {
    if (!(step > 0) || !(maxFrame > 0)) throw new RangeError('Clock necesita step y maxFrame positivos');
    this.step = step; this.maxFrame = maxFrame; this.pending = 0;
  }
  reset() { this.pending = 0; }
  /** Runs whole steps for the elapsed real time; returns how many ran. */
  advance(elapsed, speed, update) {
    const safe = Number.isFinite(elapsed) ? Math.min(Math.max(elapsed, 0), this.maxFrame) : 0;
    this.pending += safe * (Number.isFinite(speed) && speed > 0 ? speed : 1);
    let steps = 0;
    while (this.pending + 1e-10 >= this.step) {
      update(this.step);
      this.pending -= this.step; steps++;
    }
    return steps;
  }
}
