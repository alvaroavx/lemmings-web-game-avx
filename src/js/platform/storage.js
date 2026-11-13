const KEY = 'avx-lemmings-v1';
const DEFAULTS = () => ({ muted: false, best: {} });
const validCount = v => Number.isInteger(v) && v >= 0 && v <= 999;

/**
 * Preferences and best rescue per level id, under one namespaced key.
 * Accepts the legacy `{ best: <number> }` shape (stage 1 only). Any malformed
 * value or storage exception falls back to defaults.
 */
export function loadSettings(legacyLevelId = 'just-dig') {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    const settings = DEFAULTS();
    if (!raw || typeof raw !== 'object') return settings;
    settings.muted = raw.muted === true;
    if (validCount(raw.best)) settings.best[legacyLevelId] = raw.best;
    else if (raw.best && typeof raw.best === 'object') {
      for (const [id, value] of Object.entries(raw.best)) if (validCount(value)) settings.best[id] = value;
    }
    return settings;
  } catch { return DEFAULTS(); }
}
export function saveSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify({ muted: settings.muted === true, best: settings.best ?? {} })); }
  catch { /* Private/blocked storage must not prevent play. */ }
}
export const bestFor = (settings, level) => Math.min(level.total, settings.best[level.id] ?? 0);
/** Records a rescue; returns true only when it improved the stored best. */
export function recordBest(settings, level, saved) {
  if (saved <= bestFor(settings, level)) return false;
  settings.best[level.id] = saved; return true;
}
