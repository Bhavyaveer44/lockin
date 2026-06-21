"use client";

import { useEffect, useRef, useState } from "react";
import { VisionEngine } from "@/lib/vision/engine";
import {
  averagePose,
  computeProfile,
  saveProfile,
  type CalibrationProfile,
  type PoseSample,
} from "@/lib/state/calibration";

// The three poses we measure, in order.
const POSES = [
  {
    key: "screen",
    emoji: "🖥️",
    title: "Look at your screen",
    hint: "Sit exactly how you normally work.",
  },
  {
    key: "phone",
    emoji: "📱",
    title: "Look down at your phone",
    hint: "Hold and glance at your phone as you usually would.",
  },
  {
    key: "closed",
    emoji: "😌",
    title: "Close your eyes",
    hint: "Gently shut them until it advances.",
  },
] as const;

type PoseKey = (typeof POSES)[number]["key"];
type Raw = { gazeYawNorm: number; gazePitchNorm: number; eyeOpenness: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Calibration({
  onDone,
  onCancel,
}: {
  onDone: (p: CalibrationProfile) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<VisionEngine | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const latestRef = useRef<Raw | null>(null);
  const captureRef = useRef<Raw[] | null>(null); // non-null while sampling a pose
  const cancelledRef = useRef(false);

  const [phase, setPhase] = useState<"loading" | "running" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [poseIdx, setPoseIdx] = useState(0);
  const [count, setCount] = useState<number | null>(null); // countdown digit
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    cancelledRef.current = false;
    let sampleTimer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        if (cancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        const engine = new VisionEngine();
        await engine.load();
        if (cancelledRef.current) {
          engine.close();
          return;
        }
        engineRef.current = engine;

        // Continuous light sampling; buffer only while a pose is being captured.
        sampleTimer = setInterval(() => {
          const v = videoRef.current;
          const e = engineRef.current;
          if (!v || !e || v.readyState < 2) return;
          try {
            const m = e.detect(v, performance.now());
            const raw: Raw = {
              gazeYawNorm: m.gazeYawNorm,
              gazePitchNorm: m.gazePitchNorm,
              eyeOpenness: m.eyeOpenness,
            };
            latestRef.current = raw;
            if (captureRef.current && m.facePresent) captureRef.current.push(raw);
          } catch {
            /* skip a bad frame */
          }
        }, 150);

        setPhase("running");
        await runSequence();
      } catch (err) {
        if (cancelledRef.current) return;
        setError(
          err instanceof Error ? err.message : "Couldn't access the camera",
        );
        setPhase("error");
      }
    })();

    async function runSequence() {
      const results: Partial<Record<PoseKey, PoseSample>> = {};
      for (let i = 0; i < POSES.length; i++) {
        if (cancelledRef.current) return;
        setPoseIdx(i);
        setCapturing(false);
        // 3-2-1 get-ready countdown.
        for (let c = 3; c >= 1; c--) {
          if (cancelledRef.current) return;
          setCount(c);
          await sleep(700);
        }
        setCount(null);
        // ~1.6s capture window.
        captureRef.current = [];
        setCapturing(true);
        await sleep(1600);
        setCapturing(false);
        const buf = captureRef.current ?? [];
        captureRef.current = null;
        results[POSES[i].key] = averagePose(buf);
      }
      if (cancelledRef.current) return;
      const profile = computeProfile({
        screen: results.screen!,
        phone: results.phone!,
        closed: results.closed!,
      });
      saveProfile(profile);
      onDone(profile);
    }

    return () => {
      cancelledRef.current = true;
      if (sampleTimer) clearInterval(sampleTimer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      engineRef.current?.close();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pose = POSES[poseIdx];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-center">
        <h2 className="text-lg font-semibold">Calibrating to you</h2>
        <p className="mt-1 text-sm text-neutral-400">
          A few seconds so Lockin learns your normal pose. Stays on this device.
        </p>

        <div className="relative mx-auto mt-5 aspect-video w-full overflow-hidden rounded-xl border border-neutral-800 bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full -scale-x-100 object-cover"
          />
          {count !== null && (
            <div className="absolute inset-0 flex items-center justify-center text-6xl font-bold text-white/90">
              {count}
            </div>
          )}
          {capturing && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/10">
              <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium text-neutral-950">
                ● capturing — hold still
              </span>
            </div>
          )}
        </div>

        {phase === "loading" && (
          <p className="mt-5 text-sm text-neutral-500">loading vision models…</p>
        )}

        {phase === "error" && (
          <p className="mt-5 text-sm text-rose-400">{error}</p>
        )}

        {phase === "running" && (
          <div className="mt-5">
            <div className="text-3xl">{pose.emoji}</div>
            <p className="mt-1 font-medium">{pose.title}</p>
            <p className="text-sm text-neutral-400">{pose.hint}</p>
            <div className="mt-4 flex justify-center gap-1.5">
              {POSES.map((p, i) => (
                <span
                  key={p.key}
                  className={`h-1.5 w-8 rounded-full ${
                    i < poseIdx
                      ? "bg-emerald-500"
                      : i === poseIdx
                        ? "bg-emerald-500/50"
                        : "bg-neutral-800"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onCancel}
          className="mt-6 text-xs text-neutral-500 underline hover:text-neutral-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
