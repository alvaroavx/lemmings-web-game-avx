export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ label: 'Fácil', required: 7, seconds: 300, margin: 8, rules: 'Escalar y paracaídas son permanentes. Puedes recuperar usos al detener trabajos.' }),
  normal: Object.freeze({ label: 'Normal', required: 8, seconds: 360, margin: 6, rules: 'Una asignación por escalada o caída. Detener un trabajo no devuelve el uso.' }),
  hard: Object.freeze({ label: 'Difícil', required: 9, seconds: 540, margin: 3, rules: 'Un uso por obstáculo, sin devoluciones. Tres pisos y solo una pérdida permitida.' }),
});
