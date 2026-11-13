import { Clock } from '../engine/clock.js';
import { World } from '../game/world.js';
import { SKILLS } from '../game/skills.js';
import { $, setText, el } from './dom.js';
import { Hud } from './hud.js';
import { Dialog } from './dialog.js';
import { bestFor, recordBest, saveSettings } from '../platform/storage.js';

const TAP_SLOP = 10; // CSS px a finger may drift and still count as a tap
const STATE_LABEL = { walking: 'caminando', falling: 'cayendo', digging: 'cavando' };

/**
 * Application coordinator: owns the state machine
 *   menu → playing ⇄ paused, playing → result → menu | playing
 * and translates input into World commands. It never draws sprites nor
 * resolves collisions; World and Renderer stay independent of each other.
 */
export class GameApp {
  constructor({ level, canvas, surface, renderer, audio, loop, settings, reducedMotion }) {
    Object.assign(this, { level, canvas, surface, renderer, audio, loop, settings, reducedMotion });
    this.clock = new Clock(); this.hud = new Hud();
    this.dialog = new Dialog({
      onPrimary: kind => kind === 'pause' || kind === 'restart' ? this.resume() : kind === 'help' ? this.closeHelp() : this.start(),
      onSecondary: kind => kind === 'restart' ? this.resume() : this.menu(),
      onDismiss: kind => kind === 'pause' || kind === 'restart' ? this.resume() : kind === 'result' ? this.menu() : this.closeHelp(),
    });
    this.state = 'menu'; this.speed = 1; this.selectedId = null; this.skill = 'dig'; this.dirty = true;
    this.world = new World(level); this.tap = null;
    this.edges = { left: $('edge-left'), right: $('edge-right'), track: $('view-track'), thumb: $('view-thumb') };
    surface.onChange = () => this.updateCamera();
    this.bindInput(); this.showLevel(); this.updateSound(); this.updateBest();
    reducedMotion.addEventListener?.('change', () => { this.dirty = true; });
  }

  // ── State machine ──────────────────────────────────────────────────────────
  setMode(next) {
    this.state = next; this.clock.reset(); this.loop.resetTime(); this.dirty = true;
    const menu = next === 'menu';
    document.body.classList.toggle('playing', !menu);
    $('intro').hidden = !menu; $('hud').hidden = menu; $('toolbar').hidden = menu;
    this.surface.setZoomable(!menu); this.updateCamera();
    setText($('keyboard-note'), menu ? '' : '← → ELEGIR · ENTER CAVAR · − + RITMO · P PAUSA');
  }
  start() {
    this.dialog.close(); this.audio.unlock(); this.audio.stop();
    this.world = new World(this.level); this.selectedId = null; this.setSpeed(1);
    this.setMode('playing'); this.hud.setLevel(this.level); this.hud.tick(this.world, 0, true);
    // Frame the hatch and the ground ahead of it, where the first decision happens.
    this.surface.centerOn(this.level.spawn.x + 40, false);
    this.hint(`${SKILLS[this.skill].label} está seleccionado. Pulsa un lemming cuando llegue a la plataforma.${this.surface.scrolling ? ' Desliza para mover la vista.' : ''}`);
    this.announce(`Etapa ${this.level.number}. Rescata al menos ${this.level.required}. Selecciona con las flechas y pulsa Enter para cavar.`);
    this.canvas.focus({ preventScroll: true });
  }
  menu() {
    this.dialog.close(); this.audio.stop(); this.world = new World(this.level); this.selectedId = null;
    this.setMode('menu'); this.hint('Cava un túnel para llegar a la salida.');
    $('start').focus({ preventScroll: true });
  }
  pause() {
    if (this.state !== 'playing') return;
    this.setMode('paused'); this.audio.stop();
    this.dialog.show({ kind: 'pause', kicker: this.kicker(), title: 'Un pequeño respiro.',
      body: el('p', {}, 'La colonia está esperando. El tiempo y todos los lemmings están en pausa.'),
      primary: 'CONTINUAR EXPEDICIÓN', secondary: 'Volver al menú' });
  }
  resume() { this.dialog.close(); this.setMode('playing'); this.canvas.focus({ preventScroll: true }); }
  confirmRestart() {
    if (this.state !== 'playing') return;
    this.setMode('paused'); this.audio.stop();
    this.dialog.show({ kind: 'restart', kicker: this.kicker(), title: '¿Volver al comienzo?',
      body: el('p', {}, `Esta expedición empezará de nuevo, con los ${this.level.total} lemmings y todas las habilidades.`),
      primary: 'REINICIAR ETAPA', secondary: 'Seguir jugando' });
  }
  showHelp() {
    const l = this.level;
    this.dialog.show({ kind: 'help', kicker: this.kicker(), title: 'Un camino a casa.', primary: 'ENTENDIDO', body: [
      el('ol', {}, el('li', {}, 'Los lemmings caminan solos.'), el('li', {}, 'Pulsa un caminante sobre la plataforma para que cave.'),
        el('li', {}, `Abre el túnel antes de que lleguen al borde. Rescata al menos ${l.required} de ${l.total}.`)),
      el('p', {}, 'Ratón o toque: cavar. Teclado: ← → elegir, Enter cavar, − + ritmo, P o Escape pausar.'),
    ] });
  }
  closeHelp() { this.dialog.close(); $('help').focus(); }
  finish() {
    const w = this.world, l = this.level, won = w.result === 'won';
    this.setMode('result'); this.audio.stop(); this.audio.play(won ? 'victory' : 'defeat');
    if (recordBest(this.settings, l, w.saved)) { saveSettings(this.settings); this.updateBest(); }
    this.dialog.show({ kind: 'result', kicker: 'INFORME DE EXPEDICIÓN',
      title: won ? (w.saved === l.total ? 'Todos en casa.' : 'Misión cumplida.') : 'Inténtalo otra vez.',
      body: [
        el('div', { class: 'result-number' }, String(w.saved), el('span', {}, ` / ${l.total}`)),
        el('p', {}, `LEMMINGS A SALVO · ${Math.round(w.saved / l.total * 100)}%`),
        el('p', {}, won ? 'La colonia vuelve a respirar. Has completado la expedición.'
          : `${l.hint} Basta con rescatar ${l.required} para superar la etapa.`),
      ],
      primary: 'VOLVER A JUGAR', secondary: 'Volver al menú' });
    this.announce(`${won ? 'Etapa superada' : 'Etapa no superada'}. ${w.saved} de ${l.total} lemmings a salvo.`);
  }

  // ── Commands ───────────────────────────────────────────────────────────────
  assign(id) {
    if (this.state !== 'playing') return;
    const label = SKILLS[this.skill].label;
    if (this.world.assign(id, this.skill)) {
      const x = this.world.lemmings.find(l => l.id === id).x;
      const crew = this.world.lemmings.filter(l => l.state === 'digging' && l.x === x).length;
      this.hint(crew > 1 ? `¡Cuadrilla de ${crew}! El hoyo baja ${crew} veces más rápido.`
        : 'Cavando. Es trabajo lento: suma a los que caigan al hoyo para avanzar más rápido.');
      this.announce(crew > 1 ? `Lemming ${id} se une. Cuadrilla de ${crew}.` : `Lemming ${id}: ${label.toLowerCase()}.`);
    } else if (!(this.world.inventory[this.skill] > 0)) {
      this.hint(`No quedan usos de ${label}.`); this.announce(`No quedan usos de ${label}.`);
    } else {
      this.hint(`Solo pueden ${label.toLowerCase()} los lemmings que caminan sobre tierra firme.`);
      this.announce(`Espera a que el lemming esté caminando para asignarle ${label}.`);
    }
    this.hud.tick(this.world, 0, true); this.dirty = true;
  }
  changeRate(delta) {
    if (this.state === 'playing' && this.world.setRate(this.world.rate + delta)) {
      this.hud.tick(this.world, 0, true); this.announce(`Ritmo de salida ${this.world.rate}.`);
    }
  }
  setSpeed(speed) {
    this.speed = speed; this.clock.reset();
    const button = $('speed');
    button.replaceChildren(`×${speed} `, el('span', {}, 'VELOCIDAD'));
    button.setAttribute('aria-pressed', String(speed !== 1));
  }
  selectStep(delta) {
    const living = this.world.active;
    if (!living.length) return;
    const index = living.findIndex(l => l.id === this.selectedId);
    const l = living[index < 0 ? (delta > 0 ? 0 : living.length - 1) : (index + delta + living.length) % living.length];
    this.selectedId = l.id; this.dirty = true;
    if (!this.surface.isVisible(l.x, 24)) this.surface.centerOn(l.x);
    this.announce(`Lemming ${l.id}, ${STATE_LABEL[l.state] ?? l.state}.`);
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  bindInput() {
    const { canvas, surface } = this, on = (id, fn) => $(id).addEventListener('click', fn);
    canvas.addEventListener('pointermove', event => {
      if (this.state !== 'playing' || event.pointerType === 'touch') return;
      const p = surface.toWorld(event), found = this.world.findAt(p.x, p.y, surface.worldRadius(12, 14))?.id ?? null;
      if (found !== this.selectedId) { this.selectedId = found; this.dirty = true; }
    });
    canvas.addEventListener('pointerleave', event => {
      if (event.pointerType !== 'touch' && this.selectedId !== null) { this.selectedId = null; this.dirty = true; }
    });
    // Mouse assigns on press. Touch assigns on release, and only if the finger
    // did not travel: a swipe pans the camera (the browser cancels the pointer).
    canvas.addEventListener('pointerdown', event => {
      if (this.state !== 'playing' || event.button !== 0) return;
      canvas.focus({ preventScroll: true });
      if (event.pointerType === 'touch') this.tap = { id: event.pointerId, x: event.clientX, y: event.clientY };
      else this.pick(event, surface.worldRadius(12, 14));
    });
    canvas.addEventListener('pointerup', event => {
      const tap = this.tap; this.tap = null;
      if (!tap || tap.id !== event.pointerId || this.state !== 'playing') return;
      if (Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <= TAP_SLOP) this.pick(event, surface.worldRadius(28, 22));
    });
    canvas.addEventListener('pointercancel', () => { this.tap = null; });
    this.surface.viewport.addEventListener('scroll', () => this.updateCamera(), { passive: true });
    this.edges.left.addEventListener('click', () => this.jumpTo(-1));
    this.edges.right.addEventListener('click', () => this.jumpTo(1));
    canvas.addEventListener('keydown', event => {
      if (this.state !== 'playing') return;
      if (event.code === 'ArrowRight' || event.code === 'ArrowLeft') {
        event.preventDefault(); this.selectStep(event.code === 'ArrowRight' ? 1 : -1);
      } else if (event.code === 'Enter' || event.code === 'NumpadEnter') {
        event.preventDefault();
        if (this.selectedId !== null) this.assign(this.selectedId);
        else this.hint('Elige un lemming con las flechas antes de pulsar Enter.');
      }
    });
    document.addEventListener('keydown', event => {
      if (event.repeat || this.dialog.open || this.state !== 'playing' || event.ctrlKey || event.metaKey || event.altKey) return;
      const code = event.code;
      if (code === 'Escape' || code === 'KeyP') { event.preventDefault(); this.pause(); }
      else if (code === 'KeyD') { event.preventDefault(); $('dig').click(); }
      else if (code === 'Minus' || code === 'NumpadSubtract') { event.preventDefault(); this.changeRate(-5); }
      else if (code === 'Equal' || code === 'NumpadAdd') { event.preventDefault(); this.changeRate(5); }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); else this.loop.resetTime(); });
    on('start', () => this.start());
    on('pause', () => this.pause());
    on('help', () => this.showHelp());
    on('restart', () => this.confirmRestart());
    on('slower', () => this.changeRate(-5));
    on('faster', () => this.changeRate(5));
    on('speed', () => { if (this.state === 'playing') this.setSpeed(this.speed === 1 ? 3 : 1); });
    on('dig', () => {
      if (this.state !== 'playing') return;
      this.skill = 'dig';
      this.hint('Cavar seleccionado. Ahora pulsa un lemming sobre la plataforma.'); canvas.focus({ preventScroll: true });
    });
    on('sound', () => {
      this.audio.unlock(); this.settings.muted = !this.settings.muted; this.updateSound(); saveSettings(this.settings);
      if (this.settings.muted) this.audio.stop(); else if (this.state !== 'paused') this.audio.play('saved');
    });
  }

  pick(event, radius) {
    const p = this.surface.toWorld(event), l = this.world.findAt(p.x, p.y, radius);
    if (l) { this.selectedId = l.id; this.assign(l.id); }
    else this.hint('Pulsa sobre un lemming que esté caminando, no sobre el terreno.');
  }

  // ── Camera ─────────────────────────────────────────────────────────────────
  /** Edge badges count lemmings outside the visible span; the track shows where the view is. */
  updateCamera() {
    const { left, right, track, thumb } = this.edges, show = this.surface.scrolling && this.state !== 'menu';
    track.hidden = !show;
    if (!show) { left.hidden = right.hidden = true; return; }
    const v = this.surface.view, width = this.level.width;
    let before = 0, after = 0;
    for (const l of this.world.lemmings) {
      if (l.state === 'saved' || l.state === 'lost') continue;
      if (l.x < v.x + 4) before++; else if (l.x > v.x + v.width - 4) after++;
    }
    this.setEdge(left, before, 'izquierda'); this.setEdge(right, after, 'derecha');
    const thumbStyle = `left:${(v.x / width * 100).toFixed(1)}%;width:${(v.width / width * 100).toFixed(1)}%`;
    if (thumb.dataset.style !== thumbStyle) { thumb.dataset.style = thumbStyle; thumb.style.cssText = thumbStyle; }
  }
  setEdge(button, count, side) {
    if (button.dataset.count === String(count)) return;
    button.dataset.count = count; button.hidden = count === 0;
    setText(button.querySelector('b'), count);
    button.setAttribute('aria-label', `${count} lemming${count === 1 ? '' : 's'} a la ${side}: mover la vista`);
  }
  /** Pans to the nearest off-screen living lemming on one side. */
  jumpTo(side) {
    const v = this.surface.view;
    const candidates = this.world.active.filter(l => side < 0 ? l.x < v.x + 4 : l.x > v.x + v.width - 4);
    if (!candidates.length) return;
    const target = candidates.reduce((a, b) => (side < 0 ? b.x > a.x : b.x < a.x) ? b : a);
    this.surface.centerOn(target.x); this.canvas.focus({ preventScroll: true });
  }

  // ── Frame ──────────────────────────────────────────────────────────────────
  frame(elapsed) {
    if (this.state === 'playing') {
      this.clock.advance(elapsed, this.speed, dt => this.world.update(dt));
      for (const event of this.world.drainEvents()) this.onEvent(event);
      this.hud.tick(this.world, elapsed, !!this.world.result);
      if (this.surface.scrolling) this.updateCamera();
      this.dirty = true;
      if (this.world.result) this.finish();
    }
    if (this.dirty) {
      this.renderer.draw(this.world, { preview: this.state === 'menu', selectedId: this.selectedId, reducedMotion: this.reducedMotion.matches });
      this.dirty = false;
    }
  }
  onEvent(event) {
    if (event.type === 'victory' || event.type === 'defeat' || event.type === 'debris') return;
    this.audio.play(event.type);
    if ((event.type === 'saved' || event.type === 'lost') && event.id === this.selectedId) this.selectedId = null;
    if (event.type === 'saved') {
      this.hint(`${this.world.saved} a salvo. Sigue acompañando al resto de la colonia.`);
      this.announce(`${this.world.saved} de ${this.level.total} a salvo.`);
    }
  }

  // ── Presentation helpers ───────────────────────────────────────────────────
  showLevel() {
    const l = this.level, minutes = Math.round(l.seconds / 60);
    setText($('mission-number'), `ETAPA ${l.number}`);
    setText($('title'), `${l.name}.`);
    setText($('mission-brief'), `${l.total} lemmings · Rescata al menos ${l.required} · ${minutes} minuto${minutes === 1 ? '' : 's'}`);
    setText($('start-label'), `JUGAR ETAPA ${l.number}`);
    setText($('stage-label'), `ETAPA ${l.number} / ${l.name.toUpperCase()}`);
    $('game').setAttribute('aria-label', `Etapa ${l.number}: ${l.name}`);
    this.hud.setLevel(l); this.hud.tick(this.world, 0, true);
  }
  kicker() { return `EXPEDICIÓN ${String(this.level.number).padStart(3, '0')} / ${this.level.name.toUpperCase()}`; }
  updateSound() {
    const muted = this.settings.muted, button = $('sound');
    this.audio.muted = muted;
    setText(button, `SONIDO: ${muted ? 'NO' : 'SÍ'}`);
    button.setAttribute('aria-pressed', String(muted));
    button.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar sonido');
  }
  updateBest() {
    const best = bestFor(this.settings, this.level);
    setText($('best'), `MEJOR RESCATE: ${best ? `${best} / ${this.level.total}` : '—'}`);
  }
  hint(message) { setText($('hint'), message); }
  announce(message) { setText($('announcement'), message); }
}
