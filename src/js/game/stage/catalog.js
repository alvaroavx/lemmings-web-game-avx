/**
 * The authored campaign, as data. Each stage teaches what `teaches` lists and
 * proves it: the proof triggers come from the keys chosen in `course`, and the
 * tests check that the proof wins and that removing each taught skill loses.
 * Stage 1 is hand-drawn (raw rectangles and a manual trigger) to show that the
 * vocabulary is an aid, not a cage.
 */
export const CATALOG = [
  {
    id: 'just-dig', number: 1, name: 'Solo cava', width: 800, height: 360,
    total: 10, required: 1, seconds: 300, rate: 50, skills: { dig: 10 }, teaches: ['dig'],
    brief: 'Abre un túnel hacia la isla de la salida.',
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
    proof: { saves: 10, triggers: [{ skill: 'dig', x: 262, y: 134, who: 'one' }] },
  },
  {
    id: 'umbrella', number: 2, name: 'Paracaídas', width: 800, height: 360,
    total: 10, required: 7, seconds: 240, skills: { float: 10 }, teaches: ['float'],
    brief: 'El acantilado es demasiado alto: cada lemming necesita su paracaídas.',
    hint: 'Da un paracaídas a cada lemming antes de que llegue al borde. Es permanente: basta una vez.',
    origin: { x: 80, y: 100 },
    course: [
      ['start'], ['hatch', { length: 230, at: 50 }], ['drop', { down: 190, key: 'float' }],
      ['run', { length: 170 }], ['exit', { length: 110, at: 60 }],
    ],
  },
  {
    id: 'living-wall', number: 3, name: 'Muralla viva', width: 800, height: 360,
    total: 10, required: 8, seconds: 240, skills: { block: 2 }, teaches: ['block'],
    brief: 'La salida está detrás de ti y el camino termina en el vacío.',
    hint: 'Convierte en bloqueador al primero que se acerque al borde: los demás darán la vuelta hacia la salida.',
    origin: { x: 80, y: 170 },
    course: [
      ['start'], ['exit', { length: 100, at: 40, wall: false }], ['run', { length: 130 }],
      ['hatch', { length: 120, at: 40 }], ['run', { length: 120 }], ['cliff', { length: 40, key: 'block' }],
    ],
  },
  {
    id: 'up-and-down', number: 4, name: 'Bajar y trepar', width: 800, height: 360,
    total: 10, required: 7, seconds: 300, skills: { mine: 2, climb: 10 }, teaches: ['mine', 'climb'],
    brief: 'Mina en diagonal a través del suelo y luego escala el muro.',
    hint: 'Un minero abre una rampa hacia abajo. Abajo, un escalador sube muros: dáselo a cada uno antes del muro.',
    origin: { x: 60, y: 110 },
    course: [
      ['start'], ['hatch', { length: 120, at: 40 }],
      ['descend', { length: 230, thick: 30, down: 40, at: 30, key: 'mine' }],
      ['run', { length: 250 }], ['wall', { height: 46, width: 14, key: 'climb' }],
      ['exit', { length: 90, at: 45 }],
    ],
  },
  {
    id: 'pierce', number: 5, name: 'Atraviesa', width: 800, height: 360,
    total: 10, required: 8, seconds: 240, skills: { bash: 3 }, teaches: ['bash'],
    brief: 'Dos muros de tierra separan a la colonia de su salida.',
    hint: 'Asigna Perforar junto a cada muro: el lemming abre un túnel horizontal y se detiene al salir.',
    origin: { x: 70, y: 220 },
    course: [
      ['start'], ['hatch', { length: 150, at: 40 }], ['wall', { height: 70, width: 34, key: 'bash' }],
      ['run', { length: 110 }], ['wall', { height: 70, width: 46, key: 'bash' }],
      ['run', { length: 60 }], ['exit', { length: 90, at: 45 }],
    ],
  },
  {
    id: 'hold-and-blast', number: 6, name: 'Contén y detona', width: 800, height: 360,
    total: 10, required: 7, seconds: 240, skills: { block: 1, bomb: 1 }, teaches: ['bomb'],
    brief: 'Detén a la colonia junto al precipicio y abre el suelo con una explosión.',
    hint: 'Primero un bloqueador cerca del borde. Después hazlo detonar: el cráter atraviesa el suelo delgado.',
    origin: { x: 80, y: 130 }, thick: 16,
    course: [
      ['start'], ['hatch', { length: 90, at: 40 }],
      ['descend', { length: 300, thick: 6, down: 50, at: 230, end: 'cliff', key: 'block+bomb' }],
      ['exit', { length: 120, at: 50, wall: false }], ['run', { length: 140 }], ['end'],
    ],
  },
  {
    id: 'stairway', number: 7, name: 'Escalera', width: 800, height: 360,
    total: 10, required: 8, seconds: 300, skills: { build: 4 }, teaches: ['build'],
    brief: 'Dos escalones demasiado altos. Construye peldaños.',
    hint: 'El constructor pone 12 ladrillos. Empieza a unos 45 px del escalón; para uno doble, encadena dos constructores.',
    origin: { x: 70, y: 270 },
    course: [
      ['start'], ['hatch', { length: 200, at: 40 }], ['ledge', { up: 24, length: 150, key: 'build' }],
      ['ledge', { up: 48, length: 90, key: 'build' }], ['exit', { length: 100, at: 50 }],
    ],
  },
  {
    id: 'steel', number: 8, name: 'Acero', width: 800, height: 360,
    total: 10, required: 8, seconds: 300, skills: { dig: 2, bash: 2, build: 2 }, teaches: ['steel'],
    brief: 'El acero no se rompe. Busca el camino por la tierra.',
    hint: 'El muro gris es acero: rodéalo por debajo. Cava, perfora el muro del túnel y construye hasta la salida.',
    origin: { x: 70, y: 100 },
    course: [
      ['start'], ['hatch', { length: 90, at: 40 }],
      ['descend', { length: 200, thick: 24, down: 40, at: 70, key: 'dig', wall: 90, wallMaterial: 'steel' }],
      ['run', { length: 220, material: 'steel' }], ['wall', { height: 40, width: 30, key: 'bash' }],
      ['run', { length: 110 }], ['ledge', { up: 24, length: 60, key: 'build' }], ['exit', { length: 80, at: 40 }],
    ],
  },
  {
    id: 'two-hatches', number: 9, name: 'Dos compuertas', width: 800, height: 360,
    total: 20, required: 15, seconds: 300, skills: { float: 10, dig: 2 }, teaches: ['hatches'],
    brief: 'Dos grupos, dos problemas, una salida.',
    hint: 'La compuerta izquierda cae a un precipicio: paracaídas. La derecha queda encerrada: cava.',
    origin: { x: 60, y: 70 },
    course: [
      ['start'], ['hatch', { length: 170, at: 50 }], ['drop', { down: 200, key: 'float', limit: 10 }],
      ['run', { length: 120 }], ['exit', { length: 80, at: 40, wall: false }], ['run', { length: 280 }], ['end'],
      ['goto', { x: 470, y: 150 }], ['start'],
      ['hatch', { length: 70, at: 30 }], ['descend', { length: 180, thick: 26, down: 50, at: 60, key: 'dig' }],
    ],
    proof: { saves: 15 },
  },
  {
    id: 'the-beast', number: 10, name: 'La bestia', width: 980, height: 360,
    total: 12, required: 9, seconds: 420, skills: { bash: 1, dig: 1, build: 1, float: 12, block: 1 },
    teaches: ['water'],
    brief: 'Examen final: muro, suelo, agua y abismo. Inventario justo.',
    hint: 'Perfora el muro, cava el suelo, tiende un puente sobre el agua y da paracaídas antes del abismo. Cada habilidad se usa una vez.',
    origin: { x: 60, y: 90 },
    course: [
      ['start'], ['hatch', { length: 150, at: 40 }], ['wall', { height: 40, width: 24, key: 'bash' }],
      ['run', { length: 40 }], ['descend', { length: 180, thick: 20, down: 34, at: 60, key: 'dig' }],
      ['run', { length: 240 }], ['gap', { width: 44, key: 'build' }],
      ['run', { length: 130 }], ['drop', { down: 150, key: 'float' }], ['run', { length: 150 }],
      ['exit', { length: 90, at: 45 }],
    ],
  },
];
