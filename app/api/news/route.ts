import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import Anthropic from "@anthropic-ai/sdk";
import { unstable_cache } from "next/cache";

export const dynamic = "force-static";
export const revalidate = 1800;
export const maxDuration = 60;

const RSS_ITEMS_PER_SOURCE = 6;
const OG_IMAGE_FALLBACK_LIMIT = 8;
const ALLOWED_PERSON_DEPARTMENTS = new Set(["Acting", "Directing"]);

const getKeys = () => ({
  tmdb: process.env.TMDB_API_KEY,
  anthropic: process.env.MOVIE_ANTHROPIC_KEY,
});

// ── Sources ──────────────────────────────────────────────────────────────────
const RSS_SOURCES = [
  { url: "https://deadline.com/feed/",                    name: "Deadline",           focus: "breaking news & zákulisí", lang: "en" },
  { url: "https://variety.com/feed/",                     name: "Variety",            focus: "průmysl & business",       lang: "en" },
  { url: "https://www.hollywoodreporter.com/feed/",       name: "Hollywood Reporter", focus: "festivaly & rozhovory",    lang: "en" },
  { url: "https://www.indiewire.com/c/film/feed/",        name: "IndieWire",          focus: "indie & autorský film",    lang: "en" },
  { url: "https://www.moviezone.cz/rss/",                name: "MovieZone.cz",       focus: "české filmové novinky",    lang: "cs" },
];

interface RawArticle {
  title: string; link: string; pubDate: string;
  description: string; fullText: string;
  source: string; focus: string; image?: string; lang: string;
}

export interface PersonSnippet {
  id: number; name: string; photo: string | null;
  known_for: string; top_films: { title: string; year: number; poster: string | null }[];
}

export interface NewsArticle {
  title_cs: string; body_cs: string; title_en: string;
  link: string; pubDate: string; source: string; focus: string;
  image?: string; person?: PersonSnippet;
}

export interface TrendingFilm {
  id: number; imdb_code: string; title: string; czech_title: string | null;
  year: number; runtime: number; genres: string[]; overview: string | null;
  poster: string | null; backdrop: string | null;
  ratings: { imdb: number | null; tmdb: number | null; rt: null; metacritic: null };
  cast: { id: number; name: string; character: string; photo: string | null }[];
  director: { id: number; name: string; photo: string | null } | null;
  date_added: string; sources: string[]; torrents: [];
}

const parser = new XMLParser({
  ignoreAttributes: false, attributeNamePrefix: "@_", cdataPropName: "__cdata",
});

function stripHtml(html: string, maxLen = 700): string {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function extractImage(item: any): string | undefined {
  const mc = item["media:content"];
  if (Array.isArray(mc)) {
    const img = mc.find((x: any) => x["@_url"] && (x["@_medium"] === "image" || /\.(jpe?g|png|webp)/i.test(x["@_url"])));
    if (img?.["@_url"]) return img["@_url"];
  } else if (mc?.["@_url"]) return mc["@_url"];
  const mt = item["media:thumbnail"];
  if (Array.isArray(mt)) return mt[0]?.["@_url"];
  if (mt?.["@_url"]) return mt["@_url"];
  const enc = item.enclosure;
  if (enc?.["@_type"]?.startsWith("image") && enc?.["@_url"]) return enc["@_url"];
  if (item["itunes:image"]?.["@_href"]) return item["itunes:image"]["@_href"];
  for (const src of [item["content:encoded"]?.["__cdata"], item["content:encoded"],
                      item.description?.["__cdata"], item.description]) {
    if (!src) continue;
    const m = String(src).match(/<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp)[^"']*?)["']/i);
    if (m?.[1]?.startsWith("http") && !m[1].includes("1x1") && !m[1].includes("pixel")) return m[1];
  }
}

async function fetchRSS(source: typeof RSS_SOURCES[0]): Promise<RawArticle[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FilmBot/1.0)" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = parser.parse(xml);
    const items = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];
    const arr = Array.isArray(items) ? items : [items];
    return arr.slice(0, RSS_ITEMS_PER_SOURCE).map((item: any) => {
      const titleRaw = item.title?.["__cdata"] ?? item.title ?? "";
      const desc = item.description?.["__cdata"] ?? item.description ?? item.summary?.["__cdata"] ?? item.summary ?? "";
      const full = item["content:encoded"]?.["__cdata"] ?? item["content:encoded"] ?? desc;
      const link = item.link?.["@_href"] ?? (typeof item.link === "string" ? item.link : item.link?.["#text"] ?? "");
      return {
        title: stripHtml(titleRaw, 200), link,
        pubDate: item.pubDate ?? item.updated ?? item.published ?? "",
        description: stripHtml(desc, 400), fullText: stripHtml(full, 800),
        source: source.name, focus: source.focus, lang: source.lang,
        image: extractImage(item),
      };
    }).filter(a => a.title && a.link);
  } catch { clearTimeout(t); return []; }
}

function buildFallbackBody(article: RawArticle): string {
  if (article.description) return article.description;
  if (article.link.includes("/trailery")) {
    return `${article.source} přinesl nový trailer k titulu ${article.title}.`;
  }
  if (article.link.includes("/recenze")) {
    return `${article.source} zveřejnil recenzi k titulu ${article.title}.`;
  }
  return `${article.source} přinesl novou zprávu ze světa filmu k tématu ${article.title}.`;
}

function deduplicate(articles: RawArticle[]): RawArticle[] {
  const seen = new Set<string>();
  return articles.filter(a => {
    const key = a.title.toLowerCase().replace(/[^a-z0-9 ]/g, "")
      .split(" ").filter(w => w.length > 3).slice(0, 5).join(" ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── OG image fallback ────────────────────────────────────────────────────────
async function fetchOGImage(url: string): Promise<string | undefined> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Googlebot/2.1" } });
    clearTimeout(t);
    const html = await res.text();
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
           || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    return m?.[1]?.startsWith("http") ? m[1] : undefined;
  } catch { clearTimeout(t); return undefined; }
}

// ── TMDB person lookup ────────────────────────────────────────────────────────
async function findPersonByName(name: string, tmdbKey: string): Promise<PersonSnippet | null> {
  try {
    const searchRes = await fetch(
      `https://api.themoviedb.org/3/search/person?api_key=${tmdbKey}&query=${encodeURIComponent(name)}&language=cs`,
      { next: { revalidate: 86400 } }
    );
    const searchData = await searchRes.json();
    const person = searchData.results?.[0];
    if (!person) return null;
    if (!ALLOWED_PERSON_DEPARTMENTS.has(person.known_for_department ?? "")) return null;

    const creditsRes = await fetch(
      `https://api.themoviedb.org/3/person/${person.id}/movie_credits?api_key=${tmdbKey}&language=cs`,
      { next: { revalidate: 86400 } }
    );
    const credits = await creditsRes.json();

    const seenFilmIds = new Set<number>();
    const topFilms = [...(credits.crew ?? []).filter((c: any) => c.job === "Director"),
                      ...(credits.cast ?? [])]
      .sort((a: any, b: any) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
      .filter((f: any) => {
        if (!f?.id || seenFilmIds.has(f.id)) return false;
        seenFilmIds.add(f.id);
        return true;
      })
      .slice(0, 5)
      .map((f: any) => ({
        title: f.title ?? f.original_title,
        year: f.release_date ? parseInt(f.release_date) : 0,
        poster: f.poster_path ? `https://image.tmdb.org/t/p/w185${f.poster_path}` : null,
      }));

    return {
      id: person.id,
      name: person.name,
      photo: person.profile_path ? `https://image.tmdb.org/t/p/w185${person.profile_path}` : null,
      known_for: person.known_for_department ?? "",
      top_films: topFilms,
    };
  } catch { return null; }
}

const getCachedPersonByName = unstable_cache(
  async (name: string, tmdbKey: string) => findPersonByName(name, tmdbKey),
  ["news-person-by-name-v1"],
  { revalidate: 86400 }
);

// ── Claude: generate article + detect filmmaker ───────────────────────────────
async function generateArticles(
  articles: RawArticle[], client: Anthropic, tmdbKey: string
): Promise<NewsArticle[]> {
  const payload = articles.map((a, i) => ({
    i, title: a.title, text: a.fullText || a.description,
    source: a.source, lang: a.lang,
  }));

  const prompt = `Jsi filmový redaktor pro českou filmovou komunitu.

Pro každý článek níže:
- "title_cs": český nadpis (max 12 slov, výstižný, ne clickbait)
- "body_cs": 3-5 vět v češtině. Napiš jako novinář — co je zajímavé, proč to stojí za pozornost. Pokud je to z MovieZone.cz (lang: cs), uprav styl, ne jen překládej. Čtenář nesmí potřebovat klikat jinam.
- "person_name": pokud článek zmiňuje KONKRÉTNÍHO filmového režiséra nebo herce jako hlavní téma, napiš jeho/její celé jméno v angličtině. Jinak null.

Vrať POUZE validní JSON pole s klíči "i","title_cs","body_cs","person_name". Bez markdown.

${JSON.stringify(payload)}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001", max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = (msg.content[0].type === "text" ? msg.content[0].text : "")
      .replace(/```(?:json)?\n?/g, "").trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("no json");

    const generated: { i: number; title_cs: string; body_cs: string; person_name: string | null }[] =
      JSON.parse(match[0]);

    // Fetch person data for detected filmmakers in parallel
    const personFetches = generated.map(g =>
      g.person_name ? getCachedPersonByName(g.person_name, tmdbKey) : Promise.resolve(null)
    );
    const persons = await Promise.all(personFetches);

    return articles.map((a, idx) => {
      const g = generated.find(x => x.i === idx);
      const person = persons[generated.findIndex(x => x.i === idx)] ?? undefined;
      return {
        title_cs: g?.title_cs?.trim() || a.title,
        body_cs: g?.body_cs?.trim() || buildFallbackBody(a),
        title_en: a.title, link: a.link, pubDate: a.pubDate,
        source: a.source, focus: a.focus, image: a.image,
        person: person ?? undefined,
      };
    });
  } catch {
    return articles.map(a => ({
      title_cs: a.title, body_cs: buildFallbackBody(a), title_en: a.title,
      link: a.link, pubDate: a.pubDate, source: a.source, focus: a.focus, image: a.image,
    }));
  }
}

// ── Trending films as MovieCard-compatible objects ────────────────────────────
async function fetchTrendingFilms(tmdbKey: string): Promise<TrendingFilm[]> {
  try {
    const [weekRes, playingRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${tmdbKey}&language=cs`),
      fetch(`https://api.themoviedb.org/3/movie/now_playing?api_key=${tmdbKey}&language=cs&region=CZ`),
    ]);
    const [week, playing] = await Promise.all([weekRes.json(), playingRes.json()]);

    const seen = new Set<number>();
    const all = [...(week.results ?? []), ...(playing.results ?? [])].filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id); return true;
    }).slice(0, 14);

    return all.map((m: any) => ({
      id: m.id,
      imdb_code: "",
      title: m.original_title ?? m.title,
      czech_title: m.title !== m.original_title ? m.title : null,
      year: m.release_date ? parseInt(m.release_date) : 0,
      runtime: 0,
      genres: [],
      overview: m.overview?.length > 10 ? m.overview : null,
      poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
      backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : null,
      ratings: { imdb: m.vote_average ? Math.round(m.vote_average * 10) / 10 : null, tmdb: null, rt: null, metacritic: null },
      cast: [], director: null,
      date_added: m.release_date ?? "",
      sources: ["tmdb"], torrents: [],
    }));
  } catch { return []; }
}

// ── Cached ────────────────────────────────────────────────────────────────────
const fetchNewsData = unstable_cache(
  async () => {
    const { tmdb, anthropic } = getKeys();

    const [rssResults, trending] = await Promise.all([
      Promise.all(RSS_SOURCES.map(fetchRSS)),
      tmdb ? fetchTrendingFilms(tmdb) : Promise.resolve([]),
    ]);

    const sorted = deduplicate(
      rssResults.flat()
        .filter(a => a.title && a.link)
        .sort((a, b) => (b.pubDate ? new Date(b.pubDate).getTime() : 0) - (a.pubDate ? new Date(a.pubDate).getTime() : 0))
    ).slice(0, 24);

    // OG image fallback for articles without image
    const missing = sorted.filter(a => !a.image).slice(0, OG_IMAGE_FALLBACK_LIMIT);
    const ogImages = await Promise.all(missing.map(a => fetchOGImage(a.link)));
    missing.forEach((a, i) => { if (ogImages[i]) a.image = ogImages[i]; });

    // Generate articles with Claude in 2 parallel batches
    let articles: NewsArticle[] = sorted.map(a => ({
      title_cs: a.title, body_cs: buildFallbackBody(a), title_en: a.title,
      link: a.link, pubDate: a.pubDate, source: a.source, focus: a.focus, image: a.image,
    }));

    if (anthropic && tmdb) {
      const client = new Anthropic({ apiKey: anthropic });
      const mid = Math.ceil(sorted.length / 2);
      const [a, b] = await Promise.all([
        generateArticles(sorted.slice(0, mid), client, tmdb),
        generateArticles(sorted.slice(mid), client, tmdb),
      ]);
      articles = [...a, ...b];
    }

    return { articles, trending };
  },
  ["news-data-v3"],
  { revalidate: 1800 }
);

export async function GET() {
  const data = await fetchNewsData();
  return NextResponse.json(data);
}
