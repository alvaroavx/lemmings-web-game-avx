import { SKILLS } from './skills.js';
import { CATALOG } from './stage/catalog.js';
import { compileStage } from './stage/compile.js';

const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); for (const item of Object.values(value)) freeze(item);
  }
  return value;
};

/** Authored stages, compiled from data (see stage/catalog.js and docs/stages.md). */
export const LEVELS = freeze(CATALOG.map(compileStage));
export const FIRST_LEVEL = LEVELS[0];
export const getLevel = id => LEVELS.find(level => level.id === id) ?? null;

/**
 * Canonical runtime shape: `hatches`, `exits`, `hazards` arrays. Singular
 * `spawn`/`exit` remain valid authoring shorthand and win when present.
 * Cached per object so the same level always yields the same normalized one.
 */
const normalized = new WeakMap();
export function normalizeLevel(level) {
  if (!level || typeof level !== 'object') return level;
  if (normalized.has(level)) return normalized.get(level);
  const result = Object.freeze({
    ...level,
    hatches: level.spawn ? [level.spawn] : level.hatches ?? [],
    exits: level.exit ? [level.exit] : level.exits ?? [],
    hazards: level.hazards ?? [],
  });
  normalized.set(level, result); return result;
}

const int = (v, min = -Infinity, max = Infinity) => Number.isInteger(v) && v >= min && v <= max;
const solidAt = (rects, x, y) => rects.some(r => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
const rectOk = (r, w, h) => int(r.x, 0) && int(r.y, 0) && int(r.width, 1) && int(r.height, 1) && r.x + r.width <= w && r.y + r.height <= h;

/** Returns a list of authoring errors in Spanish; empty means the level is playable. */
export function levelErrors(raw) {
  if (!raw || typeof raw !== 'object') return ['El nivel debe ser un objeto'];
  const level = normalizeLevel(raw), errors = [...(level.authoring ?? [])];
  const { width: w, height: h } = level;
  if (typeof level.id !== 'string' || !level.id) errors.push('id vacío');
  if (!int(w, 1, 4096) || !int(h, 1, 4096)) errors.push('dimensiones inválidas');
  if (!int(level.total, 1, 999)) errors.push('total inválido');
  if (!int(level.required, 0, level.total)) errors.push('objetivo fuera de 0..total');
  if (!(level.seconds > 0)) errors.push('tiempo inválido');
  if (!int(level.rate, 50, 99)) errors.push('ritmo fuera de 50..99');
  for (const [id, count] of Object.entries(level.skills ?? {})) {
    if (!Object.hasOwn(SKILLS, id)) errors.push(`habilidad desconocida: ${id}`);
    if (!int(count, 0, 99)) errors.push(`inventario inválido: ${id}`);
  }
  const rects = Array.isArray(level.terrain) ? level.terrain : (errors.push('terreno ausente'), []);
  for (const r of rects) {
    if (!rectOk(r, w, h)) errors.push(`rectángulo fuera del mundo: ${JSON.stringify(r)}`);
    if (r.material && r.material !== 'earth' && r.material !== 'steel') errors.push(`material desconocido: ${r.material}`);
  }
  for (const z of level.hazards) if (!rectOk(z, w, h) || z.type !== 'water') errors.push(`peligro inválido: ${JSON.stringify(z)}`);
  if (!level.hatches.length) errors.push('entrada ausente');
  for (const spawn of level.hatches) {
    if (!spawn || !int(spawn.x, 0, w - 1) || !int(spawn.y, 0, h - 1)) errors.push('entrada fuera del mundo');
    else if (solidAt(rects, spawn.x, spawn.y)) errors.push('entrada dentro del terreno');
  }
  if (!level.exits.length) errors.push('salida ausente');
  for (const exit of level.exits) {
    if (!exit || !int(exit.x, 0, w - 1) || !int(exit.y, 1, h - 1) || !int(exit.width, 1)) errors.push('salida inválida');
    else if (!solidAt(rects, exit.x, exit.y) || solidAt(rects, exit.x, exit.y - 1)) errors.push('la salida debe apoyarse en la superficie');
  }
  return errors;
}
export function assertLevel(level) {
  const errors = levelErrors(level);
  if (errors.length) throw new Error(`Nivel ${level?.id ?? '?'} inválido: ${errors.join('; ')}`);
  return level;
}
