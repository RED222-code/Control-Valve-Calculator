/** Validate calculator arguments without coercing empty strings or booleans. */
export function requireFiniteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
}

export function validateBaseInputs(Q, SG, P1, P2, gravityLabel = 'Specific gravity') {
  requireFiniteNumber(Q, 'Flow rate');
  requireFiniteNumber(SG, gravityLabel);
  requireFiniteNumber(P1, 'Upstream pressure');
  requireFiniteNumber(P2, 'Downstream pressure');

  if (Q < 0) throw new Error('Flow rate cannot be negative.');
  if (SG <= 0) throw new Error(`${gravityLabel} must be greater than zero.`);

  const deltaP = P1 - P2;
  if (!Number.isFinite(deltaP)) {
    throw new Error('Pressure drop is outside the supported numerical range.');
  }
  if (deltaP <= 0) {
    throw new Error('Upstream pressure must be greater than downstream pressure.');
  }

  return deltaP;
}

/**
 * Keep the ordinary formula's precision, with a log-space fallback when an
 * intermediate product/ratio exceeds Number's range. A result that itself
 * cannot be represented is an error; positive flow must never silently yield 0.
 */
export function evaluateCv(Q, SG, deltaP, Y = 1, Z = 1) {
  if (Q === 0) return 0;

  const minimumNormal = 2 ** -1022;
  const firstProduct = deltaP * Y;
  const denominator = firstProduct * Z;
  const ratio = SG / denominator;
  const direct = Q * Math.sqrt(ratio);
  // Subnormal intermediates may be nonzero but still lose most significant
  // digits. Check each multiplication, even if a later factor rescales it.
  const hasSubnormalIntermediate = [firstProduct, denominator, ratio]
    .some((value) => value > 0 && value < minimumNormal);
  if (Number.isFinite(direct) && direct > 0 && !hasSubnormalIntermediate) return direct;

  const logarithm = Math.log(Q)
    + 0.5 * (Math.log(SG) - Math.log(deltaP) - Math.log(Y) - Math.log(Z));
  const cv = Math.exp(logarithm);

  if (!Number.isFinite(cv) || cv === 0) {
    throw new Error('Calculated Cv is outside the supported numerical range. Check the input magnitudes.');
  }

  return cv;
}
