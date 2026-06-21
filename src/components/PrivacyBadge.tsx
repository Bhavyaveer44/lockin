"use client";

import { useEffect, useState } from "react";
import {
  subscribePrivacy,
  type PrivacyStat,
} from "@/lib/privacy/monitor";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Live, measured proof of the privacy invariant: shows that 0 bytes of
 * image/video ever leave the page, while only tiny JSON label batches are sent.
 * `framesAnalyzed` is the number of frames processed entirely on-device.
 */
export function PrivacyBadge({ framesAnalyzed }: { framesAnalyzed: number }) {
  const [stat, setStat] = useState<PrivacyStat | null>(null);

  useEffect(() => subscribePrivacy(setStat), []);

  const mediaClean = !stat || stat.mediaBytes === 0;

  return (
    <div className="w-full rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>🔒</span>
        <span>Privacy meter</span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-mono ${
            mediaClean
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-rose-500/15 text-rose-300"
          }`}
        >
          {mediaClean ? "verified" : "leak!"}
        </span>
      </div>

      <dl className="mt-3 space-y-2 text-xs">
        <Row
          label="Video / image uploaded"
          value={fmtBytes(stat?.mediaBytes ?? 0)}
          good={mediaClean}
        />
        <Row
          label="Frames analyzed on-device"
          value={framesAnalyzed.toLocaleString()}
        />
        <Row
          label="Labels sent"
          value={`${fmtBytes(stat?.labelBytes ?? 0)} · ${
            stat?.labelRequests ?? 0
          } req`}
        />
      </dl>

      <p className="mt-3 text-[10px] leading-relaxed text-neutral-500">
        Measured from every outbound request this page makes. Your camera frames
        are processed here and discarded — only enum labels are persisted.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-neutral-400">{label}</dt>
      <dd
        className={`font-mono ${
          good === undefined
            ? "text-neutral-200"
            : good
              ? "text-emerald-300"
              : "text-rose-300"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
