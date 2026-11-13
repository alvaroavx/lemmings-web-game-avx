# Cómo se construyen las etapas

Una etapa no se dibuja: se **recorre**. Se escribe como la ruta que hará la colonia, pieza a pieza, y cada pieza que cierra el paso dice qué habilidad lo abre y cómo. Por eso cada etapa trae su propia **prueba** de que tiene solución, y las pruebas automáticas comprueban además que cada habilidad que enseña es **imprescindible**.

Este diseño sirve para dos cosas: escribir a mano las etapas de la campaña y, más adelante, generar etapas aleatorias con el mismo vocabulario y la misma verificación (ver «Hacia el generador»).

## Cuatro ideas

1. **La tortuga de ruta.** El compilador (`game/stage/compile.js`) avanza una «tortuga» por el mundo. Está en `(x, y)`, donde `y` es la superficie por la que se camina. Cada pieza pone terreno relativo a ella y la mueve. No hay coordenadas absolutas que mantener: si se alarga un tramo, todo lo siguiente se desplaza solo.

2. **Cerraduras y llaves.** Cada pieza (`game/stage/pieces.js`) puede crear una *cerradura*: un muro más alto que un escalón, una caída mortal, un suelo sellado, un vacío o agua. Una cerradura sin llave es un error de autoría. Cada pieza enumera las *llaves* que la abren (`wall`: `bash`, `climb`, `build`; `drop`: `float`; `descend`: `dig`, `mine`, `block+bomb`; `ledge`: `build`, `climb`; `gap`: `build`; `cliff`: `block`). Las llaves compuestas (`block+bomb`) son recetas de varias habilidades en orden.

3. **Cada llave trae su solución.** Al elegir una llave, la pieza emite los *disparadores* que la abren: «al primer caminante que cruce x = 262 en y = 134, asígnale Cavar» o «a todos los que crucen x = 270, Paracaídas». Las cadenas (dos constructores seguidos, bloquear y luego detonar al bloqueador) se expresan con `id`, `after` y `delay`. La suma de disparadores es la **prueba** de la etapa.

4. **La prueba se ejecuta, no se cree.** `game/autoplay.js` juega la prueba con los mismos comandos que un jugador (`world.assign`), sobre la misma simulación determinista. `tests/stages.test.mjs` exige, para cada etapa:
   - que la prueba gane y salve al menos `proof.saves`;
   - que su registro de comandos reproduzca la partida idéntica;
   - que el inventario alcance para la prueba (lo comprueba también el compilador);
   - **necesidad**: quitando los disparadores de cada habilidad, la etapa se pierde. Así ninguna etapa enseña una habilidad que en realidad sobra.

```text
spec (datos) ──compileStage──▶ level + proof ──World──▶ partida
     │                │                          ▲
     │                └─ errores de autoría ─────┤ levelErrors (World se niega a correrla)
     └─ course: [pieza, {parámetros, key}]       │
                                  autoplay(level) ┴─▶ gana · se repite idéntica · cada llave es necesaria
```

## Escribir una etapa

Una etapa es un objeto en `game/stage/catalog.js`:

```js
{
  id: 'stairway', number: 7, name: 'Escalera', width: 800, height: 360,
  total: 10, required: 8, seconds: 300, skills: { build: 4 }, teaches: ['build'],
  brief: 'Dos escalones demasiado altos. Construye peldaños.',
  hint: 'El constructor pone 12 ladrillos…',
  origin: { x: 70, y: 270 },
  course: [
    ['start'], ['hatch', { length: 200, at: 40 }],
    ['ledge', { up: 24, length: 150, key: 'build' }],
    ['ledge', { up: 48, length: 90, key: 'build' }],   // dos constructores encadenados, calculados por la pieza
    ['exit', { length: 100, at: 50 }],
  ],
}
```

Pasos:

1. Escribir la ruta con piezas y elegir una llave para cada cerradura.
2. `npm test`. Si el compilador protesta (cerradura sin llave, llave que no encaja, acero perforado, inventario corto, caída mortal escondida), el mensaje dice qué pieza y por qué.
3. Si la prueba no gana o una habilidad resulta innecesaria, ajustar geometría o inventario. Durante el afinado conviene imprimir cada etapa con su resultado, el inventario usado y lo que se salva sin cada habilidad. Es lo que hace `tests/stages.test.mjs`, con más detalle.
4. Jugarla en el navegador desde el menú hasta el resultado: la prueba automática no sustituye a la prueba visual.

`required` no debe igualar lo que salva la prueba, que es un jugador perfecto. Hay que dejar margen al humano.

Piezas sin cerradura: `start`, `run`, `hatch`, `exit`, `end`, `goto` (segunda ruta o segunda compuerta), `shape` (rectángulos libres relativos a la tortuga). Una etapa también puede declarar `terrain`, `spawn`, `exit` y `proof.triggers` crudos, como la etapa 1, dibujada a mano: el vocabulario ayuda, pero no encierra.

## Añadir una habilidad

1. Una entrada en `SKILLS` (`game/skills.js`) con `canAssign`, `begin` y uno de estos contratos:
   - **job**: `states: { estado: actualizar }`. World despacha por estado (`SKILL_BY_STATE`).
   - **trait** o **fuse**: guarda algo en `lemming.traits` y reacciona con `hooks` (`wall`, `fallCap`, `survives`, `tick`).
   - `turnsWalkers: true` si quien la ejerce debe hacer dar la vuelta a los caminantes.

   World no nombra ninguna habilidad.
2. `canAssign` debe rechazar lo inútil (Perforar sin tierra delante, Cavar sobre acero): el inventario solo baja si la asignación vale.
3. Su `role` y las piezas cuyas cerraduras abre: añadir la llave en `pieces.js`, con sus disparadores.
4. Su pose en `view/renderer.js`, su icono y textos en `app/skill-ui.js`, su sonido opcional en `platform/audio.js`.
5. Pruebas en `tests/skills.test.mjs`.

## Añadir una pieza

`lay(t, params)` pone geometría con las primitivas de la tortuga (`rect`, `floor`, `hatch`, `exit`, `hazard`, `landing`, `fail`) y devuelve la geometría que necesitan sus llaves. `locked(g)` dice si cierra el paso. `keys` asocia cada llave a una función que devuelve disparadores, o `t.fail(motivo)` si esa llave no sirve con estos parámetros. Las restricciones físicas (alcance de un constructor, grosor que atraviesa una bomba, caída segura) se calculan a partir de `RULES` y `SKILLS`, nunca como números sueltos. Así un cambio de reglas invalida las etapas que dejan de funcionar, en vez de romperlas en silencio.

## La campaña

| # | Etapa | Novedad | Llaves de la prueba | Música |
| --- | --- | --- | --- | --- |
| 1 | Solo cava | Cavar, cuadrillas | dig | marcha (Do mayor, 126) |
| 2 | Paracaídas | Habilidad permanente, caída mortal | float × todos | Marcha en el aire (Fa, 112, ligera) |
| 3 | Muralla viva | Interacción entre lemmings | block | Marcha de guardia (Re, frases BA) |
| 4 | Bajar y trepar | Minero (diagonal) y escalador | mine, climb × todos | Marcha de cordada (Si♭, 132, bajo caminante) |
| 5 | Atraviesa | Perforar en horizontal | bash × 2 | Marcha a golpes (138, batería intensa) |
| 6 | Contén y detona | Mecha, cráter, bloquear y luego detonar | block+bomb | Marcha con mecha (Do menor, tensa) |
| 7 | Escalera | Construir, cadenas de constructores | build × 3 | Marcha de peldaños (Mi, AABB) |
| 8 | Acero | Material indestructible | dig, bash, build | Marcha de acero (Si♭ menor, 116) |
| 9 | Dos compuertas | Varias entradas, 20 lemmings, multitarea | float × 10, dig | Marcha a dos voces (Re, 140, ABBA) |
| 10 | La bestia | Agua, mapa ancho con cámara, inventario justo | bash, dig, build, float × 12 | Marcha de la bestia (Do menor, 144) |

Cada etapa declara `music` con una variación del tema (`platform/music.js`). Una etapa nueva puede reutilizar una variación o añadir otra a `VARIATIONS`.

## Hacia el generador (aún no implementado)

El generador será otro autor que escribe `course`, no un motor nuevo:

1. **Gramática.** Una secuencia de piezas elegidas con una semilla (PRNG determinista; nunca `Math.random` en `game/`), alternando tramos (`run`, `hatch`, `exit`) y cerraduras.
2. **Presupuesto.** Elegir primero qué habilidades se combinan y cuántos usos hay. Cada cerradura consume la llave que le toque. La pieza ya sabe qué llaves acepta y cuánto inventario cuesta cada una (`proofNeeds`).
3. **Parámetros dentro de los límites físicos.** Alturas, anchos y grosores sorteados en los rangos que las propias piezas validan.
4. **Verificación por simulación.** Compilar, rechazar si hay errores, jugar la prueba (`autoplay`) y exigir victoria y necesidad de cada llave. Lo que no pasa se descarta y se sortea de nuevo. Una etapa generada se guarda solo como `{ semilla, versión de reglas }`.
5. **Dificultad medible.** Margen de tiempo (segundos sobrantes de la prueba), margen de inventario, `required` frente a lo que salva la prueba y número de cerraduras. Todo sale de la misma ejecución.
6. **Decisiones, no solo obstáculos.** Una pieza con varias llaves (un muro que se perfora o se escala) da opciones. Ofrecer inventario para las dos y comprobar con `withoutSkill` que cada una sola basta crea etapas con varias soluciones. Comprobar que ninguna basta sola crea etapas que obligan a combinar.

Los pasos 1, 2, 3 y 5 faltan. El 4 ya existe y es el que da la robustez.
