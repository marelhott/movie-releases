import { NextResponse } from "next/server";
import { fetchSrrdb, fetchPredb, fetchScnsrcScene } from "@/lib/sceneSources";

export const dynamic = "force-dynamic";
const getKeys = () => ({ tmdb: process.env.TMDB_API_KEY, omdb: process.env.OMDB_API_KEY });

// ── Source fetchers ──────────────────────────────────────────────────────────

async function fetchYTS(page = 1) {
  try {
    const res = await fetch(
      `https://yts.mx/api/v2/list_movies.json?sort_by=date_added&limit=50&page=${page}`,
      { next: { revalidate: 1800 } }
    );
    const data = await res.json();
    return (data.data?.movies ?? []).map((m: any) => ({
      _source: "yts", _imdb: m.imdb_code, _title: m.title, _year: m.year, _raw: m,
    }));
  } catch { return []; }
}

async function fetchTMDBSection(endpoint: string) {
  if (!getKeys().tmdb) return [];
  try {
    const pages = await Promise.all([1, 2].map(p =>
      fetch(`https://api.themoviedb.org/3/${endpoint}?api_key=${getKeys().tmdb}&language=cs&region=CZ&page=${p}`,
        { next: { revalidate: 3600 } }).then(r => r.json())
    ));
    return pages.flatMap((d: any) => d.results ?? []).map((m: any) => ({
      _source: "tmdb", _imdb: null, _tmdb_id: m.id,
      _title: m.original_title ?? m.title, _year: m.release_date ? parseInt(m.release_date) : 0, _raw: m,
    }));
  } catch { return []; }
}

// ── TMDB enrichment ──────────────────────────────────────────────────────────

async function getTMDBDetail(tmdbId: number): Promise<any> {
  if (!getKeys().tmdb || !tmdbId) return null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${getKeys().tmdb}&language=cs&append_to_response=credits,external_ids`,
      { next: { revalidate: 86400 } }
    );
    return res.json();
  } catch { return null; }
}

async function findTMDBByIMDB(imdbId: string): Promise<any> {
  if (!getKeys().tmdb || !imdbId?.startsWith("tt")) return null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/find/${imdbId}?api_key=${getKeys().tmdb}&external_source=imdb_id`,
      { next: { revalidate: 86400 } }
    );
    const data = await res.json();
    const hit = data.movie_results?.[0];
    return hit ? getTMDBDetail(hit.id) : null;
  } catch { return null; }
}

async function searchTMDB(title: string, year: number): Promise<any> {
  if (!getKeys().tmdb || !title) return null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${getKeys().tmdb}&query=${encodeURIComponent(title)}&year=${year || ""}&language=cs`,
      { next: { revalidate: 86400 } }
    );
    const data = await res.json();
    const hit = data.results?.[0];
    return hit ? getTMDBDetail(hit.id) : null;
  } catch { return null; }
}

async function fetchOMDB(imdbId: string) {
  if (!getKeys().omdb || !imdbId) return null;
  try {
    const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${getKeys().omdb}`,
      { next: { revalidate: 86400 } });
    return res.json();
  } catch { return null; }
}

// ── Build cast + director with photos ────────────────────────────────────────

function buildCast(tmdb: any) {
  const cast = (tmdb?.credits?.cast ?? []).slice(0, 8).map((c: any) => ({
    id: c.id,
    name: c.name,
    character: c.character ?? "",
    photo: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
  }));

  const directorRaw = (tmdb?.credits?.crew ?? []).find((c: any) => c.job === "Director");
  const director = directorRaw ? {
    id: directorRaw.id,
    name: directorRaw.name,
    photo: directorRaw.profile_path ? `https://image.tmdb.org/t/p/w185${directorRaw.profile_path}` : null,
  } : null;

  return { cast, director };
}

// ── Normalise raw source entry → unified Movie ───────────────────────────────

async function normalise(entry: any): Promise<any | null> {
  try {
    let tmdb: any = null;
    let ytsRaw: any = null;
    let imdbCode: string = entry._imdb ?? "";

    if (entry._source === "yts") {
      ytsRaw = entry._raw;
      tmdb = imdbCode ? await findTMDBByIMDB(imdbCode) : await searchTMDB(entry._title, entry._year);
    } else if (entry._source === "tmdb") {
      tmdb = await getTMDBDetail(entry._tmdb_id ?? entry._raw.id);
      imdbCode = tmdb?.external_ids?.imdb_id ?? "";
    } else {
      // scene / letterboxd
      tmdb = await searchTMDB(entry._title, entry._year);
      imdbCode = tmdb?.external_ids?.imdb_id ?? "";
    }

    const omdb = imdbCode ? await fetchOMDB(imdbCode) : null;

    const poster = tmdb?.poster_path
      ? `https://image.tmdb.org/t/p/w500${tmdb.poster_path}`
      : ytsRaw?.large_cover_image ?? ytsRaw?.medium_cover_image ?? null;

    const backdrop = tmdb?.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${tmdb.backdrop_path}` : null;

    const overview = tmdb?.overview?.length > 10 ? tmdb.overview : null;
    const ytsRating = ytsRaw?.rating ?? 0;
    const imdbRating = ytsRating > 0 ? ytsRating : parseFloat(omdb?.imdbRating ?? "0") || null;

    const { cast, director } = buildCast(tmdb);

    const sceneSource = ["srrdb", "predb", "scnsrc"].includes(entry._source) ? entry._source : null;

    return {
      id: tmdb?.id ?? Math.abs(Math.random() * 1e9 | 0),
      imdb_code: imdbCode,
      title: ytsRaw?.title ?? tmdb?.original_title ?? entry._raw?.title ?? entry._title,
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
      cast,
      director,
      date_added: ytsRaw?.date_uploaded ?? tmdb?.release_date ?? new Date().toISOString(),
      sources: [entry._source, ...(sceneSource ? [sceneSource] : [])],
      torrents: ytsRaw?.torrents?.map((t: any) => ({
        quality: t.quality, type: t.type, size: t.size, seeds: t.seeds,
      })) ?? [],
    };
  } catch { return null; }
}

// ── Deduplication ────────────────────────────────────────────────────────────

function deduplicate(entries: any[]): any[] {
  const byImdb = new Map<string, any>();
  const byTitleYear = new Map<string, any>();
  const result: any[] = [];

  for (const e of entries) {
    if (!e) continue;
    const imdbKey = e.imdb_code?.startsWith("tt") ? e.imdb_code : null;
    const tyKey = `${(e.title ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")}:${e.year}`;

    if (imdbKey && byImdb.has(imdbKey)) {
      const ex = byImdb.get(imdbKey)!;
      ex.sources = [...new Set([...ex.sources, ...e.sources])];
      if (e.torrents?.length) ex.torrents = [...ex.torrents, ...e.torrents];
      continue;
    }
    if (!imdbKey && byTitleYear.has(tyKey)) continue;

    if (imdbKey) byImdb.set(imdbKey, e);
    byTitleYear.set(tyKey, e);
    result.push(e);
  }
  return result;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");

  const [yts, nowPlaying, upcoming, popular, trending, srrdb, predb, scnsrc] =
    await Promise.all([
      fetchYTS(page),
      page === 1 ? fetchTMDBSection("movie/now_playing") : Promise.resolve([]),
      page === 1 ? fetchTMDBSection("movie/upcoming") : Promise.resolve([]),
      fetchTMDBSection("movie/popular"),
      page === 1 ? fetchTMDBSection("trending/movie/week") : Promise.resolve([]),
      page === 1 ? fetchSrrdb() : Promise.resolve([]),
      page === 1 ? fetchPredb() : Promise.resolve([]),
      page === 1 ? fetchScnsrcScene() : Promise.resolve([]),
    ]);

  // Convert scene releases to unified format
  const toEntry = (s: any, src: string) => ({
    _source: src, _imdb: s.imdbId ? `tt${s.imdbId}` : null,
    _title: s.title, _year: s.year, _raw: s,
  });

  const sceneEntries = [
    ...srrdb.map((s: any) => toEntry(s, "srrdb")),
    ...predb.map((s: any) => toEntry(s, "predb")),
    ...scnsrc.map((s: any) => toEntry(s, "scnsrc")),
  ];

  // YTS + TMDB first (rich data), scene sources second (need enrichment)
  const all = [...yts, ...nowPlaying, ...upcoming, ...popular, ...trending, ...sceneEntries];

  // Normalise in batches
  const normalised: any[] = [];
  for (let i = 0; i < all.length; i += 8) {
    const batch = await Promise.all(all.slice(i, i + 8).map(normalise));
    normalised.push(...batch.filter(Boolean));
    if (normalised.length >= 60) break;
  }

  const movies = deduplicate(normalised)
    .filter(m => m.poster)
    .slice(0, 50);

  return NextResponse.json({ movies, page });
}
