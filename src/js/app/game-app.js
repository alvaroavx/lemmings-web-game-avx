import { Clock } from '../engine/clock.js';
import { World } from '../game/world.js';
import { SKILLS } from '../game/skills.js';
import { $, setText, el } from './dom.js';
import { Hud } from './hud.js';
import { Screens } from './screens.js';
import { bestFor, recordBest, saveSettings } from '../platform/storage.js';
import { DEFAULT_TRACK } from '../platform/music.js';

const TAP_SLOP = 10; // CSS px a finger may drift and still count as a tap
const TIE = 3; // world units: a walker this close to a tapped worker counts as the same spot
const STATE_LABEL = { walking: 'caminando', falling: 'cayendo', digging: 'cavando' };
const pad = n => String(n).padStart(2, '0');

/**
 * Application coordinator: owns the state machine
 *   menu → playing ⇄ paused (pause | restart screens), playing → result → menu | playing
 * and translates input into World commands. It never draws sprites nor
 * resolves collisions; World and Renderer stay independent of each other.
 * Stages come from `levels`; the main menu lists every one of them.
 */
export class GameApp {
  constructor({ levels, canvas, surface, renderer, audio, music, loop, settings, reducedMotion }) {
    Object.assign(this, { levels, canvas, surface, renderer, audio, music, loop, settings, reducedMotion });
    this.settingsReturn = 'start-screen';
    this.level = levels[0];
    this.clock = new Clock(); this.hud = new Hud();
    this.screens = new Screens(['start-screen', 'pause-screen', 'restart-screen', 'help-screen', 'settings-screen', 'result-screen'],
      ['hud', 'stage-frame', 'toolbar']);
    this.state = 'menu'; this.speed = 1; this.selectedId = null; this.skill = 'dig'; this.dirty = true;
    this.world = new World(this.level); this.tap = null;
    this.edges = { left: $('edge-left'), right: $('edge-right'), track: $('view-track'), thumb: $('view-thumb') };
    surface.onChange = () => this.updateCamera();
    this.buildStageList(); this.bindInput(); this.updateSound();
    reducedMotion.addEventListener?.('change', () => { this.dirty = true; });
    this.menu();
  }

  // ── State machine ──────────────────────────────────────────────────────────
  setMode(next) {
    this.state = next; this.clock.reset(); this.loop.resetTime(); this.dirty = true;
    const menu = next === 'menu';
    $('game-shell').classList.toggle('game--playing', !menu);
    this.surface.setZoomable(!menu); this.updateCamera();
  }
  useLevel(level) {
    this.level = level; this.world = new World(level);
    this.renderer.setLevel(level); this.surface.fit();
    setText($('stage-number'), `ETAPA ${pad(level.number)}`);
    setText($('stage-label'), level.name.toUpperCase());
    $('stage-frame').setAttribute('aria-label', `Etapa ${level.number}: ${level.name}`);
    this.hud.setLevel(level); this.hud.tick(this.world, 0, true);
  }
  start(level = this.level) {
    if (!this.unlocked(level)) return;
    this.screens.hide(); this.audio.unlock(); this.audio.stop();
    this.useLevel(level); this.selectedId = null; this.setSpeed(1);
    this.setMode('playing'); this.music.play(this.track(), true);
    // Frame the hatch and the ground ahead of it, where the first decision happens.
    const hatch = level.hatches?.[0] ?? level.spawn; // multi-hatch stages list them in `hatches`
    this.surface.centerOn(hatch.x + 40, false);
    this.hint(`${SKILLS[this.skill].label} está seleccionado. Pulsa un lemming cuando llegue a la plataforma.${this.surface.scrolling ? ' Desliza para mover la vista.' : ''}`);
    this.announce(`Etapa ${level.number}, ${level.name}. Rescata al menos ${level.required}. Selecciona con las flechas y pulsa Enter para cavar.`);
    this.canvas.focus({ preventScroll: true });
  }
  menu() {
    this.audio.stop(); this.music.stop(); this.useLevel(this.level); this.selectedId = null;
    this.setMode('menu'); this.refreshStageList();
    this.screens.show('start-screen', `stage-${this.frontier().id}`);
  }
  pause() {
    if (this.state !== 'playing') return;
    this.setMode('paused'); this.audio.stop(); this.music.pause();
    setText($('pause-kicker'), `ETAPA ${pad(this.level.number)} // EN PAUSA`);
    this.screens.show('pause-screen', 'resume');
  }
  resume() { this.screens.hide(); this.setMode('playing'); this.music.resume(this.track()); this.canvas.focus({ preventScroll: true }); }
  track() { return this.level.music ?? DEFAULT_TRACK; }
  openSettings(from) {
    this.settingsReturn = from; this.syncMusicControl();
    this.screens.show('settings-screen', 'close-settings');
  }
  closeSettings() {
    this.screens.show(this.settingsReturn, this.settingsReturn === 'pause-screen' ? 'open-settings-pause' : 'open-settings');
  }
  setMusicVolume(value, persist) {
    this.settings.music = Math.round(value * 10) / 10; this.music.setVolume(this.settings.music); this.syncMusicControl();
    if (persist) saveSettings(this.settings);
  }
  syncMusicControl() {
    const input = $('music-volume'), percent = `${Math.round(this.settings.music * 100)}%`;
    if (Number(input.value) !== this.settings.music) input.value = this.settings.music;
    setText($('music-volume-label'), percent); input.setAttribute('aria-valuetext', percent);
  }
  confirmRestart() {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    if (this.state === 'playing') { this.setMode('paused'); this.audio.stop(); this.music.pause(); }
    setText($('restart-copy'), `La etapa ${this.level.number} empezará de nuevo con los ${this.level.total} lemmings y todas las habilidades.`);
    this.screens.show('restart-screen', 'confirm-restart');
  }
  showHelp() { if (this.state === 'menu') this.screens.show('help-screen', 'close-help'); }
  closeHelp() { this.screens.show('start-screen', 'help'); }
  finish() {
    const w = this.world, l = this.level, won = w.result === 'won';
    this.setMode('result'); this.audio.stop(); this.music.stop(); this.audio.play(won ? 'victory' : 'defeat');
    if (recordBest(this.settings, l, w.saved)) saveSettings(this.settings);
    setText($('result-title'), won ? (w.saved === l.total ? 'TODOS EN CASA' : 'MISIÓN CUMPLIDA') : 'INTÉNTALO OTRA VEZ');
    setText($('result-saved'), w.saved); setText($('result-total'), ` / ${l.total}`);
    setText($('result-percent'), `LEMMINGS A SALVO · ${Math.round(w.saved / l.total * 100)}%`);
    setText($('result-copy'), won ? 'La colonia vuelve a respirar. Has completado la expedición.'
      : `${l.hint ?? ''} Basta con rescatar ${l.required} para superar la etapa.`.trim());
    const next = won && this.nextLevel() && this.unlocked(this.nextLevel()) ? this.nextLevel() : null;
    $('next-stage').hidden = !next;
    if (next) setText($('next-stage-label'), `ETAPA ${pad(next.number)} · ${next.name.toUpperCase()}`);
    $('play-again').classList.toggle('button--primary', !next); $('play-again').classList.toggle('button--quiet', !!next);
    this.screens.show('result-screen', next ? 'next-stage' : 'play-again');
    this.announce(`${won ? 'Etapa superada' : 'Etapa no superada'}. ${w.saved} de ${l.total} lemmings a salvo.`);
  }
  nextLevel() { return this.levels[this.levels.indexOf(this.level) + 1] ?? null; }

  // ── Main menu ──────────────────────────────────────────────────────────────
  buildStageList() {
    const list = $('stage-list');
    list.classList.toggle('mission-picker--many', this.levels.length > 4);
    list.replaceChildren(...this.levels.map((level, i) => {
      const minutes = Math.round(level.seconds / 60);
      const button = el('button', { id: `stage-${level.id}`, class: 'button button--quiet mission-option', type: 'button', 'data-level': level.id },
        el('span', { class: 'button__signal' }, pad(level.number ?? i + 1)),
        el('span', { class: 'mission-option__copy' },
          el('strong', {}, level.name.toUpperCase()),
          el('small', {}, `${level.total} LEMMINGS · RESCATA ${level.required} · ${minutes} MIN`),
          level.brief ? el('small', { class: 'mission-option__brief' }, level.brief) : null,
          el('span', { class: 'mission-option__best' }, '')),
        el('span', { 'aria-hidden': 'true' }));
      button.addEventListener('click', () => this.start(level));
      return button;
    }));
    this.refreshStageList();
  }
  /** Linear campaign, as in 1991: a stage opens once the previous one is cleared. */
  cleared(level) { return bestFor(this.settings, level) >= level.required && this.settings.best[level.id] !== undefined; }
  unlocked(level) { const i = this.levels.indexOf(level); return i <= 0 || this.cleared(this.levels[i - 1]); }
  /** The stage to offer first: the earliest unlocked one not yet cleared (or the last one). */
  frontier() { return this.levels.find(l => this.unlocked(l) && !this.cleared(l)) ?? this.levels.at(-1); }
  refreshStageList() {
    for (const level of this.levels) {
      const button = $(`stage-${level.id}`), best = bestFor(this.settings, level), open = this.unlocked(level);
      const previous = this.levels[this.levels.indexOf(level) - 1];
      button.disabled = !open; button.classList.toggle('mission-option--locked', !open);
      button.classList.toggle('mission-option--cleared', this.cleared(level));
      setText(button.querySelector('.button__signal'), open ? pad(level.number) : '🔒');
      setText(button.querySelector('.mission-option__best'), !open ? `SUPERA LA ETAPA ${pad(previous.number)}`
        : this.cleared(level) ? `SUPERADA · MEJOR ${best} / ${level.total}` : best ? `MEJOR RESCATE ${best} / ${level.total}` : 'SIN JUGAR');
      button.setAttribute('aria-label', open
        ? `Etapa ${level.number}: ${level.name}. ${level.total} lemmings, rescata ${level.required}. ${this.cleared(level) ? `Superada, mejor rescate ${best}` : best ? `Mejor rescate ${best}` : 'Sin jugar'}.`
        : `Etapa ${level.number}: bloqueada. Supera la etapa ${previous.number} para abrirla.`);
    }
  }

  // ── Commands ───────────────────────────────────────────────────────────────
  assign(id) {
    if (this.state !== 'playing') return;
    const label = SKILLS[this.skill].label;
    // Touching a lemming that is already working stops it and refunds the use.
    if (this.world.cancel(id)) {
      this.hint(`Lemming ${id} deja de cavar y sigue caminando. Recuperas el uso.`);
      this.announce(`Lemming ${id} deja de cavar. Usos de ${label}: ${this.world.inventory[this.skill]}.`);
      this.hud.tick(this.world, 0, true); this.dirty = true;
      return;
    }
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
  toggleSound() {
    this.audio.unlock(); this.settings.muted = !this.settings.muted; this.updateSound(); saveSettings(this.settings);
    if (this.settings.muted) { this.audio.stop(); this.music.pause(); return; }
    // Unmuting mid-stage starts the music even if the stage began muted.
    if (this.state === 'playing') this.music.resume(this.track());
    if (this.state !== 'paused') this.audio.play('saved');
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
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const code = event.code;
      // Escape walks back one level on every screen, like Alvaroids.
      if (code === 'Escape' && this.screens.current) {
        event.preventDefault();
        if (this.screens.is('pause-screen') || this.screens.is('restart-screen')) this.resume();
        else if (this.screens.is('help-screen')) this.closeHelp();
        else if (this.screens.is('settings-screen')) this.closeSettings();
        else if (this.screens.is('result-screen')) this.menu();
        return;
      }
      if (this.state !== 'playing') return;
      if (code === 'Escape' || code === 'KeyP') { event.preventDefault(); this.pause(); }
      else if (code === 'KeyD') { event.preventDefault(); $('dig').click(); }
      else if (code === 'Minus' || code === 'NumpadSubtract') { event.preventDefault(); this.changeRate(-5); }
      else if (code === 'Equal' || code === 'NumpadAdd') { event.preventDefault(); this.changeRate(5); }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); else this.loop.resetTime(); });
    on('pause', () => this.pause());
    on('resume', () => this.resume());
    on('restart', () => this.confirmRestart());
    on('restart-from-pause', () => this.confirmRestart());
    on('confirm-restart', () => this.start());
    on('cancel-restart', () => this.resume());
    on('menu-from-pause', () => this.menu());
    on('help', () => this.showHelp());
    on('close-help', () => this.closeHelp());
    on('open-settings', () => this.openSettings('start-screen'));
    on('open-settings-pause', () => this.openSettings('pause-screen'));
    on('close-settings', () => this.closeSettings());
    $('music-volume').addEventListener('input', event => this.setMusicVolume(Number(event.target.value), false));
    $('music-volume').addEventListener('change', event => { this.audio.unlock(); this.setMusicVolume(Number(event.target.value), true); });
    on('play-again', () => this.start());
    on('next-stage', () => { const next = this.nextLevel(); if (next) this.start(next); });
    on('menu-from-result', () => this.menu());
    on('slower', () => this.changeRate(-5));
    on('faster', () => this.changeRate(5));
    on('speed', () => { if (this.state === 'playing') this.setSpeed(this.speed === 1 ? 3 : 1); });
    on('dig', () => {
      if (this.state !== 'playing') return;
      this.skill = 'dig';
      this.hint('Cavar seleccionado. Ahora pulsa un lemming sobre la plataforma.'); canvas.focus({ preventScroll: true });
    });
    on('sound', () => this.toggleSound());
    on('sound-menu', () => this.toggleSound());
  }

  pick(event, radius) {
    const p = this.surface.toWorld(event);
    let l = this.world.findAt(p.x, p.y, radius);
    // The nearest lemming wins. Only when a walker overlaps a worker almost
    // exactly (common in a pit) does the walker win: joining the crew is the
    // likelier intent, and a mistaken join can be undone by tapping again.
    if (l && l.state !== 'walking') {
      const distance = o => Math.hypot(o.x - p.x, o.y - 6 - p.y), worker = distance(l);
      const walker = this.world.active.find(o => o.state === 'walking' && distance(o) <= Math.min(radius, worker + TIE));
      if (walker) l = walker;
    }
    if (l) { this.selectedId = l.id; this.assign(l.id); }
    else this.hint('Pulsa sobre un lemming que esté caminando, no sobre el terreno.');
  }

  // ── Camera ─────────────────────────────────────────────────────────────────
  /** Edge badges count lemmings outside the visible span; the track shows where the view is. */
  updateCamera() {
    const { left, right, track, thumb } = this.edges, show = this.surface.scrolling && this.state !== 'menu';
    track.hidden = !show;
    if (!show) { left.hidden = right.hidden = true; left.dataset.count = right.dataset.count = ''; return; }
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
  updateSound() {
    const muted = this.settings.muted, hud = $('sound'), menu = $('sound-menu');
    this.audio.muted = muted;
    setText(hud, muted ? '🔇' : '🔊');
    setText($('sound-menu-label'), muted ? 'NO' : 'SÍ');
    for (const button of [hud, menu]) {
      button.setAttribute('aria-pressed', String(muted));
      button.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar sonido');
    }
  }
  hint(message) { setText($('hint'), message); }
  announce(message) { setText($('announcement'), message); }
}
