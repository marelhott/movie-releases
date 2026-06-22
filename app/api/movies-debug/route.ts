import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function tryYTS(host: string) {
  try {
    const res = await fetch(
      `https://${host}/api/v2/list_movies.json?sort_by=date_added&limit=5&page=1`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    const count = data.data?.movies?.length ?? 0;
    return { ok: true, status: res.status, count, sample: data.data?.movies?.slice(0, 2).map((m: any) => ({ title: m.title, year: m.year })) };
  } catch (e) { return { ok: false, error: String(e) }; }
}

async function fetchTMDB() {
  const key = process.env.TMDB_API_KEY;
  if (!key) return { error: "no TMDB key" };
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/upcoming?api_key=${key}&language=cs&region=CZ&page=1`, { cache: "no-store" });
    const d = await res.json();
    return (d.results ?? []).slice(0, 5).map((m: any) => ({ title: m.title, date: m.release_date }));
  } catch (e) { return { error: String(e) }; }
}

export async function GET() {
  const hosts = ["yts.mx", "yts.torrentbay.to", "yts.pm", "yts1.tv", "ww4.yts.nz"];
  const [results, tmdb] = await Promise.all([
    Promise.all(hosts.map(h => tryYTS(h).then(r => ({ host: h, ...r })))),
    fetchTMDB(),
  ]);
  return NextResponse.json({ yts_mirrors: results, tmdb_upcoming: tmdb });
}
