import { PIECES } from './pieces.js';
import { SKILLS } from '../skills.js';

/**
 * The turtle walks the route and lays it. It knows nothing about specific
 * pieces: pieces call these primitives. Everything here is pure data.
 */
class Turtle {
  constructor(spec) {
    this.width = spec.width; this.height = spec.height; this.thick = spec.thick ?? 16;
    this.x = spec.origin?.x ?? 60; this.y = spec.origin?.y ?? 120; this.landingX = this.x;
    this.terrain = []; this.hazards = []; this.hatches = []; this.exits = []; this.floors = [];
    this.triggers = []; this.errors = []; this.where = '';
  }
  rect(x, y, width, height, material) {
    const r = { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
    if (material && material !== 'earth') r.material = material;
    this.terrain.push(r); return r;
  }
  floor(length, { material } = {}) {
    this.floors.push(this.rect(this.x, this.y, length, this.thick, material)); this.x += length;
  }
  landing() { this.landingX = this.x; }
  hatch(x, y, direction) { this.hatches.push({ x: Math.round(x), y: Math.round(y), ...(direction ? { direction } : {}), floor: this.y }); }
  exit(x, y, width) { this.exits.push({ x: Math.round(x), y: Math.round(y), width }); }
  hazard(x, y, width, height, type = 'water') {
    this.hazards.push({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height), type });
  }
  fail(message) { this.errors.push(`${this.where}: ${message}`); return []; }
}

const jobState = id => Object.keys(SKILLS[id]?.states ?? {})[0] ?? 'walking';
/** Inventory a proof needs: one per 'one' trigger, the whole colony (or `limit`) per 'all'. */
export function proofNeeds(triggers, total) {
  const needs = {};
  for (const tr of triggers) needs[tr.skill] = (needs[tr.skill] ?? 0) + (tr.who === 'all' ? tr.limit ?? total : 1);
  return needs;
}

/**
 * Stage spec → playable level. A spec is data: metadata, inventory and a
 * `course` of [piece, params] steps (plus optional raw `terrain`, `spawn`,
 * `exit` and `proof.triggers` for hand-drawn stages). The result is a level
 * World can run, with its proof attached and any authoring error listed in
 * `authoring` (levelErrors reports them; World refuses such levels).
 */
export function compileStage(spec) {
  const t = new Turtle(spec);
  (spec.course ?? []).forEach(([name, params = {}], index) => {
    t.where = `${spec.id} #${index} ${name}`;
    const piece = PIECES[name];
    if (!piece) { t.fail('pieza desconocida'); return; }
    const geometry = piece.lay(t, params);
    if (params.key) {
      const key = piece.keys?.[params.key];
      if (!key) t.fail(`la llave «${params.key}» no abre esta pieza`);
      // `limit` caps 'all' keys, e.g. when only one hatch's group crosses this lock.
      else t.triggers.push(...key(t, geometry).map(tr => ({ ...tr, lock: index,
        ...(tr.who === 'all' && params.limit ? { limit: params.limit } : {}) })));
    } else if (piece.locked?.(geometry)) t.fail('cerradura sin llave: elige una habilidad que la abra');
  });
  const triggers = [...t.triggers, ...(spec.proof?.triggers ?? [])].map(tr =>
    Object.fromEntries(Object.entries(tr).filter(([, v]) => v !== undefined)));
  const needs = proofNeeds(triggers, spec.total);
  for (const [skill, count] of Object.entries(needs)) {
    if (!((spec.skills?.[skill] ?? 0) >= count)) t.errors.push(`${spec.id}: la prueba usa ${count} × ${skill} y el inventario tiene ${spec.skills?.[skill] ?? 0}`);
  }
  const hatches = t.hatches.map(({ floor, ...h }) => h);
  const level = {
    id: spec.id, number: spec.number, name: spec.name, brief: spec.brief, hint: spec.hint,
    ...(spec.music ? { music: spec.music } : {}),
    teaches: spec.teaches ?? [], width: spec.width, height: spec.height,
    total: spec.total, required: spec.required, seconds: spec.seconds, rate: spec.rate ?? 50,
    skills: { ...spec.skills },
    terrain: [...(spec.terrain ?? []), ...t.terrain],
    hazards: [...(spec.hazards ?? []), ...t.hazards],
    ...(spec.spawn ? { spawn: spec.spawn } : { hatches }),
    ...(spec.exit ? { exit: spec.exit } : { exits: t.exits }),
    decor: spec.decor ?? { vines: t.floors.filter(f => f.width >= 60).flatMap(f =>
      Array.from({ length: Math.floor((f.width - 30) / 67) + 1 }, (_, k) => ({ x: f.x + 17 + k * 67 + (f.x * 7 % 11), y: f.y + f.height }))) },
    preview: spec.preview ?? [
      ...t.hatches.slice(0, 2).map(h => ({ x: h.x + 22, y: h.floor, state: 'walking' })),
      ...triggers.filter(tr => tr.x !== undefined).slice(0, 3).map(tr => ({ x: tr.x, y: tr.y, state: jobState(tr.skill) })),
    ],
    proof: { saves: spec.proof?.saves ?? spec.required, triggers },
    authoring: t.errors,
  };
  return level;
}
