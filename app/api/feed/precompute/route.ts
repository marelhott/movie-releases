import { NextResponse } from "next/server";
import { warmFeedCaches } from "@/app/api/feed/[category]/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const bearer = request.headers.get("authorization");
  const query = new URL(request.url).searchParams.get("secret");
  return bearer === `Bearer ${secret}` || query === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const counts = await warmFeedCaches();
  return NextResponse.json({ ok: true, ...counts, warmedAt: new Date().toISOString() }, {
    headers: { "Cache-Control": "no-store" },
  });
}
