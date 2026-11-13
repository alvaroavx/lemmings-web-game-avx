/**
 * Original chiptune music, synthesised live with Web Audio (no audio files).
 *
 * "Marcha de la colonia" — composed for Lemmings AVX: a playful, exploring
 * march in C major, 126 BPM, 16 bars (~30 s) looped. Phrase A climbs in
 * staccato arpeggios; phrase B wanders into A minor before marching home.
 * Voices: 25 % pulse lead, triangle oom-pah bass, noise/sine drum kit.
 *
 * Theme and variations: every stage plays the same march, transformed by a
 * VARIATION (data): key, parallel minor, tempo, lead octave and pulse width,
 * drum groove, bass figure and phrase order. The colony keeps its tune while
 * each stage gets its own mood; a future stage generator can pick or combine
 * variations the same way.
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

/**
 * Variation fields (all optional): title, bpm, transpose (semitones), minor
 * (parallel minor: E, A, B lowered), octave (lead only), duty (lead pulse
 * width), drums ('march' | 'half' | 'drive' | 'none'), bass ('oompah' |
 * 'pedal' | 'walk'), order (phrase letters, A = bars 1–8, B = bars 9–16).
 */
const VARIATIONS = Object.freeze({
  'paracaidas': { title: 'Marcha en el aire', transpose: 5, bpm: 112, duty: 0.125, drums: 'half', bass: 'pedal' },
  'muralla-viva': { title: 'Marcha de guardia', transpose: 2, bpm: 120, order: 'BA' },
  'bajar-y-trepar': { title: 'Marcha de cordada', transpose: -2, bpm: 132, bass: 'walk' },
  'atraviesa': { title: 'Marcha a golpes', bpm: 138, duty: 0.5, drums: 'drive' },
  'conten-y-detona': { title: 'Marcha con mecha', minor: true, bpm: 120, drums: 'drive', bass: 'pedal' },
  'escalera': { title: 'Marcha de peldaños', transpose: 4, bpm: 128, bass: 'walk', order: 'AABB' },
  'acero': { title: 'Marcha de acero', minor: true, transpose: -2, bpm: 116, duty: 0.125 },
  'dos-compuertas': { title: 'Marcha a dos voces', transpose: 2, bpm: 140, bass: 'walk', order: 'ABBA' },
  'la-bestia': { title: 'Marcha de la bestia', minor: true, bpm: 144, duty: 0.5, drums: 'drive', bass: 'walk', order: 'AABB' },
});
export const TRACKS = Object.freeze({ [MARCH.id]: MARCH,
  ...Object.fromEntries(Object.entries(VARIATIONS).map(([id, v]) => [id, Object.freeze({ ...MARCH, ...v, id })])) });
export const DEFAULT_TRACK = MARCH.id;

const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MINOR = new Set([4, 9, 11]); // C major → C minor (natural): E, A and B go down a semitone
const midiOf = name => {
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  return 12 * (Number(m[3]) + 1) + SEMITONE[m[1]] + (m[2] ? 1 : 0);
};
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
/** Note name → frequency, after the variation's mode and key. */
const pitch = (name, { minor = false, transpose = 0 } = {}, shift = 0) => {
  const midi = midiOf(name);
  return hz(midi - (minor && MINOR.has(midi % 12) ? 1 : 0) + transpose + shift);
};
/** Chord third in semitones. In minor mode C and F turn minor; lowered roots (E♭, A♭, B♭) turn major; G stays the dominant. */
const third = (chord, minor) => {
  if (!minor) return chord.endsWith('m') ? 3 : 4;
  if ('CF'.includes(chord[0])) return 3;
  if ('EAB'.includes(chord[0])) return 4;
  return chord.endsWith('m') ? 3 : 4;
};
const BASS = {
  oompah: (root, fifth) => [{ at: 0, freq: root, steps: 1.6 }, { at: 2, freq: fifth, steps: 1.2 }],
  pedal: root => [{ at: 0, freq: root, steps: 3.6 }],
  walk: (root, fifth, third) => [{ at: 0, freq: root, steps: 0.9 }, { at: 1, freq: third, steps: 0.9 },
    { at: 2, freq: fifth, steps: 0.9 }, { at: 3, freq: third, steps: 0.9 }],
};
const DRUMS = {
  march: [[0, 'kick'], [4, 'kick'], [2, 'snare'], [6, 'snare'], [1, 'hat'], [3, 'hat'], [5, 'hat'], [7, 'hat']],
  half: [[0, 'kick'], [4, 'snare'], [2, 'hat'], [6, 'hat']],
  drive: [[0, 'kick'], [2, 'kick'], [4, 'kick'], [6, 'kick'], [2, 'snare'], [6, 'snare'],
    ...Array.from({ length: 16 }, (_, i) => [i / 2, 'hat'])],
  none: [],
};
/** Phrase letters → bar indices of the 16-bar theme (A = 0–7, B = 8–15). */
const arrangeBars = (order, bars) => order
  ? [...order].flatMap(letter => Array.from({ length: 8 }, (_, i) => (letter === 'B' ? 8 : 0) + i))
  : Array.from({ length: bars }, (_, i) => i);

/**
 * Turns the authored strings, transformed by the track's variation fields,
 * into timed events: { step, freq, steps } and drum hits. Every bar is
 * validated, even bars the arrangement does not play.
 */
export function compile(track) {
  const lead = [], bass = [], drums = [];
  const key = { minor: !!track.minor, transpose: track.transpose ?? 0 }, octave = (track.octave ?? 0) * 12;
  const bassFigure = BASS[track.bass ?? 'oompah'], groove = DRUMS[track.drums ?? 'march'];
  if (!bassFigure || !groove) throw new Error(`Variación desconocida: ${track.bass ?? ''} ${track.drums ?? ''}`);
  const parsed = track.lead.map((bar, b) => {
    const tokens = bar.trim().split(/\s+/);
    if (tokens.length !== STEPS_PER_BAR) throw new Error(`Compás ${b + 1}: se esperan ${STEPS_PER_BAR} tiempos`);
    return tokens;
  });
  const bars = arrangeBars(track.order, parsed.length);
  bars.forEach((b, position) => {
    const s = position * STEPS_PER_BAR;
    parsed[b].forEach((token, i) => {
      if (token === '-') { if (lead.length) lead.at(-1).steps++; }
      else if (token !== '.') lead.push({ step: s + i, freq: pitch(token, key, octave), steps: 1 });
    });
    track.chords[b].split(' ').forEach((chord, half) => {
      const root = pitch(`${chord[0]}3`, key);
      const fifth = root * 2 ** (7 / 12), third3 = root * 2 ** (third(chord, key.minor) / 12);
      for (const n of bassFigure(root, fifth, third3)) bass.push({ step: s + half * 4 + n.at, freq: n.freq, steps: n.steps });
    });
    for (const [at, kind] of groove) drums.push({ step: s + at, kind });
    if (track.rolls.includes(b) && groove.length) drums.push({ step: s + 7, kind: 'snare' }, { step: s + 7.5, kind: 'snare' });
  });
  return { length: bars.length * STEPS_PER_BAR, stepSeconds: 60 / track.bpm / 2, duty: track.duty ?? 0.25, lead, bass, drums };
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
    this.pulses = new Map();
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
    const pulse = this.pulseFor(this.song.duty);
    for (const n of lead) if (n.step === step) this.tone(pulse, n.freq, at, n.steps * dt * 0.82, 0.16);
    for (const n of bass) if (n.step === step) this.tone('triangle', n.freq, at, n.steps * dt * 0.7, 0.34);
    for (const d of drums) if (Math.floor(d.step) === step) this.drum(d.kind, at + (d.step % 1) * dt);
  }
  /** One periodic wave per pulse width, built once per AudioContext. */
  pulseFor(duty) {
    if (!this.pulses.has(duty)) this.pulses.set(duty, this.audio.context.createPeriodicWave(...pulseWave(duty)));
    return this.pulses.get(duty);
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
