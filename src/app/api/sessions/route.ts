import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

export const runtime = "nodejs";

// Start a new focus session.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const [row] = await getDb()
    .insert(sessions)
    .values({ userId })
    .returning({ id: sessions.id });

  return NextResponse.json({ sessionId: row.id });
}

// End a session (marks endedAt).
export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const { sessionId } = (await req.json()) as { sessionId?: string };
  if (!sessionId)
    return NextResponse.json({ error: "missing sessionId" }, { status: 400 });

  await getDb()
    .update(sessions)
    .set({ endedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

  return NextResponse.json({ ok: true });
}
