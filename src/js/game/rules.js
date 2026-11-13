/** Physical constants shared by World and the skills. Units: world px and seconds. */
export const RULES = Object.freeze({
  walkSpeed: 19, gravity: 190, maxFallSpeed: 95, safeFall: 125,
  stepUp: 4, stepDown: 3, wallProbe: 3, exitTolerance: 3, outOfWorld: 12,
  firstSpawn: 0.8, maxEvents: 512, blockReach: 6, blockHeight: 10, blastLife: 0.6,
});
