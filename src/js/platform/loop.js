/**
 * Single requestAnimationFrame driver. Reports real elapsed seconds; the
 * Clock decides how many fixed steps they are worth. `resetTime` makes the
 * next frame report 0, so suspensions and pauses never accumulate.
 */
export class FrameLoop {
  constructor(onFrame) { this.onFrame = onFrame; this.last = null; this.handle = 0; this.running = false; }
  start() {
    if (this.running) return;
    this.running = true; this.last = null;
    this.handle = requestAnimationFrame(now => this.frame(now));
  }
  stop() { this.running = false; cancelAnimationFrame(this.handle); }
  resetTime() { this.last = null; }
  frame(now) {
    if (!this.running) return;
    const elapsed = this.last === null ? 0 : (now - this.last) / 1000;
    this.last = now;
    try { this.onFrame(elapsed); }
    finally { if (this.running) this.handle = requestAnimationFrame(next => this.frame(next)); }
  }
}
