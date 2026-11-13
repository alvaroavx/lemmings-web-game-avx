/**
 * Original chiptune music, synthesised live with Web Audio (no audio files).
 *
 * "Marcha de la colonia" — composed for Lemmings AVX: a playful, exploring
 * march in C major, 126 BPM, 16 bars (~30 s) looped. Phrase A climbs in
 * staccato arpeggios; phrase B wanders into A minor before marching home.
 * Voices: 25 % pulse lead, triangle oom-pah bass, noise/sine drum kit.
 *
 * A short look-ahead scheduler (setInterval in the platform layer, never in
 * the simulation) queues notes on the AudioContext clock, so timing stays
 * exact even when frames drop. Pausing stops sounding notes and keeps the
 * position; resuming continues the phrase.
 */

const STEPS_PER_BAR = 8; // eighth notes in 4/4
const LOOKAHEAD = 0.15, TICK_MS = 25;

// Melody: 8 tokens per bar. Note names, "-" holds the previous note, "." rests.
const MARCH = Object.freeze({
  id: 'marcha-colonia', title: 'Marcha de la colonia', bpm: 126,
  lead: [
    // A — curious, climbing
    'C5 . E5 G5 A5 G5 E5 .', 'F5 . A5 . G5 E5 C5 .', 'D5 . F5 A5 B5 A5 F5 D5', 'G5 - - . G4 . . .',
    'C5 . E5 G5 C6 B5 A5 G5', 'F5 . A5 . G5 . E5 .', 'D5 F5 E5 G5 F5 A5 G5 B5', 'C6 - . . C5 . . .',
    // B — exploring in A minor, then marching home
    'A4 . C5 E5 A5 - G5 E5', 'F5 - E5 D5 C5 . E5 .', 'D5 . F5 A5 G5 F5 E5 D5', 'E5 - - . G5 . . .',
    'C5 . E5 G5 A5 G5 E5 C5', 'F5 A5 G5 F5 E5 G5 F5 E5', 'D5 . G5 . B4 . D5 .', 'C5 . G4 . C5 - . .',
  ],
  // Chords per half bar (root octave 3); the bass plays root then fifth.
  chords: [
    'C C', 'F C', 'Dm G', 'G G', 'C C', 'F C', 'G G', 'C C',
    'Am Am', 'F C', 'Dm G', 'Em G', 'C Am', 'F C', 'G G', 'C C',
  ],
  // Drum roll on the last beat of every phrase (bars 8 and 16).
  rolls: [7, 15],
});
export const TRACKS = Object.freeze({ [MARCH.id]: MARCH });
export const DEFAULT_TRACK = MARCH.id;

const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const frequency = name => {
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  const midi = 12 * (Number(m[3]) + 1) + SEMITONE[m[1]] + (m[2] ? 1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
};
const ROOT = { C: 'C3', D: 'D3', E: 'E3', F: 'F3', G: 'G3', A: 'A3', B: 'B3' };

/** Turns the authored strings into timed events: { step, freq, steps }. */
export function compile(track) {
  const lead = [], bass = [], drums = [];
  track.lead.forEach((bar, b) => {
    const tokens = bar.trim().split(/\s+/);
    if (tokens.length !== STEPS_PER_BAR) throw new Error(`Compás ${b + 1}: se esperan ${STEPS_PER_BAR} tiempos`);
    tokens.forEach((token, i) => {
      const step = b * STEPS_PER_BAR + i;
      if (token === '-') { if (lead.length) lead.at(-1).steps++; }
      else if (token !== '.') lead.push({ step, freq: frequency(token), steps: 1 });
    });
  });
  track.chords.forEach((bar, b) => bar.split(' ').forEach((chord, half) => {
    const root = frequency(ROOT[chord[0]]), step = b * STEPS_PER_BAR + half * 4;
    const fifth = root * 2 ** (7 / 12);
    bass.push({ step, freq: root, steps: 1.6 }, { step: step + 2, freq: fifth, steps: 1.2 });
  }));
  for (let b = 0; b < track.lead.length; b++) {
    const s = b * STEPS_PER_BAR;
    drums.push({ step: s, kind: 'kick' }, { step: s + 4, kind: 'kick' }, { step: s + 2, kind: 'snare' }, { step: s + 6, kind: 'snare' });
    for (const odd of [1, 3, 5, 7]) drums.push({ step: s + odd, kind: 'hat' });
    if (track.rolls.includes(b)) drums.push({ step: s + 7, kind: 'snare' }, { step: s + 7.5, kind: 'snare' });
  }
  return { length: track.lead.length * STEPS_PER_BAR, stepSeconds: 60 / track.bpm / 2, lead, bass, drums };
}

export class Music {
  /** `audio` provides the shared AudioContext (created on a user gesture). */
  constructor(audio) {
    this.audio = audio; this.volume = 0.6; this.timer = 0; this.playing = false;
    this.position = 0; this.song = null; this.voices = new Set(); this.bus = null;
  }
  setVolume(volume) {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.bus) this.bus.gain.setTargetAtTime(this.level(), this.bus.context.currentTime, 0.05);
    if (this.volume === 0) this.pause();
  }
  level() { return this.audio.muted ? 0 : this.volume * 0.55; }
  /** Starts a track from the beginning (or continues it when `fromStart` is false). */
  play(trackId = DEFAULT_TRACK, fromStart = true) {
    const c = this.audio.context;
    if (!c || this.audio.muted || this.volume === 0) return;
    const track = TRACKS[trackId] ?? TRACKS[DEFAULT_TRACK];
    if (!this.song || this.song.id !== track.id) { this.song = { id: track.id, ...compile(track) }; fromStart = true; }
    if (fromStart) this.position = 0;
    this.ensureBus(c);
    this.stopVoices();
    this.playing = true; this.cursor = this.position; this.nextTime = c.currentTime + 0.06;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }
  /** Continues the current track, or starts `trackId` if nothing was playing yet (e.g. muted at start). */
  resume(trackId = DEFAULT_TRACK) { this.play(this.song?.id ?? trackId, false); }
  /** Stops sound but remembers where the phrase was. */
  pause() {
    if (!this.playing) return;
    this.playing = false; clearInterval(this.timer); this.position = this.cursor % this.song.length;
    this.stopVoices();
  }
  stop() { this.pause(); this.position = 0; }
  ensureBus(c) {
    if (this.bus?.context === c) { this.bus.gain.value = this.level(); return; }
    this.bus = c.createGain(); this.bus.gain.value = this.level(); this.bus.connect(c.destination);
    this.pulse = c.createPeriodicWave(...pulseWave(0.25));
    const noise = c.createBuffer(1, c.sampleRate, c.sampleRate), data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1; // presentation only, not simulation
    this.noise = noise;
  }
  schedule() {
    const c = this.audio.context;
    if (!this.playing || !c) return;
    if (c.state !== 'running') { this.nextTime = c.currentTime + 0.06; return; }
    const { length, stepSeconds } = this.song;
    while (this.nextTime < c.currentTime + LOOKAHEAD) {
      const step = this.cursor % length;
      this.queue(step, this.nextTime, stepSeconds);
      this.nextTime += stepSeconds; this.cursor++;
    }
  }
  queue(step, at, dt) {
    const { lead, bass, drums } = this.song;
    for (const n of lead) if (n.step === step) this.tone(this.pulse, n.freq, at, n.steps * dt * 0.82, 0.16);
    for (const n of bass) if (n.step === step) this.tone('triangle', n.freq, at, n.steps * dt * 0.7, 0.34);
    for (const d of drums) if (Math.floor(d.step) === step) this.drum(d.kind, at + (d.step % 1) * dt);
  }
  tone(wave, freq, at, length, peak) {
    const c = this.audio.context, osc = c.createOscillator(), gain = c.createGain();
    if (typeof wave === 'string') osc.type = wave; else osc.setPeriodicWave(wave);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(peak, at + 0.006);
    gain.gain.setTargetAtTime(peak * 0.55, at + 0.03, 0.06);
    gain.gain.setTargetAtTime(0, at + length, 0.02);
    this.voice(osc, gain, at, at + length + 0.1);
  }
  drum(kind, at) {
    const c = this.audio.context, gain = c.createGain();
    if (kind === 'kick') {
      const osc = c.createOscillator(); osc.type = 'sine';
      osc.frequency.setValueAtTime(160, at); osc.frequency.exponentialRampToValueAtTime(48, at + 0.12);
      gain.gain.setValueAtTime(0.55, at); gain.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
      this.voice(osc, gain, at, at + 0.18);
      return;
    }
    const src = c.createBufferSource(), filter = c.createBiquadFilter();
    src.buffer = this.noise; filter.type = 'highpass';
    const hat = kind === 'hat', decay = hat ? 0.035 : 0.11;
    filter.frequency.value = hat ? 7000 : 1600;
    gain.gain.setValueAtTime(hat ? 0.05 : 0.2, at); gain.gain.exponentialRampToValueAtTime(0.001, at + decay);
    src.connect(filter);
    this.voice(src, gain, at, at + decay + 0.02, filter);
  }
  voice(source, gain, start, end, input = source) {
    input.connect(gain); gain.connect(this.bus);
    this.voices.add(source);
    source.onended = () => { this.voices.delete(source); source.disconnect(); gain.disconnect(); };
    source.start(start); source.stop(end);
  }
  stopVoices() {
    for (const v of this.voices) { try { v.stop(); } catch { /* already stopped */ } }
    this.voices.clear();
  }
}

/** Fourier series of a pulse wave with the given duty cycle (NES-like timbre). */
function pulseWave(duty, harmonics = 32) {
  const real = new Float32Array(harmonics), imag = new Float32Array(harmonics);
  for (let n = 1; n < harmonics; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  return [real, imag];
}
