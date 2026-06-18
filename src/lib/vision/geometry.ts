// Pure geometry helpers that turn MediaPipe landmark outputs into the scalar
// metrics our classifier consumes. Kept free of MediaPipe imports so they're
// unit-testable. We derive gaze from landmark *geometry* rather than the facial
// transformation matrix — the matrix's coordinate convention is unspecified and
// a forward-facing head does not map to identity, which made absolute Euler
// extraction read a large constant yaw. Geometry is baseline-free.

export interface Pt {
  x: number;
  y: number;
}

// FaceLandmarker (478-point) indices we rely on.
export const FACE_IDX = {
  noseTip: 1,
  leftEyeOuter: 33,
  rightEyeOuter: 263,
  leftCheek: 234, // left edge of face
  rightCheek: 454, // right edge of face
  chin: 152,
};

/**
 * Horizontal gaze, normalized to roughly [-1, 1]. ~0 = nose centered between
 * the cheeks (facing the screen); magnitude grows as the head turns left/right.
 * Independent of head size and absolute position.
 */
export function yawNorm(lm: Pt[]): number {
  const nose = lm[FACE_IDX.noseTip];
  const l = lm[FACE_IDX.leftCheek];
  const r = lm[FACE_IDX.rightCheek];
  const faceW = Math.abs(r.x - l.x);
  if (faceW < 1e-6) return 0;
  const mid = (l.x + r.x) / 2;
  // Scale by half-width so a fully-turned head approaches ±1.
  return ((nose.x - mid) / faceW) * 2;
}

/**
 * Vertical-gaze ratio: the nose's position between the eye line (0) and the
 * chin (1). LARGER = head tilted down (nose drops toward the chin), e.g. looking
 * at a phone. Calibration-free and monotonic; the "level" baseline varies by
 * face, so this is surfaced in the debug panel rather than thresholded directly.
 */
export function pitchNorm(lm: Pt[]): number {
  const nose = lm[FACE_IDX.noseTip];
  const eyeY = (lm[FACE_IDX.leftEyeOuter].y + lm[FACE_IDX.rightEyeOuter].y) / 2;
  const chinY = lm[FACE_IDX.chin].y;
  const faceH = Math.abs(chinY - eyeY);
  if (faceH < 1e-6) return 0;
  return (nose.y - eyeY) / faceH;
}

interface NeckPt {
  x: number;
  y: number;
}

/**
 * Neck flexion angle in degrees from pose landmarks: how far the head leans
 * forward of the shoulders. ~0 = upright, larger = slouched.
 */
export function neckAngle(
  leftShoulder: NeckPt,
  rightShoulder: NeckPt,
  leftEar: NeckPt,
  rightEar: NeckPt,
): number {
  const shoulder = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  const ear = {
    x: (leftEar.x + rightEar.x) / 2,
    y: (leftEar.y + rightEar.y) / 2,
  };
  const dx = ear.x - shoulder.x;
  const dy = ear.y - shoulder.y;
  return (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI;
}
