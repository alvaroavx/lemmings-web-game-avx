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
    music.js         música original sintetizada con planificador anticipado
    storage.js       preferencias y mejor rescate por etapa, tolerante a fallos
  app/               interfaz HTML y coordinación
    game-app.js      máquina de estados, entradas → comandos, eventos → UI
    hud.js           contadores con escritura acotada
    screens.js       pantallas completas (menú, pausa, reinicio, ayuda, resultado)
    dom.js           utilidades sin innerHTML
```

Dependencias permitidas: `app → game, view, platform, engine`; `view → (lee) game`; `game → engine`. `engine` y `game` no importan nada del navegador. La prueba `tests/engine.test.mjs` lo hace cumplir: falla si aparecen `document`, `window`, `localStorage`, `requestAnimationFrame`, temporizadores, `Math.random`, `Date.now`, `fetch` o Web Audio en esas carpetas.

## Simulación

`World` avanza solo con `update(1/60)`. Cada llamada incrementa `tick`. La velocidad ×3 ejecuta tres veces más pasos; el tamaño del paso nunca cambia. `Clock` limita un cuadro atrasado a 100 ms, así que a ×3 procesa como máximo 18 pasos por cuadro. Después de una suspensión no hay espiral de recuperación; en equipos muy lentos el tiempo de juego puede quedar detrás del real.

**Comandos.** Toda acción del jugador pasa por `world.assign(id, skill)` o `world.setRate(rate)`. Ambos validan, devuelven `false` sin efectos si no proceden y, cuando proceden, se registran en `world.log` como `{ tick, type, ... }`. El inventario solo baja después de que `canAssign` aprueba. Un mundo terminado rechaza comandos y no cambia con nuevas actualizaciones.

**Detener una habilidad.** `world.cancel(id)` detiene a un lemming que está ejecutando una habilidad con estado propio (hoy, cavar): vuelve a caminar desde donde está, el hoyo queda y el uso vuelve al inventario. Es un comando más: se valida, se registra y se repite. Un caminante no tiene nada que cancelar.

**Repetición.** `replay(level, log)` crea un mundo nuevo y aplica cada comando antes del `update` de su tick, igual que en la partida en vivo. La prueba compara el JSON completo del mundo repetido con el original. Sirve para reproducir errores, para pruebas de regresión y, más adelante, para fantasmas o soluciones compartidas. Si cambian las reglas, los registros antiguos dejan de ser válidos: habrá que versionarlos cuando se guarden.

**Eventos.** World emite eventos breves (`spawn`, `dig`, `debris`, `saved`, `lost`, `victory`, `defeat`; los de fin de lemming llevan `id`). La app los consume en el mismo cuadro para sonido, anuncios y limpieza de selección. La cola está acotada a 512 entradas, así que una simulación sin consumidor (por ejemplo, en pruebas) no crece sin límite. Ningún evento decide el resultado.

**Contadores.** `released` cuenta los lemmings que salieron por la escotilla; `remaining = total − released`. Al agotarse el tiempo, los activos y los que no salieron se cuentan como perdidos y `remaining` queda en 0, de modo que el HUD final es coherente.

## Movimiento y terreno

El mundo lógico de la etapa 1 mide **800×360**. La plataforma superior tiene 56 px de grosor y paredes de 24 px en ambos extremos; la isla inferior, con la salida, también está amurallada. `Terrain` es un `Uint8Array` de 288 000 bytes y es la única fuente de colisión y del suelo dibujado. Los rectángulos de autoría no cuentan como cambios. Cada `clear`/`fill` que modifica celdas incrementa `revision` y guarda el rectángulo tocado (hasta 128). `changedSince(revision)` devuelve la unión de regiones posteriores sin mutar nada; si el observador está más atrasado que el historial, devuelve el terreno entero.

Reglas de un caminante (`RULES` en `world.js`):

- Los pies están sobre la primera fila sólida.
- Sube escalones de hasta `stepUp = 4` píxeles y baja hasta `stepDown = 3` sin pasar a estado de caída.
- Gira ante un obstáculo más alto que un escalón, comprobado `wallProbe = 3` píxeles por delante. Así nunca camina dentro del terreno.
- Cae cuando no hay suelo. La caída recorre las filas cruzadas para no atravesar suelos finos, y morir depende de la altura (`safeFall = 125`).
- Se pierde al salir del mundo. Se salva al caminar dentro del rectángulo de la salida.

**Habilidades.** `skills.js` define cada habilidad con `canAssign`, `begin` y `update`, además del estado que controla. World despacha por estado: un lemming en `digging` lo actualiza la habilidad `dig`; `walking` y `falling` son movimiento base.

**Cavar es trabajo en cuadrilla.** Un excavador borra una franja de 16×2 cada **0,48 s**: atravesar los 56 px de la plataforma superior de la etapa 1 lleva unos 13 s. Si se asigna Cavar a otro lemming dentro del mismo hoyo (a ≤ 8 px del eje y ≤ 12 px de altura de otro excavador), se alinea con ese eje. Cada excavador sigue cada tick el suelo compartido que la cuadrilla va bajando (hasta 12 px), así que el hoyo avanza en proporción: dos lo hacen el doble de rápido y cuatro, unas cuatro veces (≈ 3,4 s si trabajan juntos desde el principio). Sin suelo a menos de 12 px, el excavador cae. Mientras se cava, los que llegan caen al hoyo y quedan atrapados entre sus paredes hasta que se abre, listos para sumarse. La vista separa unos píxeles a los miembros de la cuadrilla para que se lean como grupo; en World comparten la misma x.

## Presentación

`Renderer.setLevel(level)` dimensiona el lienzo según el nivel y dibuja una sola vez el fondo estático (cielo, estrellas, luna, crestas). Cada cuadro compone tres capas: el fondo cacheado, el bitmap de terreno y los elementos vivos (decoración, escotilla, salida animada, lemmings y selección). El terreno se repinta solo en la región que informa `changedSince`, ampliada lo necesario porque el color de un píxel depende de una columna a cada lado y de cuatro filas superiores. La escritura usa un `ImageData` persistente con `putImageData` limitado a esa región, sin crear arrays por píxel. Antes se reconstruían 288 000 píxeles completos en cada golpe de pala.

El renderer lee posiciones de `level.spawn`, `level.exit` y `level.decor` (enredaderas, señal) y los actores de portada de `level.preview`. No queda geometría de la etapa 1 escrita en el código de dibujo.

`Surface` es la cámara. En el menú (vista general) ajusta el mundo **completo** al espacio disponible. Durante la partida mantiene una escala mínima de **1,25 px CSS por unidad** (`MIN_PLAY_SCALE`, lemmings de unos 17 px), limitada por la altura disponible. Si el mundo queda más ancho que la pantalla, el contenedor pasa a `.scrolling` y se desplaza en horizontal con desplazamiento nativo: swipe táctil con inercia del sistema, rueda (vertical convertida en horizontal) y `centerOn()` desde código. `overscroll-behavior-x: contain` evita el gesto de «atrás» del navegador. El cambio de escala conserva el centro de la vista. En escritorio ancho todo cabe y no hay desplazamiento.

- **Toque o arrastre:** con ratón, Cavar se asigna al presionar. Con el dedo se asigna al soltar, y solo si el dedo no se movió más de 10 px; si fue un swipe, el navegador cancela el puntero y no se cava.
- **Orientación:** al empezar se encuadra la escotilla. Las flechas centran al lemming elegido si está fuera de vista. Los indicadores de borde («◀ 4», «2 ▶») cuentan los lemmings vivos fuera de pantalla, y al pulsarlos se va al más cercano de ese lado. Una barra fina muestra qué parte del mundo se ve. Indicadores y barra solo se escriben cuando cambian.
- **Radio de selección:** se expresa en píxeles de pantalla y se convierte a unidades de mundo (`worldRadius`): 12 px con ratón y 28 px al tacto, con un mínimo de 14 y 22 unidades.

`toWorld` usa el rectángulo real del lienzo, así que el desplazamiento no requiere corrección extra.

## Aplicación

**Interfaz a pantalla completa (mismo lenguaje que Alvaroids).** La página es una sola superficie fija:
- arriba, el HUD: marca, etapa, contadores y botones redondos de sonido y pausa;
- en medio, el escenario, que ocupa todo el espacio restante;
- abajo, la barra de herramientas;
- los mensajes de ayuda flotan sobre el escenario.

Menú principal, pausa, confirmación de reinicio, ayuda y resultado son pantallas completas (`.screen`) que gestiona `Screens`. Se ve una o ninguna. Mientras una está abierta, HUD, escenario y barra quedan `inert`, el foco va a su acción principal y `Escape` retrocede un paso: pausa y reinicio vuelven al juego, ayuda vuelve al menú, resultado va al menú. El menú principal genera un botón por cada etapa de `LEVELS`, con número, nombre, objetivo, `brief` si existe y mejor rescate.

**Campaña lineal (como en 1991).** Una etapa está superada si su mejor rescate guardado alcanza su objetivo, y se abre si la anterior está superada. Las bloqueadas se ven con candado, están desactivadas y `start()` las rechaza. Se deduce del récord que ya se guarda, sin estado nuevo en el almacenamiento. El foco del menú va a la primera etapa abierta sin superar. Al ganar, el resultado ofrece la siguiente.

La ayuda es un panel lateral opaco (`.screen--side`), abajo en pantallas estrechas. Mientras está abierta, la clase `game--side` reduce el escenario al espacio libre y la cámara reajusta el mundo, así que la explicación y la etapa se ven a la vez.

**Toque en un hoyo concurrido:** gana el lemming más cercano. Si un caminante y un excavador están casi en el mismo punto (menos de 3 unidades), se prefiere al caminante, porque unirse a la cuadrilla es lo más probable; un toque equivocado se deshace tocando otra vez. Estilos: verde `#00ff88` sobre `#020711`, líneas de barrido, botones con esquinas cortadas y títulos grandes con brillo, como en Alvaroids. El HUD y la barra se ocultan en el menú y entran con una animación corta, que se desactiva con movimiento reducido.

Estados: `menu → playing ⇄ paused`, `playing → result → menu | playing`. Menú, pausa y resultado no actualizan World. Cada transición vacía el acumulador del reloj y el tiempo del bucle, así que la pausa nunca se acumula. Ocultar la pestaña pausa la partida y exige continuar a mano. Reiniciar pide confirmación y reemplaza World y su máscara.

El HUD escribe como máximo cada 100 ms y solo si un valor cambió. Los textos de menú, HUD, diálogos y anuncios se derivan del nivel (número, nombre, total, objetivo, minutos). El contenido dinámico de las pantallas se escribe como texto o con nodos DOM, nunca con `innerHTML`. Los anuncios van a una región `aria-live`.

**Sonido.** Las señales pasan por un volumen general (0,5) con picos de 0,4 y frecuencias sobre 200 Hz, audibles en parlantes de notebook y teléfono. Si el navegador suspendió el contexto, `play()` lo reanuda y emite la señal al volver.

**Música.** `music.js` contiene «Marcha de la colonia», una composición original:
- marcha juguetona y exploradora en Do mayor, a 126 BPM, con 16 compases (unos 30 s) en bucle;
- la frase A sube en arpegios cortados; la frase B pasa por La menor y vuelve.

Está escrita como datos legibles (8 corcheas por compás, nombres de nota, `-` para sostener y `.` para silencio) y `compile()` la convierte en eventos. Tiene tres voces: melodía de pulso al 25 % (`PeriodicWave`), bajo de marcha en triángulo que alterna fundamental y quinta, y batería (bombo sinusoidal, caja y charles de ruido, con redoble al cerrar cada frase).

Un planificador con anticipación de 150 ms (`setInterval` de 25 ms, en la capa de plataforma, nunca en la simulación) programa las notas en el reloj del `AudioContext`, así el ritmo no depende de los cuadros. Pausar silencia las voces y recuerda la posición; continuar retoma la frase. La música suena solo durante la partida y se detiene en el menú y en el resultado, donde suena la fanfarria. Si se activa el sonido a mitad de etapa, la música arranca aunque la etapa haya empezado en silencio. Una etapa puede declarar `music` con otra pista; si no, usa la marcha.

**Configuración** (como en Alvaroids): sonido sí/no y volumen de música de 0 a 100 %, desde el menú o la pausa.

Persistencia: una sola clave, `avx-lemmings-v1`, con `{ muted, music, best: { [levelId]: n } }`. El volumen de música se guarda al soltar el deslizador. Se escribe al cambiar el sonido o al mejorar un récord. Se migra el formato anterior (`best` numérico pasa a la etapa 1). JSON inválido, tipos inesperados o almacenamiento bloqueado vuelven a los valores por defecto.

## Cómo extender

- **Nueva etapa:** añadir un objeto a `LEVELS`. `levelErrors` valida dimensiones, inventario, rectángulos dentro del mundo, entrada fuera del terreno y salida apoyada en una superficie. Añadir pruebas de solución y de derrota. La selección de etapa en el menú se añadirá cuando exista la segunda.
- **Nueva habilidad:** añadir una entrada a `SKILLS` con su estado, su pose en `drawLemming`, un botón en la barra y sus pruebas. El bucle de World no cambia. Bloqueadores u otras interacciones entre lemmings necesitarán una consulta espacial en World, que hoy no existe porque no hace falta.
- **Materiales:** si un nivel necesita acero o suelo indestructible, ampliar la máscara a valores por material (0 = vacío) sin romper `solid`.
- **Niveles grandes:** medir antes. Las vías previstas son una cámara con desplazamiento en `Surface` y fragmentar el bitmap del terreno en baldosas.

## Origen

La primera iteración partió de revisar `asteroids-web-game-avx` como fuente de experiencia, no como dependencia. Se conservaron Canvas 2D con módulos ES, HTML para la interfaz, fuentes locales, audio sintetizado tras un gesto, pausa por visibilidad y ausencia de servicios externos. Se evitaron tres cosas observadas allí: un controlador que mezclaba reglas, dibujo, DOM y almacenamiento; escrituras a localStorage desde el bucle; e integración con `dt` variable. Asteroids no se modificó.

## Pendiente

- En móvil vertical sobra altura: la escala mínima podría subir (por ejemplo, 1,25) a costa de ver menos ancho. Decidirlo jugando en un teléfono real.
- Arrastrar con el ratón para desplazar, si alguien juega en una ventana de escritorio estrecha (hoy funcionan la rueda, el teclado y los indicadores).
- El terreno visual no equivale a una experiencia no visual completa: el teclado permite jugar, pero no describe el mapa.
- Compartir `engine/` con otros juegos solo cuando haya código estable realmente común. Por ahora los repositorios siguen siendo independientes.
