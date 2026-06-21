"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VisionMetrics, WorkState } from "@/lib/types";
import {
  initialClassifierState,
  step,
  type ClassifierState,
} from "@/lib/state/classifier";
import type { CalibrationProfile } from "@/lib/state/calibration";
import { VisionEngine } from "./engine";

export type EngineStatus = "idle" | "loading" | "running" | "error";

// Sample roughly every 1.5s. Vision models are heavy; we don't need video
// framerate to infer a work state, and slower sampling keeps the laptop cool.
const SAMPLE_INTERVAL_MS = 1500;

export interface VisionSignals {
  status: EngineStatus;
  error: string | null;
  state: WorkState;
  metrics: VisionMetrics | null;
  start: () => void;
  stop: () => void;
}

/**
 * Drives the on-device vision pipeline for a given <video> element.
 * Everything here runs in the browser; no frame ever leaves the device.
 * `onState` fires whenever the committed WorkState changes.
 */
export function useVisionSignals(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onState?: (state: WorkState, ts: number) => void,
  profile?: CalibrationProfile | null,
): VisionSignals {
  const [status, setStatus] = useState<EngineStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<WorkState>("focused");
  const [metrics, setMetrics] = useState<VisionMetrics | null>(null);

  const engineRef = useRef<VisionEngine | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const classRef = useRef<ClassifierState>(initialClassifierState());
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    engineRef.current?.close();
    engineRef.current = null;
    setStatus("idle");
  }, []);

  const start = useCallback(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);
    classRef.current = initialClassifierState();

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        const engine = new VisionEngine();
        await engine.load();
        if (cancelled) {
          engine.close();
          return;
        }
        engineRef.current = engine;
        setStatus("running");

        timerRef.current = setInterval(() => {
          const v = videoRef.current;
          const e = engineRef.current;
          if (!v || !e || v.readyState < 2) return;
          try {
            const m = e.detect(v, performance.now());
            setMetrics(m);
            const r = step(classRef.current, m, profileRef.current);
            classRef.current = r.state;
            setState((prev) => {
              if (prev !== r.committed) {
                onStateRef.current?.(r.committed, Date.now());
              }
              return r.committed;
            });
          } catch {
            // Drop a bad frame rather than tearing down the session.
          }
        }, SAMPLE_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to start the camera",
        );
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [videoRef]);

  // Always release the camera on unmount.
  useEffect(() => stop, [stop]);

  return { status, error, state, metrics, start, stop };
}
