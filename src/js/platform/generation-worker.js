import { generateStage } from '../game/stage/generate.js';

self.onmessage = ({ data: { seed, difficulty } }) => {
  try { self.postMessage({ level: generateStage(seed, difficulty) }); }
  catch (error) { self.postMessage({ error: error.message }); }
};
