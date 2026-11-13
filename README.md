# Lemmings AVX

Un laboratorio jugable de rescate dentro del universo **Vector Field**. Incluye menú principal y una primera etapa, **Solo cava**, inspirada en la idea de «Just dig!» de Lemmings (1991). Los personajes, el escenario, el código y los sonidos se construyeron para este proyecto; no se ejecuta ni se distribuye el binario original.

## Jugar

```bash
python3 server.py
```

Abrir **http://127.0.0.1:8081** (otro puerto: `python3 server.py --port 8082`). Python 3 sirve `src/`; no hay instalaciones npm ni dependencias de ejecución. También se puede publicar el contenido de `src/` en cualquier alojamiento estático, incluso bajo un subdirectorio. Abrir `index.html` mediante `file://` no es compatible con los módulos ES.

1. En el menú principal, a pantalla completa, elegir la etapa **01 · Solo cava**. Cada etapa muestra su objetivo y tu mejor rescate.
2. Esperar a que el primer lemming caiga sobre la plataforma superior.
3. **Cavar** ya está seleccionado: pulsar sobre ese lemming para abrir un túnel vertical. Cavar es lento: los que llegan caen al hoyo y, si también se les asigna Cavar, se suman a la cuadrilla y el hoyo baja más rápido (cuatro excavadores ≈ cuatro veces uno).
4. Cuando el túnel atraviesa la plataforma, la colonia cae sobre la isla inferior y camina hacia la salida. La plataforma superior tiene paredes en ambos extremos: sin túnel nadie se cae, pero caminan de pared a pared hasta que se acaba el tiempo.

Salen diez lemmings. Hay diez asignaciones de excavador y cinco minutos. Basta con rescatar **uno de diez**, como objetivo de iniciación; el desafío completo es salvar a los diez. La evaluación ocurre al resolver la colonia completa o agotar el tiempo, no al rescatar el primero.

### Controles

| Acción | Control |
| --- | --- |
| Asignar excavador | Clic o toque sobre un caminante (en un hoyo, se suma a la cuadrilla) |
| Detener a un excavador | Clic o toque sobre él (o `Enter` si está seleccionado): sigue caminando y el uso vuelve al inventario |
| Mover la vista (pantallas estrechas) | Deslizar el dedo, rueda del ratón o indicadores ◀ ▶ de los bordes |
| Enfocar terreno y seleccionar Cavar | `D` o botón Cavar |
| Elegir lemming con terreno enfocado | `←` / `→` |
| Asignar al seleccionado | `Enter` |
| Pausar | `P`, `Escape` o botón `Ⅱ` |
| Volver de pausa | Continuar o `Escape` (en cualquier pantalla, `Escape` retrocede un paso) |
| Acelerar | Botón `×1` / `×3` |
| Ajustar ritmo de salida | Botones o teclas `−` / `+`, entre 50 y 99 |
| Reiniciar | Botón Reiniciar (o desde la pausa) y confirmación |
| Menú principal | Desde la pausa o el resultado |
| Sonido y volumen de música | Botón 🔊 del HUD, o CONFIGURACIÓN en el menú o la pausa |

En pantallas anchas el mundo completo cabe a la vista. En pantallas estrechas el menú muestra el mapa completo, y durante la partida se mantiene un tamaño jugable (1:1) con desplazamiento horizontal: un swipe mueve la vista sin cavar, los indicadores de borde avisan de lemmings fuera de pantalla y las flechas centran al elegido. Ocultar la pestaña pausa automáticamente. El récord por etapa y el silencio se guardan localmente; si el navegador bloquea el almacenamiento, el juego sigue funcionando.

## Estructura

`engine/` (reloj, terreno) y `game/` (niveles, habilidades, mundo, repetición) son puros y deterministas. `view/` dibuja, `platform/` adapta el navegador y `app/` coordina la interfaz. Detalle en [arquitectura](docs/architecture.md).

## Verificación

```bash
npm test
node --check src/js/main.js
python3 -m py_compile server.py
```

Las pruebas usan `node:test` sin dependencias: reglas, repetición exacta desde el registro de comandos, regiones de terreno, validación de niveles, almacenamiento y una guarda que impide APIs del navegador en `engine/` y `game/`. Ver [arquitectura](docs/architecture.md), [decisiones](docs/decisions.md) y [validación](docs/validation.md). No se modificó el proyecto Asteroids ni se requiere su servidor.

## Alcance

Una sola etapa y una habilidad implementada, sobre un motor preparado para más: etapas como datos validados, habilidades en una tabla, comandos registrados y repetibles, terreno con repintado por regiones. El menú principal lista todas las etapas de `LEVELS` en orden lineal, como en 1991: cada etapa se abre al superar la anterior. Al superar una, el resultado ofrece la siguiente. Sin cuentas, telemetría ni backend de partidas. El diseño del mapa es una adaptación propia, no una reproducción exacta del archivo de nivel original. La siguiente etapa debe añadirse como datos y reglas comprobables antes de introducir un editor o un motor general.

La música, «Marcha de la colonia», es una composición original de este proyecto, sintetizada en el navegador (`src/js/platform/music.js`): no hay archivos de audio. Las fuentes Noto Sans Mono se reutilizan desde Vector Field con su [licencia OFL](src/assets/fonts/LICENSE-OFL-1.1.txt). Lemmings es el referente del laboratorio; este proyecto no afirma afiliación oficial.
