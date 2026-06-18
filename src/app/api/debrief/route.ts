import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { signalEvents } from "@/lib/db/schema";
import { aggregateDay } from "@/lib/debrief/aggregate";
import { generateDebrief } from "@/lib/debrief/generate";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const rows = await getDb()
    .select({
      state: signalEvents.state,
      startedAt: signalEvents.startedAt,
      durationSec: signalEvents.durationSec,
    })
    .from(signalEvents)
    .where(
      and(
        eq(signalEvents.userId, userId),
        gte(signalEvents.startedAt, startOfDay),
      ),
    );

  const agg = aggregateDay(
    rows.map((r) => ({
      state: r.state as Parameters<typeof aggregateDay>[0][number]["state"],
      startedAt: r.startedAt,
      durationSec: r.durationSec,
    })),
  );

  if (agg.totalSec === 0) {
    return NextResponse.json({ empty: true, aggregate: agg });
  }

  const debrief = await generateDebrief(agg);
  return NextResponse.json({ empty: false, aggregate: agg, debrief });
}
