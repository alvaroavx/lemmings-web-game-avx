const hash = (x, y) => ((Math.imul(x + 17, 374761393) ^ Math.imul(y + 31, 668265263)) >>> 0) / 4294967296;
const SOIL = [[87, 58, 50], [106, 71, 55], [125, 83, 58], [66, 46, 43], [144, 99, 66]];
const offscreen = (width, height) => {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas;
};

/**
 * Pixel-art presentation. Reads World, never changes it.
 * Layers: static background (built once per level), terrain bitmap (repainted
 * only inside the rectangles Terrain reports as changed), then live sprites.
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    this.level = null; this.terrain = null; this.revision = -1;
  }
  setLevel(level) {
    if (this.level === level) return;
    this.level = level; this.terrain = null;
    this.canvas.width = level.width; this.canvas.height = level.height;
    this.background = offscreen(level.width, level.height);
    this.drawBackground(this.background.getContext('2d'), level);
    this.terrainCanvas = offscreen(level.width, level.height);
    this.terrainCtx = this.terrainCanvas.getContext('2d');
    this.terrainImage = this.terrainCtx.createImageData(level.width, level.height);
  }
  syncTerrain(terrain) {
    let area;
    if (this.terrain !== terrain) {
      this.terrain = terrain; this.terrainImage.data.fill(0);
      area = { x: 0, y: 0, width: terrain.width, height: terrain.height };
    } else {
      area = terrain.changedSince(this.revision);
      if (!area) return;
      // A pixel's colour depends on neighbours one column aside and four rows above.
      area = { x: area.x - 1, y: area.y, width: area.width + 2, height: area.height + 4 };
    }
    this.revision = terrain.revision;
    const x0 = Math.max(0, area.x), y0 = Math.max(0, area.y);
    const x1 = Math.min(terrain.width, area.x + area.width), y1 = Math.min(terrain.height, area.y + area.height);
    this.paintTerrain(terrain, x0, y0, x1, y1);
    this.terrainCtx.putImageData(this.terrainImage, 0, 0, x0, y0, x1 - x0, y1 - y0);
  }
  paintTerrain(terrain, x0, y0, x1, y1) {
    const { cells, width } = terrain, data = this.terrainImage.data;
    const at = (x, y) => x >= 0 && x < width && y >= 0 && cells[y * width + x] === 1;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      if (cells[y * width + x] !== 1) { data[i + 3] = 0; continue; }
      let c;
      if (!at(x, y - 1)) c = [157, 205, 92];
      else if (!at(x, y - 4)) c = hash(x, y) > .3 ? [69, 117, 63] : [98, 145, 68];
      else if (!at(x - 1, y) || !at(x + 1, y)) c = [162, 111, 72];
      else if (hash(x, y) > .94) c = [169, 121, 81];
      else c = SOIL[Math.floor(hash(x / 3 | 0, y / 2 | 0) * SOIL.length)];
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }
  drawBackground(c, level) {
    const { width: w, height: h } = level;
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0c1827'); sky.addColorStop(1, '#0c181b');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    for (let i = 0; i < Math.round(w * h / 3030); i++) {
      c.fillStyle = i % 9 === 0 ? '#83b5b2' : '#314c5a';
      c.fillRect(Math.floor(hash(i, 1) * w), Math.floor(hash(i, 2) * h * .79), i % 9 === 0 ? 2 : 1, 1);
    }
    // Distant moon and angular ridges establish the Vector Field setting.
    const mx = w * .81, my = h * .19;
    c.fillStyle = '#192c38'; c.beginPath(); c.arc(mx, my, 31, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0e1c2b'; c.beginPath(); c.arc(mx - 10, my - 8, 29, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#274550'; c.beginPath(); c.ellipse(mx, my, 46, 9, -.4, 0, Math.PI * 2); c.stroke();
    const base = h * .883;
    for (let i = 0; i * 65 - 30 < w; i++) {
      const x = i * 65 - 30, ridge = 50 + hash(i, 8) * 100;
      c.fillStyle = i % 2 ? '#142127' : '#101e26';
      c.beginPath(); c.moveTo(x, base); c.lineTo(x + 12, base - ridge); c.lineTo(x + 29, base - 15 - ridge); c.lineTo(x + 62, base); c.fill();
    }
    c.strokeStyle = '#18322e'; c.beginPath(); c.moveTo(0, h * .94); c.lineTo(w, h * .94); c.stroke();
  }
  draw(world, { preview = false, selectedId = null, reducedMotion = false } = {}) {
    const c = this.ctx, level = world.level, t = reducedMotion ? 0 : world.time;
    this.setLevel(level); this.syncTerrain(world.terrain);
    c.imageSmoothingEnabled = false;
    c.drawImage(this.background, 0, 0);
    c.drawImage(this.terrainCanvas, 0, 0);
    this.drawDecor(c, level);
    this.drawHatch(c, level.spawn);
    this.drawExit(c, level.exit, t);
    const actors = preview ? (level.preview ?? []).map((a, i) => ({ id: i + 1, direction: 1, ...a })) : world.lemmings;
    for (const l of actors) {
      if (l.state === 'saved' || l.state === 'lost') continue;
      if (l.id === selectedId) {
        const x = Math.round(l.x), y = Math.round(l.y);
        c.strokeStyle = '#99ffd0'; c.lineWidth = 1; c.strokeRect(x - 10, y - 18, 20, 23);
        c.fillStyle = '#a9ffcd'; c.fillRect(x - 2, y - 23, 4, 3);
      }
      this.drawLemming(c, l, t);
    }
  }
  drawDecor(c, level) {
    const d = level.decor ?? {};
    // Vines hang outside the collision surface, purely decorative.
    for (const x of d.vines ?? []) {
      c.fillStyle = '#375947'; c.fillRect(x, d.vineTop, 1, 10 + x % 13);
      c.fillRect(x - 2, d.vineTop + 6, 4, 2); c.fillRect(x, d.vineTop + 13, 4, 2);
    }
    // Navigation marks belong to the landscape, away from character hit targets.
    c.font = '7px "AVX Mono", monospace'; c.textAlign = 'center';
    c.fillStyle = '#8ca49a'; c.fillText('ENTRADA', level.spawn.x, level.spawn.y - 35);
    c.fillStyle = '#86c9a5'; c.fillText('SALIDA', level.exit.x, level.exit.y - 50);
    if (d.sign) {
      const { x, y } = d.sign;
      c.fillStyle = '#8ba77a'; c.fillRect(x, y - 16, 16, 2); c.fillRect(x + 11, y - 19, 2, 8); c.fillRect(x + 14, y - 17, 2, 4);
      c.fillStyle = '#4e6950'; c.fillRect(x + 7, y - 13, 2, 13);
    }
  }
  drawHatch(c, spawn) {
    const x = spawn.x, y = spawn.y - 23;
    c.fillStyle = '#35565b'; c.fillRect(x - 19, y, 38, 16);
    c.fillStyle = '#6e8b83'; c.fillRect(x - 21, y - 3, 42, 4);
    c.fillStyle = '#1c303b'; c.fillRect(x - 14, y + 3, 28, 10);
    c.fillStyle = '#7debab'; c.fillRect(x - 11, y + 6, 22, 2);
    c.fillStyle = '#c6b67a'; c.fillRect(x - 19, y + 16, 7, 5); c.fillRect(x + 12, y + 16, 7, 5);
    c.fillStyle = '#283e42'; c.fillRect(x - 10, y + 15, 20, 3);
  }
  drawExit(c, exit, t) {
    const x = exit.x, y = exit.y;
    c.fillStyle = '#4c3b32'; c.fillRect(x - 21, y - 35, 42, 35);
    c.fillStyle = '#ba8f58'; c.fillRect(x - 25, y - 37, 50, 5);
    c.fillStyle = '#e0b970'; c.fillRect(x - 19, y - 39, 38, 3);
    c.fillStyle = '#846344'; c.fillRect(x - 21, y - 32, 7, 32); c.fillRect(x + 14, y - 32, 7, 32);
    c.fillStyle = '#102e2c'; c.fillRect(x - 12, y - 30, 24, 30);
    c.fillStyle = '#2c8b68'; c.fillRect(x - 10, y - 28, 20, 28);
    c.fillStyle = '#75e3a3'; c.fillRect(x - 8, y - 27, 2, 27); c.fillRect(x + 6, y - 27, 2, 27);
    c.fillStyle = '#b5fbd0'; c.fillRect(x - 8, y - 28, 16, 2);
    c.fillStyle = '#4cbd8b';
    for (let i = 0; i < 4; i++) c.fillRect(x - 5, y - 5 - ((i * 7 + t * 5) % 23), 10, 1);
    c.fillStyle = '#a4875c'; c.fillRect(x - 26, y - 3, 52, 3);
    c.fillStyle = '#efbe76'; c.fillRect(x - 26, y - 24, 3, 5); c.fillRect(x + 23, y - 24, 3, 5);
  }
  drawLemming(c, l, t) {
    const spread = l.state === 'digging' ? ((l.id % 3) - 1) * 4 : 0; // crew reads as a group; presentation only
    c.save(); c.translate(Math.round(l.x) + spread, Math.round(l.y)); c.scale(l.direction, 1);
    const stride = Math.floor(t * 9 + l.id) % 2;
    c.fillStyle = '#a4ef68'; c.fillRect(-4, -13, 7, 3); c.fillRect(-5, -11, 3, 4);
    c.fillStyle = '#f6d4b4'; c.fillRect(-2, -10, 5, 4); c.fillRect(2, -8, 2, 2);
    c.fillStyle = '#172e34'; c.fillRect(2, -10, 1, 1);
    c.fillStyle = '#7d8af3'; c.fillRect(-3, -6, 5, 5);
    c.fillStyle = '#b0c5ff'; c.fillRect(-3, -6, 2, 4);
    c.fillStyle = '#f6d4b4'; c.fillRect(2, l.state === 'falling' ? -8 : -5, 2, 2);
    c.fillStyle = '#f4eee0';
    c.fillRect(-4 + stride, -1, 3, 1); c.fillRect(1 - stride, -1, 3, 1);
    if (l.state === 'digging') {
      c.fillStyle = '#acced0'; c.fillRect(3, -5 + stride * 2, 1, 6); c.fillRect(2, 1 + stride * 2, 4, 2);
      c.fillStyle = '#b78b58'; c.fillRect(-7 - stride * 2, -1, 2, 2); c.fillRect(7 + stride, 2, 2, 2);
    }
    c.restore();
  }
}
