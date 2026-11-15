import { DIFFICULTIES } from '../difficulty.js';
import { compileStage, proofNeeds } from './compile.js';
import { levelErrors } from '../levels.js';
import { autoplay } from '../autoplay.js';

export const GENERATOR_VERSION = 2;
export const MAX_ATTEMPTS = 24;


// Seeded PRNG: same version + seed always produces the same puzzle and proof.
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Three independent decisions, shuffled and parameterized, using tutorial pieces. */
function candidate(seed, attempt, rng, difficulty) {
  const pick = items => items[Math.floor(rng() * items.length)];
  const descent = pick(['dig', 'mine', 'block+bomb']);
  const wall = pick(['bash', 'climb']);
  const crossing = pick(['build', 'float', 'bridge']);
  const length = pick([160, 180, 200]);
  const modules = [
    { name: descent === 'block+bomb' ? 'Contener y abrir el suelo' : descent === 'dig' ? 'Abrir un descenso' : 'Excavar una rampa',
      course: [['descend', { length, thick: descent === 'block+bomb' ? 6 : pick([20, 24]), down: 36, at: 48, key: descent }], ['run', { length: length + 50 }]] },
    { name: wall === 'bash' ? 'Atravesar un muro' : 'Escalar acero',
      course: [['wall', { height: pick([30, 38, 46]), width: pick([18, 24, 30]), key: wall, ...(wall === 'climb' ? { material: 'steel' } : {}) }], ['run', { length: pick([110, 130, 150]) }]] },
    { name: crossing === 'build' ? 'Construir una subida' : crossing === 'bridge' ? 'Cruzar el agua' : 'Salvar el acantilado',
      course: crossing === 'build' ? [['ledge', { up: 12, length: 130, key: 'build' }]]
        : crossing === 'bridge' ? [['gap', { width: 16, key: 'build' }], ['run', { length: 150 }]]
        : [['drop', { down: pick([150, 160]), key: 'float' }], ['run', { length: 150 }]] },
  ];
  for (let i = modules.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)); [modules[i], modules[j]] = [modules[j], modules[i]];
  }
  if (difficulty === 'normal') {
    const extra = pick([0, 1, 2]);
    for (let i = 0; i < extra; i++) modules.push({ name: 'Perforar otro muro',
      course: [['wall', { height: pick([34, 42]), width: pick([24, 32]), key: 'bash' }], ['run', { length: 110 }]] });
  }
  if (difficulty === 'hard') {
    const wallPiece = (key, name) => ({ name, course: [['wall', { height: pick([38, 46, 54]), width: pick([24, 32]), key,
      ...(key === 'climb' ? { material: 'steel' } : {}) }], ['run', { length: 110 }]] });
    const bridgePiece = () => ({ name: 'Tender un puente', course: [['gap', { width: 24, key: 'build' }], ['run', { length: 120 }]] });
    // Two mandatory descents connect exactly three main platform heights.
    // Obstacles on each floor vary without overlapping the floor above.
    const upper = [wallPiece('bash', 'Abrir el muro superior'), bridgePiece()];
    const middle = [wallPiece('climb', 'Escalar el muro de acero'), bridgePiece()];
    if (rng() < .5) upper.reverse();
    if (rng() < .5) middle.reverse();
    const lower = [wallPiece(pick(['bash', 'climb']), 'Resolver el muro final')];
    if (rng() < .5) lower.push(wallPiece('bash', 'Abrir el último paso'));
    modules.splice(0, modules.length, ...upper,
      { name: descent === 'block+bomb' ? 'Contener y detonar el suelo' : descent === 'dig' ? 'Cavar hacia el segundo piso' : 'Minar hacia el segundo piso',
        course: [['descend', { length: 180, thick: descent === 'block+bomb' ? 6 : 24, down: 40, at: 48, key: descent }], ['run', { length: 230 }]] },
      ...middle, { name: 'Descender al tercer piso con paracaídas', course: [['drop', { down: 150, key: 'float' }], ['run', { length: 150 }]] }, ...lower);
  }
  const profile = DIFFICULTIES[difficulty];
  const spec = {
    id: `${difficulty}-v${GENERATOR_VERSION}-${seed}-${attempt}`, number: 0, name: `Expedición ${profile.label.toLowerCase()}`,
    width: 3500, height: 420, origin: { x: 60, y: 100 }, total: 10, required: profile.required,
    seconds: profile.seconds, rate: 50, skills: { dig: 99, mine: 99, block: 99, bomb: 99, bash: 99, climb: 99, build: 99, float: 99 },
    music: pick(['atraviesa', 'escalera', 'bajar-y-trepar']),
    brief: `${modules.length} obstáculos. Rescata ${profile.required} de 10. ${profile.rules}`,
    hint: 'Observa la ruta antes de gastar habilidades. Puedes pausar para elegir y preparar tu siguiente acción.',
    course: [['start'], ['hatch', { length: 160 }], ...modules.flatMap(m => m.course), ['exit', { length: 100, at: 60 }]],
  };
  const draft = compileStage(spec);
  spec.skills = proofNeeds(draft.proof.triggers, spec.total);
  spec.width = Math.max(800, ...draft.terrain.map(r => r.x + r.width + 30));
  const level = compileStage(spec);
  // A half-height ledge allows a broader build window than the tutorial's full stair.
  for (const tr of level.proof.triggers) if (tr.skill === 'build') tr.x += tr.id?.startsWith('gap') ? (difficulty === 'hard' ? -7 : -13) : 12;
  return { ...level, mode: 'random', difficulty, singleUseSkills: difficulty !== 'easy', platformTiers: difficulty === 'hard' ? 3 : undefined, seed, generatorVersion: GENERATOR_VERSION,
    challenges: modules.map(m => m.name) };
}

/** Probe early/late human actions, not just the exact solution coordinates. */
export function shiftedProof(level, offset) {
  return level.proof.triggers.map(tr => ({ ...tr,
    ...(tr.x !== undefined && ['dig', 'mine', 'build', 'block', 'climb', 'float'].includes(tr.skill)
      ? { x: tr.x + offset } : {}),
  }));
}

/** Bounded search. Every returned stage has a verified solution; failure returns no stage. */
export function generateStage(seed, difficulty = 'easy') {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new TypeError('Semilla inválida');
  if (!Object.hasOwn(DIFFICULTIES, difficulty)) throw new TypeError('Dificultad inválida');
  const rng = random(seed);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const level = candidate(seed, attempt, rng, difficulty);
    if (levelErrors(level).length) continue;
    if (autoplay(level).result !== 'won') continue;
    if (difficulty !== 'easy' && [...new Set(level.proof.triggers.map(tr => tr.lock))].some(lock => autoplay(level, {
      triggers: level.proof.triggers.filter(tr => tr.lock !== lock),
    }).result === 'won')) continue;
    const margin = DIFFICULTIES[difficulty].margin;
    if ([-margin, margin].some(offset => autoplay(level, { triggers: shiftedProof(level, offset) }).result !== 'won')) continue;
    return level;
  }
  throw new Error('No se encontró una ruta válida. Prueba otra expedición.');
}

export const generateEasy = seed => generateStage(seed, 'easy');
