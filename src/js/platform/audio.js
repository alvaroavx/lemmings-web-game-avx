/**
 * Short original synthesised cues; no audio assets or background timers.
 * Frequencies stay above ~200 Hz so laptop and phone speakers reproduce them.
 */
const CUES = Object.freeze({
  spawn: { wave: 'triangle', notes: [523], length: .12 },
  dig: { wave: 'square', notes: [330, 247], length: .09, level: .5 },
  saved: { wave: 'triangle', notes: [523, 659, 784], length: .14 },
  lost: { wave: 'square', notes: [294, 220], length: .14, level: .45 },
  victory: { wave: 'triangle', notes: [523, 659, 784, 1047], length: .18 },
  float: { wave: 'triangle', notes: [392, 523], length: .1 },
  climb: { wave: 'triangle', notes: [330, 392, 494], length: .08 },
  block: { wave: 'square', notes: [262, 262], length: .08, level: .45 },
  build: { wave: 'triangle', notes: [294, 370], length: .09 },
  bash: { wave: 'square', notes: [220, 220], length: .07, level: .45 },
  mine: { wave: 'square', notes: [247, 208], length: .08, level: .45 },
  bomb: { wave: 'square', notes: [880, 880], length: .06, level: .4 },
  explode: { wave: 'sawtooth', notes: [220, 208, 202], length: .16, level: .5 },
  shrug: { wave: 'triangle', notes: [247], length: .1 },
  doom: { wave: 'triangle', notes: [247, 208, 175], length: .28, level: .6 },
  defeat: { wave: 'triangle', notes: [392, 330, 262], length: .2 },
});
const MASTER = .5, PEAK = .4, MAX_VOICES = 24;

export class Audio {
  constructor() { this.muted = false; this.context = null; this.master = null; this.voices = new Set(); }
  /** Must run inside a user gesture: creates or resumes the context. */
  unlock() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain(); this.master.gain.value = MASTER;
        this.master.connect(this.context.destination);
      }
      if (this.context.state !== 'running') this.context.resume().catch(() => {});
    } catch { /* Audio is optional. */ }
  }
  play(type) {
    const cue = CUES[type], c = this.context;
    if (this.muted || !cue || !c) return;
    // Browsers suspend contexts (tab switches, iOS interruptions): try to come back.
    // The cue plays as soon as it resumes, so unmuting always gives feedback.
    if (c.state !== 'running') {
      c.resume().then(() => { if (c.state === 'running') this.play(type); }).catch(() => {});
      return;
    }
    if (this.voices.size >= MAX_VOICES) return;
    const peak = PEAK * (cue.level ?? 1);
    cue.notes.forEach((frequency, i) => {
      const oscillator = c.createOscillator(), gain = c.createGain(), at = c.currentTime + i * cue.length * .8;
      oscillator.type = cue.wave; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(peak, at + .008);
      gain.gain.exponentialRampToValueAtTime(.001, at + cue.length);
      oscillator.connect(gain); gain.connect(this.master);
      this.voices.add(oscillator);
      oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(at); oscillator.stop(at + cue.length + .02);
    });
  }
  stop() { for (const voice of this.voices) { try { voice.stop(); } catch {} } this.voices.clear(); }
}
