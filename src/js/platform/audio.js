const CUES = Object.freeze({
  dig: [180, 120], saved: [523, 659, 784], lost: [196, 147], spawn: [440],
  victory: [523, 659, 784, 1047], defeat: [220, 165, 110],
});
const MAX_VOICES = 24;

/** Short original synthesised cues; no audio assets or background timers. */
export class Audio {
  constructor() { this.muted = false; this.context = null; this.voices = new Set(); }
  unlock() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context ||= new AudioContext();
      this.context.resume().catch(() => {});
    } catch { /* Audio is optional. */ }
  }
  play(type) {
    if (this.muted || !this.context || this.context.state !== 'running') return;
    const notes = CUES[type];
    if (!notes || this.voices.size >= MAX_VOICES) return;
    const c = this.context;
    notes.forEach((frequency, i) => {
      const oscillator = c.createOscillator(), gain = c.createGain(), at = c.currentTime + i * .095;
      oscillator.type = 'triangle'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.055, at + .01);
      gain.gain.exponentialRampToValueAtTime(.001, at + .16);
      oscillator.connect(gain); gain.connect(c.destination);
      this.voices.add(oscillator);
      oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(at); oscillator.stop(at + .18);
    });
  }
  stop() { for (const voice of this.voices) { try { voice.stop(); } catch {} } this.voices.clear(); }
}
