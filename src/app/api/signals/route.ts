import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { signalEvents } from "@/lib/db/schema";
import { WORK_STATES } from "@/lib/types";

export const runtime = "nodejs";

// We only ever accept derived labels + timestamps here — never image data.
const bodySchema = z.object({
  sessionId: z.string().uuid(),
  events: z
    .array(
      z.object({
        state: z.enum(WORK_STATES),
        startedAt: z.string().datetime(),
        durationSec: z.number().int().positive().max(86400),
      }),
    )
    .min(1)
    .max(500),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { sessionId, events } = parsed.data;
  await getDb()
    .insert(signalEvents)
    .values(
      events.map((e) => ({
        sessionId,
        userId,
        state: e.state,
        startedAt: new Date(e.startedAt),
        durationSec: e.durationSec,
      })),
    );

  return NextResponse.json({ ok: true, inserted: events.length });
}
