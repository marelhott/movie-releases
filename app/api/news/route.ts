import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import Anthropic from "@anthropic-ai/sdk";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const getKeys = () => ({
  tmdb: process.env.TMDB_API_KEY,
  anthropic: process.env.MOVIE_ANTHROPIC_KEY,
});

// ── RSS sources — curated for film enthusiasts & young filmmakers ─────────────
const RSS_SOURCES = [
  { url: "https://www.indiewire.com/c/film/feed/",         name: "IndieWire",          focus: "indie & arthouse", priority: 1 },
  { url: "https://www.rogerebert.com/feed.xml",            name: "RogerEbert.com",     focus: "recenze & kritiky", priority: 1 },
  { url: "https://mubi.com/notebook/posts.atom",           name: "MUBI Notebook",      focus: "artové kino",       priority: 1 },
  { url: "https://lwlies.com/feed/",                       name: "Little White Lies",  focus: "indie & vizuální styl", priority: 1 },
  { url: "https://filmmakermagazine.com/feed/",            name: "Filmmaker Magazine", focus: "řemeslo & tvorba", priority: 1 },
  { url: "https://filmschoolrejects.com/feed/",            name: "Film School Rejects",focus: "analýzy & listy",  priority: 2 },
  { url: "https://www.slashfilm.com/feed/",                name: "/Film",              focus: "novinky & rozbory", priority: 2 },
  { url: "https://www.theguardian.com/film/rss",           name: "The Guardian Film",  focus: "kritiky & eseje",  priority: 2 },
  { url: "https://deadline.com/category/film/feed/",       name: "Deadline",           focus: "průmysl & premiéry", priority: 3 },
  { url: "https://collider.com/feed/",                     name: "Collider",           focus: "trailer & preview", priority: 3 },
];

interface RawArticle {
  title: string; link: string; pubDate: string;
  description: string; fullText: string;
  source: string; focus: string; image?: string; priority: number;
}

interface NewsArticle {
  title_cs: string; body_cs: string; title_en: string;
  link: string; pubDate: string; source: string; focus: string; image?: string;
}

interface FilmTydne {
  tmdb_id: number; title: string; czech_title: string;
  tagline: string; overview_cs: string;
  poster: string; backdrop: string;
  year: number; runtime: number; genres: string[];
  ratings: { imdb: number | null; tmdb: number | null };
  director: { id: number; name: string; photo: string | null; bio_cs: string };
  cast: { id: number; name: string; character: string; photo: string | null }[];
  similar: { id: number; title: string; poster: string | null; year: number }[];
}

const parser = new XMLParser({
  ignoreAttributes: false, attributeNamePrefix: "@_", cdataPropName: "__cdata",
});

function stripHtml(html: string, maxLen = 600): string {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function extractImage(item: any): string | undefined {
  const mc = item["media:content"];
  if (Array.isArray(mc)) {
    const img = mc.find((x: any) => x["@_url"] && (x["@_medium"] === "image" || x["@_url"].match(/\.(jpe?g|png|webp)/i)));
    if (img?.["@_url"]) return img["@_url"];
  } else if (mc?.["@_url"]) return mc["@_url"];
  const mt = item["media:thumbnail"];
  if (Array.isArray(mt)) return mt[0]?.["@_url"];
  if (mt?.["@_url"]) return mt["@_url"];
  const enc = item.enclosure;
  if (enc?.["@_type"]?.startsWith("image") && enc?.["@_url"]) return enc["@_url"];
  if (item["itunes:image"]?.["@_href"]) return item["itunes:image"]["@_href"];
  // extract from content
  for (const src of [item["content:encoded"], item["content:encoded"]?.["__cdata"],
                      item.description?.["__cdata"], item.description, item.content, item.summary]) {
    if (!src) continue;
    const m = String(src).match(/<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp)[^"']*?)["']/i);
    if (m?.[1] && m[1].startsWith("http") && !m[1].includes("pixel") && !m[1].includes("1x1")) return m[1];
  }
}

async function fetchRSS(source: typeof RSS_SOURCES[0]): Promise<RawArticle[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
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
    return arr.slice(0, 5).map((item: any) => {
      const titleRaw = item.title?.["__cdata"] ?? item.title ?? "";
      const desc = item.description?.["__cdata"] ?? item.description ?? item.summary?.["__cdata"] ?? item.summary ?? "";
      const full = item["content:encoded"]?.["__cdata"] ?? item["content:encoded"] ?? item.content?.["__cdata"] ?? desc;
      const link = item.link?.["@_href"] ?? (typeof item.link === "string" ? item.link : item.link?.["#text"] ?? "");
      return {
        title: stripHtml(titleRaw, 200),
        link,
        pubDate: item.pubDate ?? item.updated ?? item.published ?? "",
        description: stripHtml(desc, 400),
        fullText: stripHtml(full, 800),
        source: source.name,
        focus: source.focus,
        priority: source.priority,
        image: extractImage(item),
      };
    }).filter(a => a.title && a.link);
  } catch { clearTimeout(t); return []; }
}

// Deduplicate articles that are clearly about the same film/story
function deduplicate(articles: RawArticle[]): RawArticle[] {
  const seen = new Set<string>();
  return articles.filter(a => {
    // Normalise title to detect near-duplicates
    const key = a.title.toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .split(" ").filter(w => w.length > 3).slice(0, 5).join(" ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Generate rich Czech article with Claude — not just translation
async function generateArticles(articles: RawArticle[], client: Anthropic): Promise<NewsArticle[]> {
  const payload = articles.map((a, i) => ({
    i, title: a.title, text: a.fullText || a.description, source: a.source,
  }));

  const prompt = `Jsi filmový redaktor píšící pro českou filmovou komunitu mladých filmových nadšenců a filmařů.

Pro každý článek níže napiš:
- "title_cs": přeložený nebo adaptovaný nadpis v češtině (max 12 slov, výstižný, ne clickbait)
- "body_cs": 3-4 věty českého textu. NEOPAKUJ nadpis. Napiš jako novinář — co je zajímavé, proč to stojí za pozornost, kontext. Pokud jde o recenzi, shrň pocit z filmu. Pokud o průmyslové zprávě, vysvětli dopad. Čtenář nesmí potřebovat klikat jinam.

Vrať POUZE validní JSON pole objektů s klíči "i", "title_cs", "body_cs". Bez markdown, bez dalšího textu.

${JSON.stringify(payload)}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = (msg.content[0].type === "text" ? msg.content[0].text : "")
      .replace(/```(?:json)?\n?/g, "").trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("no json");
    const generated: { i: number; title_cs: string; body_cs: string }[] = JSON.parse(match[0]);
    return articles.map((a, idx) => {
      const g = generated.find(x => x.i === idx);
      return {
        title_cs: g?.title_cs ?? a.title, body_cs: g?.body_cs ?? a.description,
        title_en: a.title, link: a.link, pubDate: a.pubDate,
        source: a.source, focus: a.focus, image: a.image,
      };
    });
  } catch {
    return articles.map(a => ({
      title_cs: a.title, body_cs: a.description, title_en: a.title,
      link: a.link, pubDate: a.pubDate, source: a.source, focus: a.focus, image: a.image,
    }));
  }
}

// Fetch OG image fallback (3s timeout)
async function fetchOGImage(url: string): Promise<string | undefined> {
  if (!url?.startsWith("http")) return undefined;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" } });
    clearTimeout(t);
    const html = await res.text();
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
           || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    const img = m?.[1];
    return img?.startsWith("http") ? img : undefined;
  } catch { clearTimeout(t); return undefined; }
}

// ── Film týdne — richly detailed from TMDB ───────────────────────────────────

async function fetchFilmTydne(tmdb: string, anthropic: string): Promise<FilmTydne | null> {
  try {
    // Get trending #1 this week
    const trendingRes = await fetch(
      `https://api.themoviedb.org/3/trending/movie/week?api_key=${tmdb}&language=cs`
    );
    const trendingData = await trendingRes.json();
    const film = trendingData.results?.[0];
    if (!film) return null;

    // Get full details with credits + external IDs
    const [detailRes, similarRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/movie/${film.id}?api_key=${tmdb}&language=cs&append_to_response=credits,external_ids`),
      fetch(`https://api.themoviedb.org/3/movie/${film.id}/similar?api_key=${tmdb}&language=cs`),
    ]);
    const detail = await detailRes.json();
    const similarData = await similarRes.json();

    const director = detail.credits?.crew?.find((c: any) => c.job === "Director");

    // Get director bio
    let directorBio = "";
    if (director?.id) {
      const personRes = await fetch(`https://api.themoviedb.org/3/person/${director.id}?api_key=${tmdb}&language=cs`);
      const personData = await personRes.json();
      directorBio = personData.biography?.slice(0, 600) ?? "";
    }

    // If Czech overview is empty, use Claude to generate one
    let overview = detail.overview ?? "";
    if ((!overview || overview.length < 50) && anthropic) {
      const enRes = await fetch(`https://api.themoviedb.org/3/movie/${film.id}?api_key=${tmdb}&language=en`);
      const enDetail = await enRes.json();
      if (enDetail.overview && anthropic) {
        const client = new Anthropic({ apiKey: anthropic });
        const msg = await client.messages.create({
          model: "claude-haiku-4-5-20251001", max_tokens: 500,
          messages: [{ role: "user", content: `Přelož tento popis filmu do češtiny (zachovej filmový jazyk, 3-5 vět):\n${enDetail.overview}` }],
        });
        overview = msg.content[0].type === "text" ? msg.content[0].text : enDetail.overview;
      }
    }

    // Translate director bio to Czech if needed
    if (directorBio && directorBio.length > 50 && anthropic && !directorBio.match(/[áčďéěíňóřšťúůýž]/i)) {
      try {
        const client = new Anthropic({ apiKey: anthropic });
        const msg = await client.messages.create({
          model: "claude-haiku-4-5-20251001", max_tokens: 400,
          messages: [{ role: "user", content: `Přelož do češtiny (max 3 věty, zachovej faktické info):\n${directorBio.slice(0, 400)}` }],
        });
        directorBio = msg.content[0].type === "text" ? msg.content[0].text : directorBio;
      } catch { /* keep original */ }
    }

    const cast = (detail.credits?.cast ?? []).slice(0, 6).map((c: any) => ({
      id: c.id, name: c.name, character: c.character ?? "",
      photo: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
    }));

    const similar = (similarData.results ?? []).slice(0, 6).map((m: any) => ({
      id: m.id, title: m.title ?? m.original_title,
      poster: m.poster_path ? `https://image.tmdb.org/t/p/w185${m.poster_path}` : null,
      year: m.release_date ? parseInt(m.release_date) : 0,
    }));

    return {
      tmdb_id: film.id,
      title: detail.original_title ?? detail.title,
      czech_title: detail.title !== detail.original_title ? detail.title : "",
      tagline: detail.tagline ?? "",
      overview_cs: overview,
      poster: detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : "",
      backdrop: detail.backdrop_path ? `https://image.tmdb.org/t/p/w1280${detail.backdrop_path}` : "",
      year: detail.release_date ? parseInt(detail.release_date) : 0,
      runtime: detail.runtime ?? 0,
      genres: (detail.genres ?? []).map((g: any) => g.name),
      ratings: { imdb: detail.vote_average ? Math.round(detail.vote_average * 10) / 10 : null, tmdb: null },
      director: {
        id: director?.id ?? 0, name: director?.name ?? "neznámý",
        photo: director?.profile_path ? `https://image.tmdb.org/t/p/w185${director.profile_path}` : null,
        bio_cs: directorBio,
      },
      cast,
      similar,
    };
  } catch { return null; }
}

// ── Cached fetch ──────────────────────────────────────────────────────────────

const fetchNewsData = unstable_cache(
  async () => {
    const { tmdb, anthropic } = getKeys();

    const [rssResults, filmTydne] = await Promise.all([
      Promise.all(RSS_SOURCES.map(fetchRSS)),
      tmdb ? fetchFilmTydne(tmdb, anthropic ?? "") : Promise.resolve(null),
    ]);

    // Sort: priority 1 first, then by date; deduplicate
    const sorted = deduplicate(
      rssResults.flat()
        .filter(a => a.title && a.link)
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return (b.pubDate ? new Date(b.pubDate).getTime() : 0) - (a.pubDate ? new Date(a.pubDate).getTime() : 0);
        })
    ).slice(0, 24);

    // Fill missing images via OG (first 10 without image)
    const missing = sorted.filter(a => !a.image).slice(0, 10);
    const ogImages = await Promise.all(missing.map(a => fetchOGImage(a.link)));
    const ogMap = new Map<string, string>();
    missing.forEach((a, i) => { if (ogImages[i]) ogMap.set(a.link, ogImages[i]!); });
    sorted.forEach(a => { if (!a.image && ogMap.has(a.link)) a.image = ogMap.get(a.link); });

    // Generate rich Czech articles with Claude in 2 parallel batches
    let articles: NewsArticle[] = sorted.map(a => ({
      title_cs: a.title, body_cs: a.description, title_en: a.title,
      link: a.link, pubDate: a.pubDate, source: a.source, focus: a.focus, image: a.image,
    }));

    if (anthropic) {
      const client = new Anthropic({ apiKey: anthropic });
      const mid = Math.ceil(sorted.length / 2);
      const [a, b] = await Promise.all([
        generateArticles(sorted.slice(0, mid), client),
        generateArticles(sorted.slice(mid), client),
      ]);
      articles = [...a, ...b];
    }

    return { articles, filmTydne };
  },
  ["news-data-v2"],
  { revalidate: 1800 }
);

export async function GET() {
  const data = await fetchNewsData();
  return NextResponse.json(data);
}
