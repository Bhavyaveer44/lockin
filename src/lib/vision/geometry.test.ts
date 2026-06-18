import { describe, it, expect } from "vitest";
import { headPoseFromMatrix, neckAngle } from "./geometry";

describe("headPoseFromMatrix", () => {
  it("returns ~0 yaw/pitch for an identity (facing camera) matrix", () => {
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const { yawDeg, pitchDeg } = headPoseFromMatrix(identity);
    expect(Math.abs(yawDeg)).toBeLessThan(1);
    expect(Math.abs(pitchDeg)).toBeLessThan(1);
  });

  it("detects a yaw rotation about the vertical axis", () => {
    // ~30deg rotation about Y, column-major.
    const a = (30 * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // Ry column-major: [c,0,-s, 0,1,0, s,0,c]
    const m = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
    const { yawDeg } = headPoseFromMatrix(m);
    expect(Math.abs(yawDeg)).toBeGreaterThan(20);
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
      { x: 0.7, y: 0.5 }, // ears pushed forward (right)
      { x: 0.9, y: 0.5 },
    );
    expect(angle).toBeGreaterThan(20);
  });
});
