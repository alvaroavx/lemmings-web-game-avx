/** Worker lifetime belongs to the menu: cancelling cannot start a stale match. */
export class StageGenerator {
  constructor({ createWorker = () => new Worker(new URL('./generation-worker.js', import.meta.url), { type: 'module' }),
    seed = () => crypto.getRandomValues(new Uint32Array(1))[0], timeout = 15000 } = {}) {
    this.createWorker = createWorker; this.seed = seed; this.timeout = timeout; this.pending = null; this.lastSeed = null;
  }
  generate(difficulty = 'easy') {
    this.cancel();
    let seed = this.seed();
    if (seed === this.lastSeed) seed = (seed + 1) >>> 0;
    this.lastSeed = seed;
    return new Promise((resolve, reject) => {
      const worker = this.createWorker();
      const done = (error, level) => {
        if (this.pending?.worker !== worker) return;
        clearTimeout(this.pending.timer); this.pending = null; worker.terminate();
        if (error) reject(error); else resolve(level);
      };
      this.pending = { worker, done, timer: setTimeout(() => done(new Error('La ruta tardó demasiado. Prueba otra expedición.')), this.timeout) };
      worker.onmessage = ({ data }) => done(data.error ? new Error(data.error) : null, data.level);
      worker.onerror = () => done(new Error('No se pudo preparar la expedición. Vuelve a intentarlo.'));
      worker.onmessageerror = worker.onerror;
      try { worker.postMessage({ seed, difficulty }); } catch (error) { done(error); }
    });
  }
  cancel() {
    this.pending?.done(new DOMException('Generación cancelada', 'AbortError'));
  }
}
