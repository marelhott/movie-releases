import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import Anthropic from "@anthropic-ai/sdk";
import { unstable_cache } from "next/cache";

// force-dynamic: route handler runs every request, but unstable_cache
// provides shared Data Cache across all Vercel serverless instances
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Keys — NOT ANTHROPIC_API_KEY (overridden to "" by Claude Code shell env)
const getKeys = () => ({
  tmdb: process.env.TMDB_API_KEY,
  anthropic: process.env.MOVIE_ANTHROPIC_KEY,
});

// ── In-memory cache (30 min) ─────────────────────────────────────────────────
let _cache: { data: any; ts: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

// ── RSS sources ──────────────────────────────────────────────────────────────
const RSS_SOURCES = [
  { url: "https://www.indiewire.com/c/film/feed/",           name: "IndieWire",          focus: "indie & arthouse" },
  { url: "https://deadline.com/category/film/feed/",         name: "Deadline",           focus: "Hollywood & byznys" },
  { url: "https://www.rogerebert.com/feed.xml",              name: "RogerEbert.com",     focus: "recenze & kritiky" },
  { url: "https://filmschoolrejects.com/feed/",              name: "Film School Rejects",focus: "indie & analýzy" },
  { url: "https://www.slashfilm.com/feed/",                  name: "/Film",              focus: "novinky & teasery" },
  { url: "https://variety.com/v/film/feed/",                 name: "Variety",            focus: "průmysl & premiéry" },
  { url: "https://www.hollywoodreporter.com/c/movies/feed/", name: "Hollywood Reporter", focus: "byznys & premiéry" },
  { url: "https://www.empireonline.com/movies/news/rss/",    name: "Empire",             focus: "recenze & preview" },
  { url: "https://collider.com/feed/",                       name: "Collider",           focus: "trailer & novinky" },
  { url: "https://screenrant.com/feed/",                     name: "Screen Rant",        focus: "novinky & listy" },
  { url: "https://www.theguardian.com/film/rss",             name: "The Guardian Film",  focus: "kritiky & eseje" },
];

interface RawArticle {
  title: string; link: string; pubDate: string;
  description: string; source: string; focus: string; image?: string;
}
interface NewsArticle {
  title_cs: string; summary_cs: string; title_en: string;
  link: string; pubDate: string; source: string; focus: string; image?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "__cdata",
});

function stripHtml(html: string): string {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 260);
}

// Aggressive image extraction from RSS item
function extractImage(item: any): string | undefined {
  // media:content (can be array or object)
  const mc = item["media:content"];
  if (Array.isArray(mc)) {
    const img = mc.find((x: any) => x["@_url"]?.match(/\.(jpe?g|png|webp|gif)/i) || x["@_medium"] === "image");
    if (img?.["@_url"]) return img["@_url"];
  } else if (mc?.["@_url"]) return mc["@_url"];

  // media:thumbnail
  const mt = item["media:thumbnail"];
  if (Array.isArray(mt)) return mt[0]?.["@_url"];
  if (mt?.["@_url"]) return mt["@_url"];

  // enclosure
  const enc = item.enclosure;
  if (enc?.["@_type"]?.startsWith("image") && enc?.["@_url"]) return enc["@_url"];

  // itunes:image
  const ii = item["itunes:image"];
  if (ii?.["@_href"]) return ii["@_href"];

  // content:encoded or description — find first <img src="...">
  const sources = [
    item["content:encoded"], item["content:encoded"]?.["__cdata"],
    item.description, item.description?.["__cdata"],
    item.content, item.summary,
  ];
  for (const src of sources) {
    if (!src) continue;
    const m = String(src).match(/<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp|gif)[^"']*?)["']/i);
    if (m?.[1] && !m[1].includes("pixel") && !m[1].includes("tracking") && m[1].startsWith("http")) {
      return m[1];
    }
  }

  return undefined;
}

// Fetch OG image from article URL (fast, 3s timeout)
async function fetchOGImage(url: string): Promise<string | undefined> {
  if (!url?.startsWith("http")) return undefined;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    });
    clearTimeout(timer);
    if (!res.ok) return undefined;
    const html = await res.text();
    const m = html.match(/<meta[^>]+(?:property=["']og:image["']|name=["']og:image["'])[^>]*content=["']([^"']+)["']/i)
           || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
           || html.match(/<meta[^>]+(?:property=["']twitter:image["'])[^>]*content=["']([^"']+)["']/i);
    const img = m?.[1];
    if (img && img.startsWith("http")) return img;
  } catch {
    clearTimeout(timer);
  }
  return undefined;
}

// Fetch single RSS source with 6s timeout
async function fetchRSS(source: typeof RSS_SOURCES[0]): Promise<RawArticle[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MovieBot/1.0)" },
      next: { revalidate: 1800 },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = parser.parse(xml);
    const items = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];
    const arr = Array.isArray(items) ? items : [items];

    return arr.slice(0, 5).map((item: any) => {
      const titleRaw = item.title?.["__cdata"] ?? item.title ?? "";
      const descRaw = item.description?.["__cdata"] ?? item.description
                   ?? item.summary?.["__cdata"] ?? item.summary
                   ?? item["content:encoded"]?.["__cdata"] ?? "";
      const link = item.link?.["@_href"] ?? item.link ?? "";

      return {
        title: stripHtml(titleRaw),
        link: typeof link === "string" ? link : link?.["#text"] ?? "",
        pubDate: item.pubDate ?? item.updated ?? item.published ?? "",
        description: stripHtml(descRaw),
        source: source.name,
        focus: source.focus,
        image: extractImage(item),
      };
    }).filter(a => a.title && a.link);
  } catch {
    clearTimeout(timer);
    return [];
  }
}

// Enrich images: for articles without one, fetch OG image in parallel (max 10 at a time)
async function enrichImages(articles: RawArticle[]): Promise<RawArticle[]> {
  const missing = articles.filter(a => !a.image);
  // Only fetch OG for first 12 missing to stay fast
  const toFetch = missing.slice(0, 12);

  const ogImages = await Promise.all(toFetch.map(a => fetchOGImage(a.link)));

  const ogMap = new Map<string, string>();
  toFetch.forEach((a, i) => { if (ogImages[i]) ogMap.set(a.link, ogImages[i]!); });

  return articles.map(a => ({
    ...a,
    image: a.image ?? ogMap.get(a.link),
  }));
}

// Translate batch via Claude Haiku
async function translateBatch(articles: RawArticle[], client: Anthropic): Promise<NewsArticle[]> {
  const payload = articles.map((a, i) => ({ i, t: a.title, s: a.description }));
  const prompt = `Přelož do filmové češtiny. Vrať POUZE JSON pole objektů s klíči "i","t","s" (přeložený titulek a perex). Bez dalšího textu.\n${JSON.stringify(payload)}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = (msg.content[0].type === "text" ? msg.content[0].text : "")
      .replace(/```(?:json)?\n?/g, "").trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("no json");
    const translated: { i: number; t: string; s: string }[] = JSON.parse(match[0]);
    return articles.map((a, idx) => {
      const t = translated.find(x => x.i === idx);
      return {
        title_cs: t?.t ?? a.title, summary_cs: t?.s ?? a.description,
        title_en: a.title, link: a.link, pubDate: a.pubDate,
        source: a.source, focus: a.focus, image: a.image,
      };
    });
  } catch {
    return articles.map(a => ({
      title_cs: a.title, summary_cs: a.description, title_en: a.title,
      link: a.link, pubDate: a.pubDate, source: a.source, focus: a.focus, image: a.image,
    }));
  }
}

async function translateAll(articles: RawArticle[]): Promise<NewsArticle[]> {
  const key = getKeys().anthropic;
  if (!key || !articles.length) {
    return articles.map(a => ({
      title_cs: a.title, summary_cs: a.description, title_en: a.title,
      link: a.link, pubDate: a.pubDate, source: a.source, focus: a.focus, image: a.image,
    }));
  }
  const client = new Anthropic({ apiKey: key });
  // Two batches of 15 in parallel
  const mid = Math.ceil(articles.length / 2);
  const [a, b] = await Promise.all([
    translateBatch(articles.slice(0, mid), client),
    translateBatch(articles.slice(mid), client),
  ]);
  return [...a, ...b];
}

async function fetchTMDBTrending(): Promise<NewsArticle[]> {
  const tmdb = getKeys().tmdb;
  if (!tmdb) return [];
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/trending/movie/week?api_key=${tmdb}&language=cs`,
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    return (data.results ?? []).slice(0, 12).map((m: any) => ({
      title_cs: m.title ?? m.original_title,
      summary_cs: m.overview || "Popis není k dispozici.",
      title_en: m.original_title,
      link: `https://www.themoviedb.org/movie/${m.id}`,
      pubDate: m.release_date ?? "",
      source: "TMDB Trending",
      focus: "trending tento týden",
      image: m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}`
           : m.poster_path   ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : undefined,
    }));
  } catch { return []; }
}

// ── Cached data fetcher (Vercel Data Cache — shared across all instances) ────

const fetchNewsData = unstable_cache(
  async () => {
    const [rssResults, trending] = await Promise.all([
      Promise.all(RSS_SOURCES.map(fetchRSS)),
      fetchTMDBTrending(),
    ]);

    const sorted = rssResults.flat()
      .filter(a => a.title && a.link)
      .sort((a, b) => (b.pubDate ? new Date(b.pubDate).getTime() : 0) - (a.pubDate ? new Date(a.pubDate).getTime() : 0))
      .slice(0, 30);

    const [enriched, translated] = await Promise.all([
      enrichImages(sorted),
      translateAll(sorted),
    ]);

    const articles = translated.map((a, i) => ({
      ...a,
      image: enriched[i]?.image ?? a.image,
    }));

    return { articles, trending };
  },
  ["news-data"],          // cache key
  { revalidate: 1800 }    // 30 min — Vercel Data Cache
);

// ── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";

  // Local in-memory fallback (dev / single-instance)
  if (_cache && !force && Date.now() - _cache.ts < CACHE_TTL) {
    return NextResponse.json({ ..._cache.data, cached: "memory" });
  }

  // unstable_cache: on Vercel reads from shared Data Cache (fast),
  // on first call or after revalidate runs the full fetch+translate
  const data = await fetchNewsData();

  // Update local cache too
  _cache = { data, ts: Date.now() };

  return NextResponse.json(data);
}
