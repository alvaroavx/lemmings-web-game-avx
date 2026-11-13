const HISTORY = 128;

/** Cell values. 0 is always empty; any other value is solid. */
export const MATERIAL = Object.freeze({ empty: 0, earth: 1, steel: 2 });

/**
 * Destructible material mask: the single source of collision and of the drawn
 * ground. Skills carve earth only; steel stays. Every mutation bumps
 * `revision` and records the touched rectangle so views can repaint only what
 * changed, without mutating this object.
 */
export class Terrain {
  constructor(width, height, rectangles = []) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new RangeError('Terrain necesita dimensiones enteras positivas');
    }
    this.width = width; this.height = height;
    this.cells = new Uint8Array(width * height);
    this.revision = 0; this.changes = [];
    for (const r of rectangles) this.write(r.x, r.y, r.width, r.height, MATERIAL[r.material ?? 'earth'] ?? MATERIAL.earth, false);
  }
  at(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    return x >= 0 && x < this.width && y >= 0 && y < this.height ? this.cells[y * this.width + x] : 0;
  }
  solid(x, y) { return this.at(x, y) !== 0; }
  /** Removes every material, steel included (authoring and tests; skills use carve). */
  clear(x, y, width, height) { return this.write(x, y, width, height, 0, true); }
  fill(x, y, width, height, material = MATERIAL.earth) { return this.write(x, y, width, height, material, true); }
  /** Removes earth only. Reports removed earth and steel found, so a skill can stop. */
  carve(x, y, width, height) {
    const { x0, y0, x1, y1 } = this.bounds(x, y, width, height);
    let earth = 0, steel = 0;
    for (let py = y0; py < y1; py++) {
      const row = py * this.width;
      for (let i = row + x0; i < row + x1; i++) {
        if (this.cells[i] === MATERIAL.earth) { this.cells[i] = 0; earth++; } else if (this.cells[i] === MATERIAL.steel) steel++;
      }
    }
    if (earth) this.track(x0, y0, x1, y1);
    return { earth, steel };
  }
  /** Carves a disc of earth (explosions); returns removed cells. */
  carveDisc(cx, cy, radius) {
    const { x0, y0, x1, y1 } = this.bounds(cx - radius, cy - radius, radius * 2 + 1, radius * 2 + 1);
    let earth = 0;
    for (let py = y0; py < y1; py++) {
      const dy = py + .5 - cy, row = py * this.width;
      for (let px = x0; px < x1; px++) {
        const dx = px + .5 - cx;
        if (dx * dx + dy * dy <= radius * radius && this.cells[row + px] === MATERIAL.earth) { this.cells[row + px] = 0; earth++; }
      }
    }
    if (earth) this.track(x0, y0, x1, y1);
    return earth;
  }
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
  bounds(x, y, width, height) {
    return { x0: Math.max(0, Math.floor(x)), y0: Math.max(0, Math.floor(y)),
      x1: Math.min(this.width, Math.ceil(x + width)), y1: Math.min(this.height, Math.ceil(y + height)) };
  }
  track(x0, y0, x1, y1) {
    this.revision++;
    this.changes.push({ revision: this.revision, x0, y0, x1, y1 });
    if (this.changes.length > HISTORY) this.changes.shift();
  }
  write(x, y, width, height, value, track) {
    const { x0, y0, x1, y1 } = this.bounds(x, y, width, height);
    let changed = 0;
    for (let py = y0; py < y1; py++) {
      const row = py * this.width;
      for (let i = row + x0; i < row + x1; i++) if (this.cells[i] !== value) { this.cells[i] = value; changed++; }
    }
    if (changed && track) this.track(x0, y0, x1, y1);
    return changed;
  }
}
