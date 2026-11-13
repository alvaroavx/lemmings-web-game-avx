// Composition root: builds platform adapters and hands them to the app.
import { FIRST_LEVEL } from './game/levels.js';
import { Renderer } from './view/renderer.js';
import { Audio } from './platform/audio.js';
import { FrameLoop } from './platform/loop.js';
import { Surface } from './platform/surface.js';
import { loadSettings } from './platform/storage.js';
import { GameApp } from './app/game-app.js';

const canvas = document.getElementById('world');
const renderer = new Renderer(canvas);
renderer.setLevel(FIRST_LEVEL);
const surface = new Surface(canvas, canvas.parentElement);
let app = null;
const loop = new FrameLoop(elapsed => app.frame(elapsed));
app = new GameApp({
  level: FIRST_LEVEL, canvas, surface, renderer, loop,
  audio: new Audio(), settings: loadSettings(),
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)'),
});
surface.fit();
loop.start();
