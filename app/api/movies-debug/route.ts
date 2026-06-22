import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function fetchYTS(page = 1) {
  try {
    const res = await fetch(
      `https://yts.mx/api/v2/list_movies.json?sort_by=date_added&limit=50&page=${page}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return (data.data?.movies ?? []).map((m: any) => ({ title: m.title, year: m.year, imdb: m.imdb_code, cover: m.medium_cover_image }));
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
  const movies = Array.isArray(yts1) ? yts1 : [];
  const recentYear = new Date().getFullYear() - 2;
  const recent = movies.filter((m: any) => (m.year ?? 0) >= recentYear);
  return NextResponse.json({
    yts_total: movies.length,
    yts_recent_count: recent.length,
    yts_years: movies.slice(0, 20).map((m: any) => m.year),
    yts_recent_sample: recent.slice(0, 5),
    tmdb_upcoming: tmdb,
    recent_year_cutoff: recentYear,
  });
}
