import { evaluateCv, requireFiniteNumber, validateBaseInputs } from './shared.js';

/**
 * Requested simplified gas equation: Cv = Q √(SG / (ΔP Y Z)).
 * Q is supplied in SCFM; pressures are psi using the same reference.
 * Temperature is recorded by the UI but is not an input to this equation.
 * This method does not implement IEC/ISA industrial gas valve sizing.
 */
export function calculateGasCv(Q, SG, P1, P2, Y, Z) {
  const deltaP = validateBaseInputs(Q, SG, P1, P2, 'Gas specific gravity');
  requireFiniteNumber(Y, 'Expansion factor Y');
  requireFiniteNumber(Z, 'Compressibility factor Z');
  if (Y <= 0) throw new Error('Expansion factor Y must be greater than zero.');
  if (Z <= 0) throw new Error('Compressibility factor Z must be greater than zero.');

  const cv = evaluateCv(Q, SG, deltaP, Y, Z);
  return { deltaP, cv };
}
