# Validación local

## 2026-11-13 — iteración 7 (música original)

Se verificó en Chrome sin interfaz instrumentando Web Audio (se contaron las fuentes de ruido, es decir caja y charles, y las notas de pulso de la melodía):
- **Al jugar:** en 3 s hubo 9 golpes de caja y charles y 9 notas de melodía. Los 40 primeros golpes caen exactamente en la rejilla de semicorcheas a 126 BPM (paso de 0,2381 s): ninguno fuera.
- **Pausa y continuar:** con P, 0 golpes en 1,5 s. Con Escape, la música retoma la frase.
- **Configuración:** se abre desde la pausa con el foco en Volver y «60 %». Con el volumen en 0 no hay música al continuar, y se guardó `"music":0`. Escape devuelve a la pausa con el foco en Configuración.
- **Empezar silenciado y activar desde el HUD:** 0 golpes mientras estaba silenciado y 6 en los 2 s siguientes a activarlo.
- **Sin errores de consola.**
- **`npm test`:** 33 casos. Los nuevos comprueban que la marcha compila a 128 corcheas (unos 30,5 s), que `-` sostiene, que los registros quedan en rango (melodía de G4 a C6, bajo en la octava 3), que un compás mal escrito se rechaza indicando su número, y que el volumen de música se guarda y se valida.
- **No verificado de oído:** la mezcla y el volumen relativo entre música y efectos necesitan una escucha real.

## 2026-11-13 — iteración 6 (campaña lineal, detener, ayuda lateral, sonido)

- **Campaña lineal:** se probó con una copia temporal de 10 etapas (clones de la etapa 1) y récords simulados para las etapas 1–3.
  - Se ven 1–3 superadas, la 4 abierta con el foco, y de la 5 a la 10 con candado y «SUPERA LA ETAPA 0N».
  - Un clic en una bloqueada no inicia nada.
  - Con 10 etapas, el menú se desplaza desde arriba sin cortar el título.
- **Ayuda lateral:**
  - A 1280×800, panel de 440 px y escenario reajustado a 840×378 a su lado.
  - A 390×844, panel abajo (390×523) y escenario arriba; el botón Volver es visible.
- **Detener:** con ratón, cavar (10 → 9) y luego clic sobre el excavador: «Lemming 1 deja de cavar…», inventario 10. En el teléfono, sumar a la cuadrilla sigue funcionando y la partida termina en 10/10.
- **Sonido:** se reprodujo el caso (cargar silenciado, jugar, activar sonido desde el HUD) instrumentando Web Audio. El contexto queda `running` y los osciladores se inician al activar. No se reprodujo un fallo de lógica; las señales eran casi inaudibles (pico 0,055, 120–180 Hz). Ahora son más fuertes y agudas, y el contexto se reanuda solo. **No verificado de oído.**
- **Automatización:** `npm test` (30 casos, incluidos detener con devolución y repetición con `cancel`), `node --check` y `git diff --check`, sin errores.

## 2026-11-13 — iteración 5 (menú principal a pantalla completa)

- **Escritorio (1280×800, Chrome sin interfaz):**
  - El menú muestra «LEMMINGS AVX», la lista de etapas («01 · SOLO CAVA · 10 LEMMINGS · RESCATA 1 · 5 MIN · SIN JUGAR») y el foco en la etapa.
  - Al elegirla, el escenario ocupa 1280×576 entre el HUD y la barra.
  - Flecha y Enter cavan; P abre la pausa con el foco en Continuar y el reloj detenido.
  - El resultado fue «TODOS EN CASA» 10/10. Al volver, el menú muestra «MEJOR RESCATE 10 / 10».
- **Teléfono (390×844, táctil emulado):** la misma partida con toque, cuadrilla, swipe (vista de 148 a 353 sin cavar), «◀ 4» y vuelta con el indicador; terminó en 10/10.
- **Pantallas:**
  - ayuda y Escape vuelven al menú con el foco en «Cómo jugar»;
  - Reiniciar abre la confirmación y Escape vuelve al juego;
  - desde la pausa se puede reiniciar con confirmación (el reloj vuelve a 05:00) o ir al menú principal;
  - el sonido cambia desde el menú y desde el HUD.
- **Bloqueo y consola:** mientras hay una pantalla abierta, el escenario queda `inert`. Sin errores de consola.
- **Automatización:** `npm test` (28), `node --check` de todos los módulos y `git diff --check`, sin errores.
- **No verificado:** un teléfono físico; cómo se ve el menú con varias etapas (hoy solo existe la etapa 1 en `main`).

## 2026-11-13 — iteración 4 (etapa 1 amurallada)

- **Simulación sin cavar:** a los 40 s los 10 beisics siguen vivos y caminan entre x 234 y 701 sobre la plataforma superior; nadie cae. Sin túnel, la etapa termina en derrota por tiempo, con los 10 perdidos.
- **Tiempo hasta atravesar la plataforma de 56 px**, con seguidores sumados a medida que caen al hoyo: 1 excavador, 13,0 s; 2, 7,2 s; 4, 5,8 s. Todas las variantes rescatan 10/10.
- **Navegador de escritorio (Chrome sin interfaz):** las paredes y la plataforma gruesa se ven en la captura. La partida con teclado terminó en «Todos en casa.» 10/10, sin mensajes de consola.
- **`npm test`:** 28 casos. Se reescribieron las dos pruebas que daban por hecho caídas por los extremos.

## 2026-11-13 — iteración 3 (cámara móvil y cuadrillas)

**Teléfono (390×844, táctil emulado en Chrome sin interfaz, toques y deslizamientos reales por DevTools Protocol):**
- El menú muestra el mapa completo (lienzo de 376 px, sin barra de posición).
- Al jugar, el lienzo pasa a 800 px con desplazamiento y queda encuadrada la escotilla. La pista dice «Desliza para mover la vista».
- Un toque sobre el primer caminante (localizado por los píxeles del lienzo) asignó Cavar: inventario de 10 a 9.
- Un segundo toque sobre un lemming caído en el hoyo lo sumó a la cuadrilla («¡Cuadrilla de 2! El hoyo baja 2 veces más rápido», inventario 8).
- Un deslizamiento de 220 px iniciado sobre un lemming movió la vista de 86 a 291 sin cavar (inventario sigue en 8) y mostró «◀ 4». Pulsar ese indicador volvió a encuadrar a la colonia.
- La partida terminó en «Todos en casa.» 10/10. Al volver al menú, la vista completa se restableció.
- El gesto sintético de alto nivel de Chrome (`synthesizeScrollGesture`) no desplaza en modo sin interfaz; los eventos táctiles de bajo nivel sí. Es una limitación de la herramienta, no del juego.

**Escritorio (1280×800):** la misma partida con teclado que en la iteración 2 (flecha, Enter, P, Escape, ×3) terminó en 10/10, sin mensajes de consola. En pantalla ancha no hay desplazamiento.

**Ritmo de excavación medido en simulación:**
- Un excavador atraviesa los 34 px en 7,7 s.
- Una cuadrilla de 2 tarda 3,85 s y una de 4, 1,93 s; antes, uno solo tardaba 2,04 s.
- En la etapa real, con seguidores sumados a medida que caen al hoyo: 1 → 7,7 s, 2 → 4,4 s, 3 → 3,9 s. Todas las variantes rescatan 10/10.

**Automatización:** `npm test` pasa **28 casos**. El nuevo comprueba que un excavador solo tarda entre 7 y 8,5 s, que la cuadrilla se alinea en un hoyo y que cuatro cavan unas cuatro veces más rápido (±0,25).

**No verificado:** un teléfono físico (iOS y Android), el gesto de «atrás» del sistema, el arrastre con ratón en ventanas estrechas (no implementado) y la sensación de juego a mano.

## 2026-11-13 — iteración 2 (motor)

### Navegador

Se jugó la página servida en `http://127.0.0.1:8082/` en Google Chrome sin interfaz, con entradas reales de teclado y ratón enviadas por DevTools Protocol, en dos tamaños: **1280×800** y **390×844**. En ambos:

1. El menú mostró los textos derivados del nivel: «Solo cava.», «10 lemmings · Rescata al menos 1 · 5 minutos», «MEJOR RESCATE: —».
2. Un clic en **Jugar etapa 1** ocultó el menú y dejó el foco en el lienzo.
3. La flecha derecha seleccionó al lemming 1 («Lemming 1, caminando») y Enter asignó Cavar: anuncio «Lemming 1: cavar.», inventario de 10 a 9.
4. En la captura se ve el túnel abierto en la plataforma superior: el repintado por regiones funciona.
5. P abrió la pausa. Dos lecturas del reloj separadas 1,5 s dieron el mismo **04:56**. Escape continuó la partida.
6. Con el botón de velocidad en **×3**, la etapa terminó en **«Todos en casa.» 10/10, 100 %**, con «POR SALIR» en 0.
7. Al volver al menú se vio «MEJOR RESCATE: 10 / 10» y el almacenamiento guardó `{"muted":false,"best":{"just-dig":10}}`.
8. No hubo mensajes de consola, excepciones ni errores de registro.

Esta es una comprobación automatizada de un navegador real con la aplicación servida. No sustituye jugar a mano. No se verificaron en esta iteración la asignación por clic sobre un lemming, el diálogo de reinicio ni la pausa por cambio de pestaña. Su código cambió poco, pero conviene probarlos jugando.

### Automatización

`npm test`: **27 casos** en tres archivos.

- **Motor:** recorte de `clear`; regiones cambiadas y revisión solo ante cambios reales; repintado completo cuando el observador se queda atrás del historial; guarda de pureza de `engine/` y `game/`.
- **Niveles:** todas las etapas validan y los niveles inválidos se rechazan con un motivo.
- **Reglas:**
  - rescate de los diez con un excavador;
  - derrota sin cavar;
  - sin consumo de habilidad en caída, muerte, ID inexistente, habilidad desconocida o inventario vacío;
  - sin doble asignación;
  - reinicio limpio sin mutar los datos del nivel;
  - límites del ritmo de salida;
  - derrota por tiempo con la escotilla vaciada;
  - mundo terminado inmutable ante actualizaciones y comandos.
- **Movimiento:** subida y bajada de escalones pequeños; giro ante paredes sin entrar al terreno; un excavador pasa a caer al terminar el suelo.
- **Determinismo:** el mismo resultado a 30, 60 y 120 Hz; la repetición desde el registro de comandos produce un mundo idéntico; reloj acotado y con entradas no finitas ignoradas; cola de eventos acotada.
- **Almacenamiento:** almacenamiento bloqueado; datos malformados; migración del récord antiguo; el récord solo sube; una única clave.

También pasaron `node --check` sobre todos los módulos, `python3 -m py_compile server.py` y `git diff --check`.

## 2026-11-13 — iteración 1

Se jugó desde el menú en el navegador integrado contra `http://127.0.0.1:8081/`:

- Selección con flecha y Enter, y una partida completa a ×3 que terminó en 10/10.
- Asignación por clic, con el inventario de 10 a 9.
- Pausa con P y continuación con Escape.
- Reinicio con confirmación.
- Distribución a 390×844.
- Récord 10/10 en el menú.
- Sin errores de consola.

## Límites

- No se probó en Safari, Firefox ni en un dispositivo físico.
- No se escuchó la mezcla de audio.
- No hay prueba de despliegue público.
- No se afirma fidelidad al nivel clásico ni accesibilidad no visual completa del terreno.
