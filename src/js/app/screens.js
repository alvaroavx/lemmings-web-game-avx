import { $ } from './dom.js';

/**
 * Full-screen overlays (menu, pause, restart, help, result). Exactly one or
 * none is visible. While one is shown, the stage, HUD and tools are inert so
 * pointer, keyboard and assistive technology stay inside the screen.
 */
export class Screens {
  constructor(ids, backgroundIds) {
    this.nodes = Object.fromEntries(ids.map(id => [id, $(id)]));
    this.background = backgroundIds.map(id => $(id));
    this.current = null;
  }
  show(id, focusId) {
    for (const [key, node] of Object.entries(this.nodes)) node.hidden = key !== id;
    this.current = id;
    for (const node of this.background) node.inert = true;
    // Side screens leave the stage visible: the shell shrinks it to the free area.
    $('game-shell').classList.toggle('game--side', this.nodes[id].classList.contains('screen--side'));
    const target = focusId ? $(focusId) : this.nodes[id].querySelector('button:not([hidden]):not(:disabled)');
    target?.focus({ preventScroll: true });
  }
  hide() {
    for (const node of Object.values(this.nodes)) node.hidden = true;
    this.current = null;
    $('game-shell').classList.remove('game--side');
    for (const node of this.background) node.inert = false;
  }
  is(id) { return this.current === id; }
}
