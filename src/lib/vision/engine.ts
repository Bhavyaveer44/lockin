import {
  FilesetResolver,
  FaceLandmarker,
  PoseLandmarker,
  ObjectDetector,
  type FaceLandmarkerResult,
  type PoseLandmarkerResult,
  type ObjectDetectorResult,
} from "@mediapipe/tasks-vision";
import type { VisionMetrics } from "@/lib/types";
import { yawNorm, pitchNorm, neckAngle } from "./geometry";

// Hosted model + wasm assets. Loaded at runtime so nothing is bundled and the
// app stays light. All inference happens in this browser tab.
const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const MODELS = {
  face: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  pose: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  object:
    "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",
};

// MediaPipe pose landmark indices we care about.
const POSE = { leftShoulder: 11, rightShoulder: 12, leftEar: 7, rightEar: 8 };

export class VisionEngine {
  private face: FaceLandmarker | null = null;
  private pose: PoseLandmarker | null = null;
  private object: ObjectDetector | null = null;

  async load(): Promise<void> {
    const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
    [this.face, this.pose, this.object] = await Promise.all([
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODELS.face, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
      }),
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODELS.pose, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      }),
      ObjectDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODELS.object, delegate: "GPU" },
        runningMode: "VIDEO",
        scoreThreshold: 0.25,
        categoryAllowlist: ["cell phone"],
      }),
    ]);
  }

  get ready(): boolean {
    return !!(this.face && this.pose && this.object);
  }

  // Run all three models on the current video frame and fold their outputs
  // into a single VisionMetrics. `ts` must be monotonically increasing (ms).
  detect(video: HTMLVideoElement, ts: number): VisionMetrics {
    const faceRes = this.face!.detectForVideo(video, ts);
    const poseRes = this.pose!.detectForVideo(video, ts);
    const objRes = this.object!.detectForVideo(video, ts);

    const lm = faceRes.faceLandmarks?.[0];
    return {
      facePresent: !!lm,
      gazeYawNorm: lm ? yawNorm(lm) : 0,
      gazePitchNorm: lm ? pitchNorm(lm) : 0,
      eyeOpenness: eyeOpennessFrom(faceRes),
      neckAngleDeg: neckFrom(poseRes),
      phonePresent: phoneFrom(objRes),
      ts,
    };
  }

  close(): void {
    this.face?.close();
    this.pose?.close();
    this.object?.close();
    this.face = this.pose = this.object = null;
  }
}

function eyeOpennessFrom(r: FaceLandmarkerResult): number {
  const cats = r.faceBlendshapes?.[0]?.categories;
  if (!cats) return 1;
  const blink = (name: string) =>
    cats.find((c) => c.categoryName === name)?.score ?? 0;
  const avgBlink = (blink("eyeBlinkLeft") + blink("eyeBlinkRight")) / 2;
  return Math.max(0, Math.min(1, 1 - avgBlink));
}

function neckFrom(r: PoseLandmarkerResult): number {
  const lm = r.landmarks?.[0];
  if (!lm) return 0;
  return neckAngle(
    lm[POSE.leftShoulder],
    lm[POSE.rightShoulder],
    lm[POSE.leftEar],
    lm[POSE.rightEar],
  );
}

function phoneFrom(r: ObjectDetectorResult): boolean {
  return (r.detections?.length ?? 0) > 0;
}
