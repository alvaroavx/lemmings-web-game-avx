# Decisiones del laboratorio

| ID | Decisión | Fecha | Estado |
| --- | --- | --- | --- |
| D-01 | Entregar menú y etapa 1 en el universo Vector Field | 2026-11-13 | Vigente |
| D-02 | Adoptar módulos sin dependencias y simulación separada | 2026-11-13 | Vigente por delegación |
| D-03 | Evolucionar la base hacia un motor pequeño y comprobable | 2026-11-13 | Vigente |
| D-04 | Cámara desplazable en móvil y excavación en cuadrilla | 2026-11-13 | Vigente |
| D-05 | Etapa 1 amurallada y con plataforma más gruesa | 2026-11-13 | Vigente |
| D-06 | Menú principal y juego a pantalla completa, como Alvaroids | 2026-11-13 | Vigente |
| D-07 | Campaña lineal, detener excavadores con devolución y música propia | 2026-11-13 | Vigente |
| D-08 | Etapas como rutas con cerraduras, llaves y prueba ejecutable | 2026-11-13 | Vigente |
| D-09 | Reglas propias que se apartan del clásico | 2026-11-13 | Vigente |

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

**Condiciones de revisión:** una segunda habilidad que no encaje en `canAssign/begin/update`; niveles más grandes que exijan cámara o terreno en baldosas.

## D-04: Cámara desplazable en móvil y excavación en cuadrilla

**Fecha:** 2026-11-13. **Decidió:** Álvaro. Pidió la versión móvil con escala mínima y desplazamiento por swipe; también pidió que cavar se sintiera como trabajo, más lento, con cuatro lemmings igualando la velocidad anterior de uno. **Estado:** vigente.

**Contexto:** A 390 px el mapa completo quedaba a ≈0,46× y los lemmings eran casi invisibles. Un excavador atravesaba la plataforma en ~2 s, antes de que diera tiempo a asignar un segundo.

**Alternativas descartadas:**
- Una cámara propia con transformaciones y arrastre programado: el desplazamiento nativo ya da inercia, accesibilidad y rendimiento.
- Botones de desplazamiento como único control.
- Engrosar la plataforma en vez de ralentizar: cambia alturas de caída y el diseño del mapa sin crear la mecánica de equipo. Queda disponible como ajuste del nivel.

**Decisión:**
- Escala mínima de 1:1 durante la partida, con desplazamiento horizontal nativo; el menú conserva la vista completa.
- Con el dedo, Cavar se asigna al soltar sin arrastre.
- Indicadores de borde y barra de posición.
- Excavación de 2 px cada 0,48 s, con cuadrillas alineadas en el mismo hoyo que avanzan en proporción al número de excavadores.

**Consecuencias asumidas:**
- Con el dedo, la asignación ocurre al soltar (unos milisegundos después).
- En pantallas estrechas no se ve todo el mapa a la vez.
- La etapa 1 dura más si se cava con un solo lemming (~8 s de excavación), aunque sigue resolviéndose con uno.
- Cambiaron las reglas: los registros de repetición anteriores ya no son válidos.

**Condiciones de revisión:** probar en un teléfono real (comodidad del toque, escala, gesto de swipe). Revisar también si el ritmo de cuadrilla resulta demasiado lento o demasiado fácil en etapas futuras.

## D-05: Etapa 1 amurallada y con plataforma más gruesa

**Fecha:** 2026-11-13. **Decidió:** Álvaro, solicitud directa. **Estado:** vigente.

**Contexto:** Se pidió que los beisics (así llama Álvaro a los lemmings) no se cayeran por los extremos de la plataforma superior y que cavar tardara más.

**Decisión:** paredes de 12×24 px en ambos extremos de la plataforma superior, y plataforma de 56 px de grosor en vez de 34.

**Consecuencias asumidas:**
- La etapa ya no castiga no cavar con caídas: sin túnel, se pierde por tiempo.
- Un excavador solo tarda unos 13 s; una cuadrilla de 4 desde el inicio, unos 3,4 s.
- La caída desde el fondo del túnel hasta la isla baja de 80 a 58 px; la caída desde la superficie por el túnel ya abierto sigue en 114 px, por debajo del límite de 125.

**Condiciones de revisión:** si la etapa resulta demasiado indulgente, devolver riesgo con tiempo más corto, menos excavadores o un peligro en otra parte del mapa.

## D-06: Menú principal y juego a pantalla completa, como Alvaroids

**Fecha:** 2026-11-13. **Decidió:** Álvaro, solicitud directa: copiar el menú principal de Alvaroids (Asteroids AVX) y que la etapa use toda la pantalla, conservando los botones. **Estado:** vigente.

**Contexto:** La interfaz tenía cabecera, una franja de presentación y diálogos modales pequeños. El escenario ocupaba solo una parte de la pantalla.

**Decisión:**
- Adoptar el lenguaje visual de Alvaroids (sus colores, líneas de barrido, botones de esquinas cortadas, títulos grandes y botones redondos), adaptándolo, no enlazándolo: Alvaroids no se modifica ni se importa.
- Menú principal a pantalla completa, con una lista de etapas generada desde los datos.
- Pausa, reinicio, ayuda y resultado como pantallas completas.
- Durante la partida, HUD arriba, escenario a todo el espacio y herramientas abajo.
- Escala mínima en pantallas estrechas: de 1 a 1,25.

**Coordinación:** otra sesión desarrolla las etapas 2–10 en la rama `feat/etapas`. Se acordó que la interfaz (`index.html`, `game.css`, `app/*`, `surface.js`, `main.js`) es de esta línea de trabajo, y que World, habilidades, niveles y renderer son de la otra. La interfaz ya admite `brief`, `hatches[0]`, mundos más anchos que 800 (con `surface.fit()` al cambiar de etapa) y la etapa siguiente. La barra de habilidades generada desde `level.skills` se cableará al fusionar.

**Consecuencias asumidas:** desaparecen `dialog.js` y los ids `#intro`, `#modal*` y `#keyboard-note`. Los atajos de teclado se muestran en el menú y en la ayuda, no durante la partida.

## D-07: Campaña lineal, detener excavadores con devolución y música propia

**Fecha:** 2026-11-13. **Decidió:** Álvaro. **Estado:** vigente.

**Decisiones:**
- **Progresión lineal**, el modo de juego de la versión de 1991: no se puede saltar a la etapa 6 sin superar de la 1 a la 5. Se deduce del mejor rescate guardado.
- **Detener a un excavador** devuelve el uso al inventario: es un comando de World (`cancel`) que queda en el registro de repetición.
- **Ayuda en panel lateral**, porque sobre el escenario el texto no se leía.
- **Señales de sonido más audibles**, y el contexto se reanuda si el navegador lo suspende.

**Música:** se pidió una réplica de la música de la etapa 1 de Lemmings (1991). No se replica, porque es una obra con derechos de terceros y el proyecto mantiene sonidos propios (AGENTS.md). Álvaro eligió la alternativa: música original con ánimo juguetón, explorador y de marcha. Se compuso «Marcha de la colonia» (ver arquitectura) y se agregó una pantalla de CONFIGURACIÓN con el volumen de música.

**Coordinación:** `world.cancel` toca `world.js`, que está en el área de la rama `feat/etapas`. Se avisó a esa sesión con el cambio exacto para que lo concilie.

## D-08: Etapas como rutas con cerraduras, llaves y prueba ejecutable

**Fecha:** 2026-11-13. **Decidió:** Álvaro pidió una arquitectura para crear las etapas 2–10, cada una con algo nuevo, que no fuera una cadena de condicionales y que preparase un futuro generador aleatorio. El diseño concreto se delegó. **Estado:** vigente.

**Alternativas descartadas:**
- Etapas como rectángulos absolutos, cada una con pruebas escritas a mano: no escala a un generador y no garantiza que la habilidad enseñada sea necesaria.
- Editor visual primero: añade interfaz sin resolver la verificación.
- Generador procedural con ruido o baldosas: produce terrenos, no puzles. Habría que verificarlos igual.

**Decisión:** ver [stages.md](stages.md). Una tortuga recorre la ruta y pone piezas. Cada pieza declara la cerradura que crea y las llaves que la abren, y cada llave emite los disparadores de su solución. Un jugador determinista ejecuta esa prueba con los comandos normales, y las pruebas exigen victoria, repetición idéntica y necesidad de cada habilidad. World pasa a despachar habilidades por estado y por hooks de rasgos, sin nombrarlas. Terrain gana materiales. Los niveles admiten varias entradas, salidas y zonas de agua.

**Consecuencias asumidas:**
- Cambian las reglas: los registros de repetición anteriores ya no son válidos.
- La prueba demuestra que *existe* una solución con esas llaves y que ninguna sobra entre ellas. No demuestra que no haya otras soluciones.
- `required` se elige a mano, con margen sobre el jugador perfecto.

**Condiciones de revisión:** al empezar el generador (semillas, presupuesto, métricas de dificultad), o si una etapa necesita algo que el vocabulario no expresa y `shape` no basta.

## D-09: Reglas propias que se apartan del clásico

**Fecha:** 2026-11-13. **Decidido por delegación** al construir las etapas. **Estado:** vigente.

- **Nadie adelanta a un constructor.** En el clásico, los caminantes pasan al constructor y caen del puente inacabado o quedan atrapados bajo la escalera. Al probar la etapa 7 apareció esa trampa sin salida. Ahora quien construye hace girar a los caminantes, igual que un bloqueador.
- **Detener es por habilidad.** Se pueden detener cavar, perforar, minar y construir (D-07). Bloquear no, porque convertiría en trivial la etapa 6.
- **Las asignaciones inútiles se rechazan.** Perforar exige tierra delante. Minar y Cavar exigen tierra bajo los pies, y en ningún caso sirve el acero. El inventario solo baja si la habilidad puede actuar (regla del laboratorio).
- **La escalera tiene una sola entrada.** Los ladrillos recuerdan hacia dónde sube su escalera. Quien camina en ese sentido los usa como peldaños; quien va en sentido contrario los atraviesa. Así, un lemming que cae bajo una escalera corta (entre ella y el escalón) ya no queda encerrado. Para el resto de las habilidades, los ladrillos son tierra: se cavan, se perforan y sirven de suelo al caer.
- **Una etapa perdida termina con una cuenta de 5 s.** Se declara «sin salida» cuando: (a) aunque llegaran todos los que siguen vivos o en la compuerta, no se alcanzaría el objetivo; o (b) el jugador ya no puede influir (compuerta vacía, sin usos de habilidad y sin trabajos que detener). En el caso (b), World simula una vez el resto de la partida, ya determinado, sobre una copia y comprueba que termina por debajo del objetivo. Mientras quede alguna habilidad, la etapa no se da por perdida: el jugador todavía puede encontrar una salida.
- **Solo quedan bloqueadores, la etapa termina.** Sin compuerta ni caminantes, los bloqueadores no pueden cambiar nada: se cuentan como perdidos al instante, sin esperar al reloj ni pedir una detonación general.
- **Constructor:** 12 ladrillos de 8×2, que avanzan 4 px y suben 2 cada 0,45 s (48 px de alcance, 24 de altura). **Bomba:** mecha de 4 s y cráter de radio 14, que solo quita tierra.

**Condiciones de revisión:** si las etapas se vuelven demasiado fáciles porque el constructor protege a la colonia, devolverle la regla clásica y exigir bloqueadores (la receta `block+build+bomb` ya se escribió una vez y se puede recuperar).
