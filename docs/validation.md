# Validación local

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
