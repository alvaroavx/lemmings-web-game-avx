const HISTORY = 128;

/**
 * Destructible binary mask: the single source of collision and of the drawn
 * ground. Every mutation bumps `revision` and records the touched rectangle so
 * views can repaint only what changed, without mutating this object.
 */
export class Terrain {
  constructor(width, height, rectangles = []) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new RangeError('Terrain necesita dimensiones enteras positivas');
    }
    this.width = width; this.height = height;
    this.cells = new Uint8Array(width * height);
    this.revision = 0; this.changes = [];
    for (const r of rectangles) this.write(r.x, r.y, r.width, r.height, 1, false);
  }
  solid(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    return x >= 0 && x < this.width && y >= 0 && y < this.height && this.cells[y * this.width + x] === 1;
  }
  clear(x, y, width, height) { return this.write(x, y, width, height, 0, true); }
  fill(x, y, width, height) { return this.write(x, y, width, height, 1, true); }
  /** Union of rectangles changed after `revision`; null if none; whole mask if history was trimmed. */
  changedSince(revision) {
    if (revision === this.revision) return null;
    const first = this.changes[0];
    if (revision < 0 || revision > this.revision || !first || first.revision > revision + 1) {
      return { x: 0, y: 0, width: this.width, height: this.height };
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of this.changes) {
      if (c.revision <= revision) continue;
      x0 = Math.min(x0, c.x0); y0 = Math.min(y0, c.y0); x1 = Math.max(x1, c.x1); y1 = Math.max(y1, c.y1);
    }
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }
  write(x, y, width, height, value, track) {
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + width)), y1 = Math.min(this.height, Math.ceil(y + height));
    let changed = 0;
    for (let py = y0; py < y1; py++) {
      const row = py * this.width;
      for (let i = row + x0; i < row + x1; i++) {
        if (this.cells[i] !== value) { this.cells[i] = value; changed++; }
      }
    }
    if (changed && track) {
      this.revision++;
      this.changes.push({ revision: this.revision, x0, y0, x1, y1 });
      if (this.changes.length > HISTORY) this.changes.shift();
    }
    return changed;
  }
}
