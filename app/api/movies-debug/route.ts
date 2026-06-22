import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function fetchYTS(page = 1) {
  try {
    const res = await fetch(
      `https://yts.mx/api/v2/list_movies.json?sort_by=date_added&limit=50&page=${page}`,
      { cache: "no-store" }
    );
    const text = await res.text();
    const data = JSON.parse(text);
    const movies = data.data?.movies ?? [];
    return { status: res.status, count: movies.length, movies: movies.slice(0, 5).map((m: any) => ({ title: m.title, year: m.year })), raw_preview: text.slice(0, 200) };
  } catch (e) { return { error: String(e) }; }
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
  const [yts1, tmdb] = await Promise.all([fetchYTS(1), fetchTMDB()]);
  return NextResponse.json({ yts: yts1, tmdb_upcoming: tmdb });
}
