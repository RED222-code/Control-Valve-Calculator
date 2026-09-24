import { evaluateCv, validateBaseInputs } from './shared.js';

/** Q in gpm; P1 and P2 in psi using the same pressure reference; SG > 0. */
export function calculateLiquidCv(Q, SG, P1, P2) {
  const deltaP = validateBaseInputs(Q, SG, P1, P2);
  const cv = evaluateCv(Q, SG, deltaP);
  return { deltaP, cv };
}
