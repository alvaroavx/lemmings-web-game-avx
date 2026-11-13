# Decisiones del laboratorio

| ID | Decisión | Fecha | Estado |
| --- | --- | --- | --- |
| D-01 | Entregar menú y etapa 1 en el universo Vector Field | 2026-11-13 | Vigente |
| D-02 | Adoptar módulos sin dependencias y simulación separada | 2026-11-13 | Vigente por delegación |
| D-03 | Evolucionar la base hacia un motor pequeño y comprobable | 2026-11-13 | Vigente |

## D-01: Entregar menú y etapa 1 en el universo Vector Field

**Fecha:** 2026-11-13. **Decidió:** Álvaro, solicitud directa. **Estado:** vigente.

**Contexto:** El criterio de éxito es poder jugar la etapa 1 de Lemmings AVX; se quiere aprender de la construcción de Asteroids y partir con un lenguaje visual cercano a 1991.

**Alternativas descartadas:** una recreación completa de todos los niveles y habilidades excede el alcance; un documento arquitectónico sin partida no cumple el criterio de éxito.

**Decisión:** implementar una adaptación propia de Solo cava, con menú, reglas, controles y resultado verificable.

**Consecuencias asumidas:** una etapa y una habilidad; la topología y el arte son propios, no una copia exacta del nivel binario. Las referencias locales inspeccionadas muestran principalmente la selección de máquina DOS; no permiten afirmar fidelidad geométrica.

**Condiciones de revisión:** solicitar nuevas etapas, materiales o mayor fidelidad al mapa clásico.

## D-02: Adoptar módulos sin dependencias y simulación separada

**Fecha:** 2026-11-13. **Decidió:** Álvaro delegó el criterio técnico con «decide, mejora, piensa, evoluciona»; selección e implementación realizadas bajo esa delegación. **Estado:** vigente por delegación.

**Contexto:** Canvas y módulos ES ya funcionan en Vector Field. Un controlador único acumula responsabilidades y dificulta probar física sin navegador.

**Alternativas descartadas:** copiar el controlador completo perpetúa acoplamientos; introducir un framework/motor general añade distribución y aprendizaje sin una necesidad de esta etapa.

**Decisión:** separar World, Terrain, Renderer, Clock y adaptadores de audio/almacenamiento; usar pasos fijos y terreno compartido para dibujo/colisión.

**Consecuencias asumidas:** colisiones y arte se implementan localmente; se mantienen módulos pequeños con tests en Node. El servidor solo sirve archivos, sin SQLite.

**Condiciones de revisión:** niveles o perfiles medidos que excedan Canvas 2D/máscara actual; dos juegos con una abstracción compartida estable; necesidad explícita de datos de servidor.

## D-03: Evolucionar la base hacia un motor pequeño y comprobable

**Fecha:** 2026-11-13. **Decidió:** Álvaro pidió revisar, mejorar y orientar la implementación a motor de juegos web, más eficiente y robusta; la selección técnica se hizo bajo esa solicitud. **Estado:** vigente.

**Contexto:** La primera iteración funcionaba, pero tenía límites concretos:
- el terreno se repintaba entero (288 000 píxeles, con arrays temporales por píxel) en cada golpe de pala;
- el fondo se redibujaba en cada cuadro;
- la geometría de la etapa 1 estaba escrita en el renderer y el HTML;
- los caminantes podían entrar en desniveles de 1–2 píxeles;
- tras agotar el tiempo, el HUD mostraba lemmings «por salir»;
- `main.js` concentraba estados, entradas y DOM;
- la documentación describía un desplazamiento horizontal que el código ya no tenía.

**Alternativas descartadas:** adoptar un motor o un framework externo (dependencias y aprendizaje sin necesidad medida); un ECS o un bus de eventos global (diez agentes no lo justifican); dejar la arquitectura igual y solo corregir errores (no prepara la segunda etapa ni la segunda habilidad).

**Decisión:**
- separar `engine/` (Clock, Terrain con historial de regiones), `game/` (niveles validados, tabla de habilidades, World con comandos registrados, replay), `view/`, `platform/` (bucle, superficie, audio, almacenamiento) y `app/` (estados, HUD, diálogo);
- extraer la tabla de habilidades antes de tener la segunda implementación, como contrato explícito, contradiciendo de forma consciente la recomendación anterior de esperar;
- hacer cumplir la pureza de `engine/` y `game/` con una prueba;
- guardar el mejor rescate por etapa, migrando el formato anterior;
- mantener el ajuste del mundo completo al viewport y corregir la documentación.

**Consecuencias asumidas:**
- Más archivos, aunque cada uno tiene un propósito único.
- Los registros de repetición dependen de las reglas: habrá que versionarlos si llegan a persistirse.
- Cambia el movimiento de los caminantes (escalones de hasta 4 píxeles). La etapa 1 sigue resolviéndose igual, comprobado con pruebas y con una partida en el navegador.

**Condiciones de revisión:** una segunda habilidad que no encaje en `canAssign/begin/update`; niveles más grandes que exijan cámara o terreno en baldosas; la decisión pendiente sobre escala mínima en móvil vertical.
