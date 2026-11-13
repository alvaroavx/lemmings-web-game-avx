export const $ = id => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Falta el elemento #${id}`);
  return node;
};
/** Writes text only when it changes, avoiding needless layout and live-region noise. */
export const setText = (node, value) => {
  const next = String(value);
  if (node.textContent !== next) node.textContent = next;
};
/** Minimal element builder: text is always text, never parsed as HTML. */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value; else node.setAttribute(key, value);
  }
  for (const child of children.flat()) if (child != null && child !== false) node.append(child instanceof Node ? child : String(child));
  return node;
}
export const clock = seconds => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
