import { describe, it, expect } from "vitest";
import { yawNorm, pitchNorm, neckAngle, FACE_IDX, type Pt } from "./geometry";

// Build a landmark array with just the indices our geometry reads.
function face(over: Partial<Record<keyof typeof FACE_IDX, Pt>> = {}): Pt[] {
  const base: Record<keyof typeof FACE_IDX, Pt> = {
    noseTip: { x: 0.5, y: 0.5 },
    leftEyeOuter: { x: 0.4, y: 0.42 },
    rightEyeOuter: { x: 0.6, y: 0.42 },
    leftCheek: { x: 0.35, y: 0.5 },
    rightCheek: { x: 0.65, y: 0.5 },
    chin: { x: 0.5, y: 0.7 },
    ...over,
  };
  const arr: Pt[] = [];
  for (const [key, idx] of Object.entries(FACE_IDX)) {
    arr[idx] = base[key as keyof typeof FACE_IDX];
  }
  return arr;
}

describe("yawNorm", () => {
  it("is ~0 when the nose is centered between the cheeks", () => {
    expect(Math.abs(yawNorm(face()))).toBeLessThan(0.05);
  });

  it("goes strongly positive when the nose shifts toward one cheek", () => {
    // Head turned: nose near the right cheek.
    const y = yawNorm(face({ noseTip: { x: 0.62, y: 0.5 } }));
    expect(y).toBeGreaterThan(0.35);
  });

  it("is symmetric for left vs right turns", () => {
    const right = yawNorm(face({ noseTip: { x: 0.62, y: 0.5 } }));
    const left = yawNorm(face({ noseTip: { x: 0.38, y: 0.5 } }));
    expect(right).toBeCloseTo(-left, 5);
  });
});

describe("pitchNorm", () => {
  it("increases when the head tilts down (nose drops toward the chin)", () => {
    const level = pitchNorm(face());
    const down = pitchNorm(face({ noseTip: { x: 0.5, y: 0.62 } }));
    expect(down).toBeGreaterThan(level);
  });

  it("stays within the eye→chin span for plausible poses", () => {
    const p = pitchNorm(face());
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });
});

describe("neckAngle", () => {
  it("is near 0 when the head sits directly above the shoulders", () => {
    const angle = neckAngle(
      { x: 0.4, y: 0.8 },
      { x: 0.6, y: 0.8 },
      { x: 0.4, y: 0.4 },
      { x: 0.6, y: 0.4 },
    );
    expect(angle).toBeLessThan(5);
  });

  it("grows as the head leans forward of the shoulders", () => {
    const angle = neckAngle(
      { x: 0.4, y: 0.8 },
      { x: 0.6, y: 0.8 },
      { x: 0.7, y: 0.5 },
      { x: 0.9, y: 0.5 },
    );
    expect(angle).toBeGreaterThan(20);
  });
});
