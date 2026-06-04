import { NextResponse } from "next/server";
import { fetchScnsrc } from "@/lib/scnsrc";

const TMDB_KEY = process.env.TMDB_API_KEY;
const OMDB_KEY = process.env.OMDB_API_KEY;

// ── Source fetchers ──────────────────────────────────────────────────────────

async function fetchYTS(page = 1) {
  try {
    const res = await fetch(
      `https://yts.mx/api/v2/list_movies.json?sort_by=date_added&limit=50&page=${page}&minimum_rating=0`,
      { next: { revalidate: 1800 } }
    );
    const data = await res.json();
    return (data.data?.movies ?? []).map((m: any) => ({
      _source: "yts",
      _imdb: m.imdb_code,
      _title: m.title,
      _year: m.year,
      _raw: m,
    }));
  } catch { return []; }
}

async function fetchTMDBSection(endpoint: string) {
  if (!TMDB_KEY) return [];
  try {
    const pages = await Promise.all([1, 2].map(p =>
      fetch(`https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_KEY}&language=cs&region=CZ&page=${p}`,
        { next: { revalidate: 3600 } }
      ).then(r => r.json())
    ));
    return pages.flatMap((d: any) => d.results ?? []).map((m: any) => ({
      _source: "tmdb",
      _imdb: m.imdb_id ?? null,
      _tmdb_id: m.id,
      _title: m.original_title ?? m.title,
      _year: m.release_date ? parseInt(m.release_date) : 0,
      _raw: m,
    }));
  } catch { return []; }
}

async function fetchLetterboxdRSS() {
  try {
    const res = await fetch("https://letterboxd.com/films/ajax/new/?esiAllowFilters=1", {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const items: any[] = [];
    const re = /data-film-name="([^"]+)"[^>]*data-film-year="([^"]+)"[^>]*data-film-id="([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      items.push({ _source: "letterboxd", _imdb: null, _title: m[1], _year: parseInt(m[2]), _tmdb_id: null, _raw: { title: m[1], release_date: m[2] } });
      if (items.length >= 20) break;
    }
    return items;
  } catch { return []; }
}

// ── TMDB detail enrichment ───────────────────────────────────────────────────

async function getTMDBDetail(tmdbId: number): Promise<any> {
  if (!TMDB_KEY || !tmdbId) return null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_KEY}&language=cs&append_to_response=credits,external_ids`,
      { next: { revalidate: 86400 } }
    );
    return res.json();
  } catch { return null; }
}

async function findTMDBByIMDB(imdbId: string): Promise<any> {
  if (!TMDB_KEY || !imdbId?.startsWith("tt")) return null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id`,
      { next: { revalidate: 86400 } }
    );
    const data = await res.json();
    const hit = data.movie_results?.[0];
    if (!hit) return null;
    return getTMDBDetail(hit.id);
  } catch { return null; }
}

async function searchTMDB(title: string, year: number): Promise<any> {
  if (!TMDB_KEY) return null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&year=${year}&language=cs`,
      { next: { revalidate: 86400 } }
    );
    const data = await res.json();
    const hit = data.results?.[0];
    if (!hit) return null;
    return getTMDBDetail(hit.id);
  } catch { return null; }
}

async function fetchOMDB(imdbId: string) {
  if (!OMDB_KEY || !imdbId) return null;
  try {
    const res = await fetch(
      `https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_KEY}`,
      { next: { revalidate: 86400 } }
    );
    return res.json();
  } catch { return null; }
}

// ── Normalise any raw source entry into a unified Movie ──────────────────────

async function normalise(entry: any): Promise<any | null> {
  try {
    let tmdb: any = null;
    let ytsRaw: any = null;
    let imdbCode: string = entry._imdb ?? "";

    if (entry._source === "yts") {
      ytsRaw = entry._raw;
      tmdb = await (imdbCode ? findTMDBByIMDB(imdbCode) : searchTMDB(entry._title, entry._year));
    } else if (entry._source === "tmdb") {
      const raw = entry._raw;
      const tmdbId = entry._tmdb_id ?? raw.id;
      tmdb = await getTMDBDetail(tmdbId);
      imdbCode = tmdb?.external_ids?.imdb_id ?? entry._imdb ?? "";
    } else {
      // letterboxd / scnsrc — search TMDB
      tmdb = await searchTMDB(entry._title, entry._year);
      imdbCode = tmdb?.external_ids?.imdb_id ?? "";
    }

    const omdb = imdbCode ? await fetchOMDB(imdbCode) : null;

    const poster = tmdb?.poster_path
      ? `https://image.tmdb.org/t/p/w500${tmdb.poster_path}`
      : ytsRaw?.large_cover_image ?? ytsRaw?.medium_cover_image ?? null;

    const backdrop = tmdb?.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${tmdb.backdrop_path}`
      : null;

    const overview = tmdb?.overview?.length > 10 ? tmdb.overview : null;

    const ytsRating = ytsRaw?.rating ?? 0;
    const imdbRating = ytsRating > 0 ? ytsRating : parseFloat(omdb?.imdbRating ?? "0") || null;

    return {
      id: tmdb?.id ?? Math.random(),
      imdb_code: imdbCode,
      title: ytsRaw?.title ?? entry._raw?.original_title ?? entry._raw?.title ?? entry._title,
      czech_title: (tmdb?.title && tmdb.title !== (ytsRaw?.title ?? entry._title)) ? tmdb.title : null,
      year: ytsRaw?.year ?? entry._year ?? (tmdb?.release_date ? parseInt(tmdb.release_date) : 0),
      runtime: tmdb?.runtime ?? ytsRaw?.runtime ?? 0,
      genres: tmdb?.genres?.map((g: any) => g.name) ?? ytsRaw?.genres ?? [],
      overview,
      poster,
      backdrop,
      ratings: {
        imdb: imdbRating,
        tmdb: tmdb?.vote_average ? Math.round(tmdb.vote_average * 10) / 10 : null,
        rt: omdb?.Ratings?.find((r: any) => r.Source === "Rotten Tomatoes")?.Value ?? null,
        metacritic: omdb?.Ratings?.find((r: any) => r.Source === "Metacritic")?.Value ?? null,
      },
      cast: tmdb?.credits?.cast?.slice(0, 5).map((c: any) => c.name) ?? [],
      director: tmdb?.credits?.crew?.find((c: any) => c.job === "Director")?.name ?? null,
      date_added: ytsRaw?.date_uploaded ?? tmdb?.release_date ?? new Date().toISOString(),
      sources: [entry._source],
      torrents: ytsRaw?.torrents?.map((t: any) => ({
        quality: t.quality,
        type: t.type,
        size: t.size,
        seeds: t.seeds,
      })) ?? [],
    };
  } catch { return null; }
}

// ── Deduplication by IMDB id → title+year fallback ──────────────────────────

function deduplicate(entries: any[]): any[] {
  const byImdb = new Map<string, any>();
  const byTitleYear = new Map<string, any>();
  const result: any[] = [];

  for (const e of entries) {
    if (!e) continue;
    const key = e.imdb_code?.startsWith("tt") ? e.imdb_code : null;
    const titleKey = `${e.title?.toLowerCase().replace(/[^a-z0-9]/g, "")}:${e.year}`;

    if (key && byImdb.has(key)) {
      // Merge sources + torrents
      const existing = byImdb.get(key)!;
      existing.sources = [...new Set([...existing.sources, ...e.sources])];
      if (e.torrents?.length) existing.torrents = [...existing.torrents, ...e.torrents];
      continue;
    }
    if (!key && byTitleYear.has(titleKey)) continue;

    if (key) byImdb.set(key, e);
    byTitleYear.set(titleKey, e);
    result.push(e);
  }
  return result;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");

  // Fetch all sources in parallel
  const [yts, nowPlaying, upcoming, popular, trending, scnsrcRaw, letterboxd] =
    await Promise.all([
      fetchYTS(page),
      page === 1 ? fetchTMDBSection("movie/now_playing") : Promise.resolve([]),
      page === 1 ? fetchTMDBSection("movie/upcoming") : Promise.resolve([]),
      fetchTMDBSection(`movie/popular`),
      page === 1 ? fetchTMDBSection("trending/movie/week") : Promise.resolve([]),
      page === 1 ? fetchScnsrc() : Promise.resolve([]),
      page === 1 ? fetchLetterboxdRSS() : Promise.resolve([]),
    ]);

  // Convert scnsrc to unified format
  const scnsrc = scnsrcRaw.map((s: any) => ({
    _source: "scnsrc",
    _imdb: null,
    _title: s.title,
    _year: new Date(s.date).getFullYear() || new Date().getFullYear(),
    _raw: s,
  }));

  // Sort YTS first (has torrent data), then TMDB sections, then others
  const all = [...yts, ...nowPlaying, ...upcoming, ...popular, ...trending, ...scnsrc, ...letterboxd];

  // Normalise in batches of 10 to avoid hammering APIs
  const BATCH = 10;
  const normalised: any[] = [];
  for (let i = 0; i < all.length; i += BATCH) {
    const batch = await Promise.all(all.slice(i, i + BATCH).map(normalise));
    normalised.push(...batch.filter(Boolean));
    if (normalised.length >= 50) break;
  }

  const movies = deduplicate(normalised)
    .filter(m => m.poster) // skip entries with no poster
    .slice(0, 50);

  return NextResponse.json({ movies, page });
}
