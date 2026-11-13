import { SKILLS } from './skills.js';

const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); for (const item of Object.values(value)) freeze(item);
  }
  return value;
};

/**
 * Authored stages: data only, independent of presentation and browser size.
 * `decor` and `preview` are drawn by the view and never collide.
 */
export const LEVELS = freeze([
  {
    id: 'just-dig', number: 1, name: 'Solo cava', width: 800, height: 360,
    total: 10, required: 1, seconds: 300, rate: 50,
    skills: { dig: 10 },
    spawn: { x: 234, y: 80 }, exit: { x: 623, y: 248, width: 25 },
    terrain: [
      // Upper platform: thick enough that digging through is real work,
      // walled at both ends so walkers turn back instead of falling off.
      { x: 100, y: 134, width: 616, height: 56 },
      { x: 100, y: 110, width: 12, height: 24 },
      { x: 704, y: 110, width: 12, height: 24 },
      // Lower island with its exit, also walled.
      { x: 116, y: 248, width: 586, height: 74 },
      { x: 116, y: 224, width: 12, height: 24 },
      { x: 690, y: 224, width: 12, height: 24 },
    ],
    hint: 'Excava la plataforma superior para bajar a la isla de la salida. Sin túnel, caminarán de pared a pared hasta que se acabe el tiempo.',
    decor: { vines: [159, 185, 452, 477], vineTop: 190, sign: { x: 541, y: 248 } },
    preview: [
      { x: 267, y: 134, state: 'walking' }, { x: 304, y: 134, state: 'walking' },
      { x: 338, y: 134, state: 'digging' }, { x: 537, y: 248, state: 'walking' },
      { x: 571, y: 248, state: 'walking' },
    ],
  },
]);
export const FIRST_LEVEL = LEVELS[0];
export const getLevel = id => LEVELS.find(level => level.id === id) ?? null;

const int = (v, min = -Infinity, max = Infinity) => Number.isInteger(v) && v >= min && v <= max;
const solidAt = (rects, x, y) => rects.some(r => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);

/** Returns a list of authoring errors in Spanish; empty means the level is playable. */
export function levelErrors(level) {
  const errors = [];
  if (!level || typeof level !== 'object') return ['El nivel debe ser un objeto'];
  const { width: w, height: h } = level;
  if (typeof level.id !== 'string' || !level.id) errors.push('id vacío');
  if (!int(w, 1, 4096) || !int(h, 1, 4096)) errors.push('dimensiones inválidas');
  if (!int(level.total, 1, 999)) errors.push('total inválido');
  if (!int(level.required, 0, level.total)) errors.push('objetivo fuera de 0..total');
  if (!(level.seconds > 0)) errors.push('tiempo inválido');
  if (!int(level.rate, 50, 99)) errors.push('ritmo fuera de 50..99');
  for (const [id, count] of Object.entries(level.skills ?? {})) {
    if (!SKILLS[id]) errors.push(`habilidad desconocida: ${id}`);
    if (!int(count, 0, 99)) errors.push(`inventario inválido: ${id}`);
  }
  const rects = Array.isArray(level.terrain) ? level.terrain : (errors.push('terreno ausente'), []);
  for (const r of rects) {
    if (!int(r.x, 0) || !int(r.y, 0) || !int(r.width, 1) || !int(r.height, 1) || r.x + r.width > w || r.y + r.height > h) {
      errors.push(`rectángulo fuera del mundo: ${JSON.stringify(r)}`);
    }
  }
  const { spawn, exit } = level;
  if (!spawn || !int(spawn.x, 0, w - 1) || !int(spawn.y, 0, h - 1)) errors.push('entrada fuera del mundo');
  else if (solidAt(rects, spawn.x, spawn.y)) errors.push('entrada dentro del terreno');
  if (!exit || !int(exit.x, 0, w - 1) || !int(exit.y, 1, h - 1) || !int(exit.width, 1)) errors.push('salida inválida');
  else if (!solidAt(rects, exit.x, exit.y) || solidAt(rects, exit.x, exit.y - 1)) errors.push('la salida debe apoyarse en la superficie');
  return errors;
}
export function assertLevel(level) {
  const errors = levelErrors(level);
  if (errors.length) throw new Error(`Nivel ${level?.id ?? '?'} inválido: ${errors.join('; ')}`);
  return level;
}
