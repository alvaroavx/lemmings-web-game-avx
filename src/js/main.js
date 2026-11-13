// Composition root: builds platform adapters and hands them to the app.
import { LEVELS } from './game/levels.js';
import { Renderer } from './view/renderer.js';
import { Audio } from './platform/audio.js';
import { Music } from './platform/music.js';
import { FrameLoop } from './platform/loop.js';
import { Surface } from './platform/surface.js';
import { loadSettings } from './platform/storage.js';
import { GameApp } from './app/game-app.js';

const canvas = document.getElementById('world');
const renderer = new Renderer(canvas);
renderer.setLevel(LEVELS[0]);
const surface = new Surface(canvas, document.getElementById('viewport'));
const audio = new Audio(), music = new Music(audio), settings = loadSettings();
music.setVolume(settings.music);
let app = null;
const loop = new FrameLoop(elapsed => app.frame(elapsed));
app = new GameApp({
  levels: LEVELS, canvas, surface, renderer, loop,
  audio, music, settings,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)'),
});
surface.fit();
loop.start();
