/**
 * Player-facing copy and glyphs per skill (Spanish). Rules live in
 * game/skills.js; this table only explains them. Keys 1–8 follow the toolbar.
 */
export const SKILL_UI = Object.freeze({
  climb: { icon: '↟', select: 'Escalar: pulsa un lemming. Trepará cualquier muro y lo conservará siempre.',
    done: id => `Lemming ${id} es escalador.`, invalid: 'Ese lemming ya sabe escalar.' },
  float: { icon: '☂', select: 'Paracaídas: pulsa un lemming. Sobrevivirá a cualquier caída.',
    done: id => `Lemming ${id} lleva paracaídas.`, invalid: 'Ese lemming ya lleva paracaídas.' },
  bomb: { icon: '✸', select: 'Detonar: el lemming explota a los 4 segundos y abre un cráter en la tierra.',
    done: id => `Lemming ${id}: cuenta atrás de 4 segundos.`, invalid: 'La mecha de ese lemming ya está encendida.' },
  block: { icon: '⊥', select: 'Bloquear: el lemming se planta y los demás dan la vuelta al tocarlo.',
    done: id => `Lemming ${id} bloquea el paso.`, invalid: 'Solo bloquea un caminante sobre suelo firme, y no encima de otro bloqueador.' },
  build: { icon: '▞', select: 'Construir: 12 peldaños hacia delante y hacia arriba. Nadie adelanta al constructor.',
    done: id => `Lemming ${id} construye una escalera.`, invalid: 'Solo construye un caminante sobre suelo firme.' },
  bash: { icon: '⇥', select: 'Perforar: túnel horizontal a través de la tierra que tiene delante.',
    done: id => `Lemming ${id} perfora.`, invalid: 'Perforar necesita tierra justo delante. El acero no se perfora.' },
  mine: { icon: '⤵', select: 'Minar: túnel en diagonal hacia abajo.',
    done: id => `Lemming ${id} mina en diagonal.`, invalid: 'Minar necesita tierra bajo sus pies. El acero no se mina.' },
  dig: { icon: '⛏', select: 'Cavar: túnel vertical. Suma excavadores al mismo hoyo para ir más rápido.',
    done: id => `Lemming ${id} cava.`, invalid: 'Cavar necesita un caminante sobre tierra. El acero no se cava.' },
});
