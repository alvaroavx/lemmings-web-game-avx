import { $, setText } from './dom.js';

/**
 * Wraps the single native <dialog>: focus on open, Escape and the close
 * button resolve to `onDismiss(kind)`, buttons to `onPrimary/onSecondary(kind)`.
 */
export class Dialog {
  constructor({ onPrimary, onSecondary, onDismiss }) {
    this.node = $('modal'); this.kind = null;
    this.parts = { kicker: $('modal-kicker'), title: $('modal-title'), copy: $('modal-copy'),
      primary: $('modal-primary'), secondary: $('modal-secondary') };
    this.parts.primary.addEventListener('click', () => onPrimary(this.kind));
    this.parts.secondary.addEventListener('click', () => onSecondary(this.kind));
    this.node.addEventListener('cancel', event => { event.preventDefault(); onDismiss(this.kind); });
    this.node.querySelector('form').addEventListener('submit', event => { event.preventDefault(); onDismiss(this.kind); });
  }
  get open() { return this.node.open; }
  show({ kind, kicker, title, body, primary, secondary = null }) {
    const p = this.parts;
    this.kind = kind;
    setText(p.kicker, kicker); setText(p.title, title);
    p.copy.replaceChildren(...[body].flat());
    setText(p.primary, primary);
    p.secondary.hidden = !secondary; if (secondary) setText(p.secondary, secondary);
    if (!this.node.open) this.node.showModal();
    p.primary.focus();
  }
  close() { if (this.node.open) this.node.close(); this.kind = null; }
}
