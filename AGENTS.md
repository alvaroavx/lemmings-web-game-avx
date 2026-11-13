# Lemmings AVX — guía de desarrollo

Este repositorio es autónomo. La aplicación canónica es `src/`; `server.py` solo sirve esa carpeta en loopback. No modificar Asteroids ni copiar sus cambios automáticamente.

- Leer `README.md` y `docs/architecture.md` antes de ampliar el juego.
- Capas: `engine/` y `game/` son puros (lo comprueba `tests/engine.test.mjs`); `view/` solo lee World; `platform/` adapta el navegador; `app/` coordina. Toda acción del jugador entra por un comando de World (`assign`, `setRate`) para que quede en el registro repetible.
- Mantener `World`, `Terrain`, los niveles y `Clock` independientes del navegador. No introducir DOM, audio, localStorage, setTimeout, requestAnimationFrame o aleatoriedad no sembrada en la simulación.
- La máscara de Terrain es la única fuente de colisión y del dibujo del suelo. El renderer nunca modifica World.
- La simulación avanza a 60 Hz; velocidad ×3 significa más pasos, no pasos mayores. No acumular tiempo de pausa.
- Toda habilidad debe consumir inventario solo si es válida. Un lemming salvado o perdido no vuelve a simularse.
- Mantener teclado, puntero, pausa por visibilidad, diálogos con foco y sonido opcional. Los textos para jugadores están en español.
- Persistir solo preferencias y mejor rescate en cambios de usuario o fin de partida; tolerar almacenamiento bloqueado. Sin solicitudes externas ni datos personales.
- Mantener arte y sonidos propios; conservar las licencias de las fuentes.
- Tras cambios de reglas, ejecutar `npm test`. Tras cambios de interacción, jugar desde el menú hasta el resultado en navegador; no confundir simulación automatizada con prueba visual.
- Verificar `node --check src/js/main.js`, `python3 -m py_compile server.py` y `git diff --check` antes de entregar.
- No instalar framework, bundler, ECS, backend o paquete sin necesidad concreta y documentada.
