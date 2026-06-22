import { after } from "next/server";
import { NextResponse } from "next/server";
import { getNewsPage, warmNewsCaches } from "@/lib/newsService";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") ?? "30", 10) || 30);
  const forceRefresh = searchParams.has("refresh");

  const data = await getNewsPage(page, pageSize, forceRefresh);

  if (!forceRefresh && page === 1) {
    after(async () => {
      try {
        await warmNewsCaches();
      } catch {}
    });
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": forceRefresh
        ? "no-store, max-age=0"
        : "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
