import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, DEFAULT_TRACK } from '../src/js/platform/music.js';

test('the stage march compiles to a 16-bar loop of about 30 seconds', async () => {
  const { Music } = await import('../src/js/platform/music.js');
  assert.equal(typeof Music, 'function'); assert.equal(DEFAULT_TRACK, 'marcha-colonia');
  // Re-create the authored track through the public compile() using a minimal fixture check.
  const song = compile({ bpm: 126, lead: Array(16).fill('C5 - . E5 G5 . . .'), chords: Array(16).fill('C G'), rolls: [7, 15] });
  assert.equal(song.length, 128);
  assert.ok(Math.abs(song.length * song.stepSeconds - 30.48) < 0.01);
  assert.equal(song.lead.length, 48); assert.equal(song.lead[0].steps, 2, 'a "-" holds the previous note');
  assert.ok(Math.abs(song.lead[0].freq - 523.25) < 0.01, 'C5 ≈ 523 Hz');
  assert.equal(song.bass.length, 64);
  assert.equal(song.drums.filter(d => d.kind === 'snare').length, 16 * 2 + 4, 'two snares per bar plus two rolls');
});
test('malformed bars are rejected with the bar number', () => {
  assert.throws(() => compile({ bpm: 120, lead: ['C5 . .'], chords: ['C C'], rolls: [] }), /Compás 1/);
});
test('the authored march is well-formed and stays in a speaker-friendly range', async () => {
  const { TRACKS } = await import('../src/js/platform/music.js');
  const song = compile(TRACKS[DEFAULT_TRACK]);
  assert.equal(song.length, 128);
  assert.ok(song.lead.length > 80, 'a full melody');
  assert.ok(song.lead.every(n => n.freq >= 390 && n.freq <= 1100), 'lead between G4 and C6');
  assert.ok(song.bass.every(n => n.freq >= 130 && n.freq <= 400), 'bass in octave 3');
});
test('every stage plays its own variation of the march, within speaker-friendly ranges', async () => {
  const { TRACKS } = await import('../src/js/platform/music.js');
  const { LEVELS } = await import('../src/js/game/levels.js');
  const ids = LEVELS.map(l => l.music ?? DEFAULT_TRACK);
  assert.equal(new Set(ids).size, LEVELS.length, 'one track per stage');
  for (const id of ids) {
    assert.ok(TRACKS[id], `pista ${id}`);
    const song = compile(TRACKS[id]);
    assert.ok(song.length >= 128 && song.lead.length > 80, id);
    assert.ok(song.lead.every(n => n.freq >= 300 && n.freq <= 1400), `${id}: melodía en rango`);
    assert.ok(song.bass.every(n => n.freq >= 100 && n.freq <= 540), `${id}: bajo en rango`);
    assert.ok(song.stepSeconds > 0.19 && song.stepSeconds < 0.28, `${id}: tempo jugable`);
  }
});
test('variations really change the music: key, mode, groove and phrase order', async () => {
  const { TRACKS } = await import('../src/js/platform/music.js');
  const base = compile(TRACKS[DEFAULT_TRACK]);
  const minor = compile(TRACKS['acero']), floaty = compile(TRACKS['paracaidas']), long = compile(TRACKS['escalera']);
  assert.ok(Math.abs(base.lead[1].freq - 659.26) < 0.01 && Math.abs(minor.lead[1].freq - 659.26 * 2 ** (-3 / 12)) < 0.01,
    'E5 becomes E♭5, then down a tone in Acero');
  assert.ok(Math.abs(floaty.lead[0].freq / base.lead[0].freq - 2 ** (5 / 12)) < 1e-9, 'Paracaídas sounds a fourth higher');
  assert.ok(floaty.drums.length < base.drums.length && floaty.duty === 0.125, 'a lighter groove and a thinner pulse');
  assert.equal(long.length, 256, 'AABB doubles the loop');
  assert.throws(() => compile({ ...TRACKS[DEFAULT_TRACK], drums: 'polka' }), /Variación desconocida/);
});
