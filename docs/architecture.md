# Arquitectura

Lemmings AVX es un juego real construido sobre un motor pequeño. El motor crece cuando un nivel o una habilidad lo exigen, con pruebas, no por anticipación. Esta página describe las capas, sus contratos y cómo extenderlas.

## Capas

```text
src/js/
  main.js            raíz de composición: crea adaptadores y arranca la app
  engine/            genérico y puro (sin navegador, sin azar, sin reloj real)
    clock.js         acumulador de paso fijo acotado
    terrain.js       máscara binaria destructible con historial de regiones
  game/              reglas de Lemmings, puras y deterministas
    levels.js        datos de etapas + validación de autoría
    skills.js        tabla de habilidades (contrato canAssign/begin/update)
    world.js         simulación, comandos validados y registro por tick
    replay.js        reconstrucción exacta de una partida desde su registro
  view/
    renderer.js      Canvas 2D: fondo cacheado, terreno por regiones, sprites
  platform/          adaptadores del navegador
    loop.js          único requestAnimationFrame; tiempo real → Clock
    surface.js       ajuste del lienzo al viewport y puntero → mundo
    audio.js         señales sintetizadas opcionales (Web Audio)
    storage.js       preferencias y mejor rescate por etapa, tolerante a fallos
  app/               interfaz HTML y coordinación
    game-app.js      máquina de estados, entradas → comandos, eventos → UI
    hud.js           contadores con escritura acotada
    dialog.js        <dialog> único con foco y Escape
    dom.js           utilidades sin innerHTML
```

Dependencias permitidas: `app → game, view, platform, engine`; `view → (lee) game`; `game → engine`. `engine` y `game` no importan nada del navegador. La prueba `tests/engine.test.mjs` lo hace cumplir: falla si aparecen `document`, `window`, `localStorage`, `requestAnimationFrame`, temporizadores, `Math.random`, `Date.now`, `fetch` o Web Audio en esas carpetas.

## Simulación

`World` avanza solo con `update(1/60)`. Cada llamada incrementa `tick`. La velocidad ×3 ejecuta tres veces más pasos; el tamaño del paso nunca cambia. `Clock` limita un cuadro atrasado a 100 ms, así que a ×3 procesa como máximo 18 pasos por cuadro. Después de una suspensión no hay espiral de recuperación; en equipos muy lentos el tiempo de juego puede quedar detrás del real.

**Comandos.** Toda acción del jugador pasa por `world.assign(id, skill)` o `world.setRate(rate)`. Ambos validan, devuelven `false` sin efectos si no proceden y, cuando proceden, se registran en `world.log` como `{ tick, type, ... }`. El inventario solo baja después de que `canAssign` aprueba. Un mundo terminado rechaza comandos y no cambia con nuevas actualizaciones.

**Repetición.** `replay(level, log)` crea un mundo nuevo y aplica cada comando antes del `update` de su tick, igual que en la partida en vivo. La prueba compara el JSON completo del mundo repetido con el original. Sirve para reproducir errores, para pruebas de regresión y, más adelante, para fantasmas o soluciones compartidas. Si cambian las reglas, los registros antiguos dejan de ser válidos: habrá que versionarlos cuando se guarden.

**Eventos.** World emite eventos breves (`spawn`, `dig`, `debris`, `saved`, `lost`, `victory`, `defeat`; los de fin de lemming llevan `id`). La app los consume en el mismo cuadro para sonido, anuncios y limpieza de selección. La cola está acotada a 512 entradas, así que una simulación sin consumidor (por ejemplo, en pruebas) no crece sin límite. Ningún evento decide el resultado.

**Contadores.** `released` cuenta los lemmings que salieron por la escotilla; `remaining = total − released`. Al agotarse el tiempo, los activos y los que no salieron se cuentan como perdidos y `remaining` queda en 0, de modo que el HUD final es coherente.

## Movimiento y terreno

El mundo lógico de la etapa 1 mide **800×360**. `Terrain` es un `Uint8Array` de 288 000 bytes y es la única fuente de colisión y del suelo dibujado. Los rectángulos de autoría no cuentan como cambios. Cada `clear`/`fill` que modifica celdas incrementa `revision` y guarda el rectángulo tocado (hasta 128). `changedSince(revision)` devuelve la unión de regiones posteriores sin mutar nada; si el observador está más atrasado que el historial, devuelve el terreno entero.

Reglas de un caminante (`RULES` en `world.js`):

- Los pies están sobre la primera fila sólida.
- Sube escalones de hasta `stepUp = 4` píxeles y baja hasta `stepDown = 3` sin pasar a estado de caída.
- Gira ante un obstáculo más alto que un escalón, comprobado `wallProbe = 3` píxeles por delante. Así nunca camina dentro del terreno.
- Cae cuando no hay suelo. La caída recorre las filas cruzadas para no atravesar suelos finos, y morir depende de la altura (`safeFall = 125`).
- Se pierde al salir del mundo. Se salva al caminar dentro del rectángulo de la salida.

**Habilidades.** `skills.js` define cada habilidad con `canAssign`, `begin` y `update`, además del estado que controla. World despacha por estado: un lemming en `digging` lo actualiza la habilidad `dig`; `walking` y `falling` son movimiento base. Cavar borra una franja de 16×2 cada 120 ms y se convierte en caída al terminar el suelo.

## Presentación

`Renderer.setLevel(level)` dimensiona el lienzo según el nivel y dibuja una sola vez el fondo estático (cielo, estrellas, luna, crestas). Cada cuadro compone tres capas: el fondo cacheado, el bitmap de terreno y los elementos vivos (decoración, escotilla, salida animada, lemmings y selección). El terreno se repinta solo en la región que informa `changedSince`, ampliada lo necesario porque el color de un píxel depende de una columna a cada lado y de cuatro filas superiores. La escritura usa un `ImageData` persistente con `putImageData` limitado a esa región, sin crear arrays por píxel. Antes se reconstruían 288 000 píxeles completos en cada golpe de pala.

El renderer lee posiciones de `level.spawn`, `level.exit` y `level.decor` (enredaderas, señal) y los actores de portada de `level.preview`. No queda geometría de la etapa 1 escrita en el código de dibujo.

`Surface` ajusta el mundo **completo** al espacio disponible, a lo ancho y a lo alto, sin recortes ni desplazamiento, y convierte el puntero a coordenadas de mundo. El radio de selección se expresa en píxeles de pantalla y se convierte a unidades de mundo (`worldRadius`): 12 px con ratón y 28 px al tacto, con un mínimo de 14 y 22 unidades. Así los objetivos siguen siendo alcanzables cuando el mundo se reduce en pantallas estrechas. En vertical a 390 px el mundo se ve a ≈0,46×: completo pero pequeño. Ver «Pendiente».

## Aplicación

Estados: `menu → playing ⇄ paused`, `playing → result → menu | playing`. Menú, pausa y resultado no actualizan World. Cada transición vacía el acumulador del reloj y el tiempo del bucle, así que la pausa nunca se acumula. Ocultar la pestaña pausa la partida y exige continuar a mano. Reiniciar pide confirmación y reemplaza World y su máscara.

El HUD escribe como máximo cada 100 ms y solo si un valor cambió. Los textos de menú, HUD, diálogos y anuncios se derivan del nivel (número, nombre, total, objetivo, minutos). Los diálogos se construyen con nodos DOM, nunca con `innerHTML`. Los anuncios van a una región `aria-live`.

Persistencia: una sola clave, `avx-lemmings-v1`, con `{ muted, best: { [levelId]: n } }`. Se escribe al cambiar el sonido o al mejorar un récord. Se migra el formato anterior (`best` numérico pasa a la etapa 1). JSON inválido, tipos inesperados o almacenamiento bloqueado vuelven a los valores por defecto.

## Cómo extender

- **Nueva etapa:** añadir un objeto a `LEVELS`. `levelErrors` valida dimensiones, inventario, rectángulos dentro del mundo, entrada fuera del terreno y salida apoyada en una superficie. Añadir pruebas de solución y de derrota. La selección de etapa en el menú se añadirá cuando exista la segunda.
- **Nueva habilidad:** añadir una entrada a `SKILLS` con su estado, su pose en `drawLemming`, un botón en la barra y sus pruebas. El bucle de World no cambia. Bloqueadores u otras interacciones entre lemmings necesitarán una consulta espacial en World, que hoy no existe porque no hace falta.
- **Materiales:** si un nivel necesita acero o suelo indestructible, ampliar la máscara a valores por material (0 = vacío) sin romper `solid`.
- **Niveles grandes:** medir antes. Las vías previstas son una cámara con desplazamiento en `Surface` y fragmentar el bitmap del terreno en baldosas.

## Origen

La primera iteración partió de revisar `asteroids-web-game-avx` como fuente de experiencia, no como dependencia. Se conservaron Canvas 2D con módulos ES, HTML para la interfaz, fuentes locales, audio sintetizado tras un gesto, pausa por visibilidad y ausencia de servicios externos. Se evitaron tres cosas observadas allí: un controlador que mezclaba reglas, dibujo, DOM y almacenamiento; escrituras a localStorage desde el bucle; e integración con `dt` variable. Asteroids no se modificó.

## Pendiente

- Decidir si en móvil vertical el mundo debe mantener una escala mínima con desplazamiento y cámara que siga la selección (era la intención documentada originalmente), o si basta el ajuste completo actual.
- El terreno visual no equivale a una experiencia no visual completa: el teclado permite jugar, pero no describe el mapa.
- Compartir `engine/` con otros juegos solo cuando haya código estable realmente común. Por ahora los repositorios siguen siendo independientes.
