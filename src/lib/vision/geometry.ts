// Pure geometry helpers that turn MediaPipe outputs into the scalar metrics our
// classifier consumes. Kept free of any MediaPipe imports so they're testable.

const RAD2DEG = 180 / Math.PI;

/**
 * Extract yaw (left/right) and pitch (up/down) in degrees from a face
 * 4x4 column-major transformation matrix (FaceLandmarker facial transform).
 * Returns degrees relative to facing the camera straight on.
 */
export function headPoseFromMatrix(m: number[]): {
  yawDeg: number;
  pitchDeg: number;
} {
  // Column-major 4x4. Rotation part:
  // r00 r01 r02
  // r10 r11 r12
  // r20 r21 r22
  // Column-major: r_ij = m[col*4 + row].
  const r11 = m[5]; // row1 col1
  const r12 = m[9]; // row1 col2
  const r02 = m[8]; // row0 col2
  const r22 = m[10]; // row2 col2

  // Yaw (turn left/right, about the vertical Y axis) and pitch (nod up/down).
  // Extracted independently — coarse but ample for our angle thresholds.
  const yaw = Math.atan2(r02, r22);
  const pitch = Math.atan2(-r12, r11);
  return { yawDeg: yaw * RAD2DEG, pitchDeg: pitch * RAD2DEG };
}

interface Pt {
  x: number;
  y: number;
}

/**
 * Neck flexion angle in degrees from pose landmarks. We measure how far the
 * head leans forward of the shoulders: the angle between vertical and the line
 * from shoulder-midpoint to ear-midpoint. ~0 = upright, larger = slouched.
 */
export function neckAngle(
  leftShoulder: Pt,
  rightShoulder: Pt,
  leftEar: Pt,
  rightEar: Pt,
): number {
  const shoulder = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  const ear = {
    x: (leftEar.x + rightEar.x) / 2,
    y: (leftEar.y + rightEar.y) / 2,
  };
  // Vector shoulder -> ear (image coords: y grows downward, so ear is above).
  const dx = ear.x - shoulder.x;
  const dy = ear.y - shoulder.y;
  // Angle from the vertical axis.
  const angleFromVertical = Math.atan2(Math.abs(dx), Math.abs(dy)) * RAD2DEG;
  return angleFromVertical;
}
