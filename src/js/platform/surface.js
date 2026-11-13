/** Smallest comfortable scale while playing: 1.25 CSS px per world unit (lemmings ≈ 17 px tall). */
export const MIN_PLAY_SCALE = 1.25;

/**
 * Presentation camera. In overview mode the whole world fits the viewport.
 * In play mode, when fitting would shrink the world below MIN_PLAY_SCALE,
 * the world keeps that scale (bounded by the available height) and the
 * viewport scrolls horizontally with native touch swipe, wheel or code.
 * World never knows the screen size or the camera position.
 */
export class Surface {
  constructor(canvas, viewport) {
    this.canvas = canvas; this.viewport = viewport;
    this.scale = 1; this.zoomable = false; this.scrolling = false;
    this.observer = new ResizeObserver(() => this.fit());
    this.observer.observe(viewport);
    // Vertical wheel pans horizontally while the world is wider than the screen.
    viewport.addEventListener('wheel', event => {
      if (!this.scrolling || event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault(); viewport.scrollLeft += event.deltaY;
    }, { passive: false });
  }
  /** Overview (menu) shows the whole world; play mode may zoom and scroll. */
  setZoomable(zoomable) {
    if (this.zoomable === zoomable) return;
    this.zoomable = zoomable; this.fit();
  }
  fit() {
    const { canvas, viewport } = this, vw = viewport.clientWidth, vh = viewport.clientHeight;
    if (!(vw > 0 && vh > 0)) return;
    const fitScale = Math.min(vw / canvas.width, vh / canvas.height);
    const scale = this.zoomable ? Math.min(vh / canvas.height, Math.max(fitScale, MIN_PLAY_SCALE)) : fitScale;
    const center = this.view.center;
    this.scale = scale;
    canvas.style.width = `${Math.floor(canvas.width * scale)}px`;
    canvas.style.height = `${Math.floor(canvas.height * scale)}px`;
    this.scrolling = Math.floor(canvas.width * scale) > vw + 1;
    viewport.classList.toggle('scrolling', this.scrolling);
    if (this.scrolling) this.centerOn(center, false); else viewport.scrollLeft = 0;
    this.onChange?.();
  }
  /** Visible horizontal span in world units. */
  get view() {
    const width = Math.min(this.canvas.width, this.viewport.clientWidth / this.scale);
    const x = this.scrolling ? this.viewport.scrollLeft / this.scale : 0;
    return { x, width, center: x + width / 2 };
  }
  centerOn(worldX, smooth = true) {
    if (!this.scrolling) return;
    const left = worldX * this.scale - this.viewport.clientWidth / 2;
    this.viewport.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'instant' });
  }
  /** True if a world x lies inside the visible span, with an optional margin in world units. */
  isVisible(worldX, margin = 0) {
    const v = this.view;
    return worldX >= v.x + margin && worldX <= v.x + v.width - margin;
  }
  toWorld(event) {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return { x: -1, y: -1 };
    return { x: (event.clientX - r.left) * this.canvas.width / r.width, y: (event.clientY - r.top) * this.canvas.height / r.height };
  }
  /** Converts an on-screen tolerance in CSS pixels to world units, never below `min`. */
  worldRadius(cssPixels, min) { return Math.max(min, cssPixels / this.scale); }
}
