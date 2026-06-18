"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { WorkState } from "@/lib/types";
import { STATE_META } from "@/components/Hud";

interface DebriefResponse {
  empty: boolean;
  aggregate: {
    byState: Record<WorkState, number>;
    focusScore: number;
    topDistraction: WorkState | null;
  };
  debrief?: { headline: string; narrative: string; topFix: string };
}

export default function TodayPage() {
  const [data, setData] = useState<DebriefResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/debrief")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setError("Couldn't load your debrief."));
  }, []);

  if (error)
    return <Centered>{<p className="text-rose-400">{error}</p>}</Centered>;
  if (!data)
    return (
      <Centered>
        <p className="text-neutral-500">generating your debrief…</p>
      </Centered>
    );
  if (data.empty)
    return (
      <Centered>
        <p className="text-neutral-400">
          No focus tracked today yet.{" "}
          <Link href="/session" className="text-emerald-400 underline">
            Start a session →
          </Link>
        </p>
      </Centered>
    );

  const { aggregate, debrief } = data;
  const totals = Object.entries(aggregate.byState) as [WorkState, number][];
  const grand = totals.reduce((a, [, v]) => a + v, 0) || 1;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="flex items-center gap-6">
        <ScoreRing score={aggregate.focusScore} />
        <div>
          <h1 className="text-2xl font-bold">{debrief?.headline}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Focus score {aggregate.focusScore}/100
            {aggregate.topDistraction
              ? ` · biggest leak: ${aggregate.topDistraction}`
              : ""}
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-2">
        {totals
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([state, sec]) => (
            <div key={state} className="flex items-center gap-3">
              <span className={`w-24 font-mono text-sm ${STATE_META[state].color}`}>
                {state}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
                <div
                  className={`h-full ${STATE_META[state].bar}`}
                  style={{ width: `${(sec / grand) * 100}%` }}
                />
              </div>
              <span className="w-12 text-right font-mono text-xs text-neutral-500">
                {Math.round(sec / 60)}m
              </span>
            </div>
          ))}
      </div>

      <div className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
        <p className="leading-relaxed text-neutral-200">{debrief?.narrative}</p>
        <div className="mt-5 rounded-xl bg-emerald-500/10 p-4">
          <p className="text-xs font-mono uppercase tracking-widest text-emerald-400">
            Try tomorrow
          </p>
          <p className="mt-1 text-emerald-100">{debrief?.topFix}</p>
        </div>
      </div>

      <Link
        href="/session"
        className="mt-8 inline-block text-sm text-emerald-400 underline"
      >
        ← Back to a session
      </Link>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-20 text-center">
      {children}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const hue = score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-rose-400";
  return (
    <div
      className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-current ${hue}`}
    >
      <span className="text-xl font-bold">{score}</span>
    </div>
  );
}
