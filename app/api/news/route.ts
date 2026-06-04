import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

// Read keys inside handlers — never at module scope in Next.js
const getKeys = () => ({
  tmdb: process.env.TMDB_API_KEY,
  anthropic: process.env.MOVIE_ANTHROPIC_KEY,  // NOT ANTHROPIC_API_KEY — that's overridden by Claude Code shell env
});

const RSS_SOURCES = [
  { url: "https://www.indiewire.com/c/film/feed/",              name: "IndieWire",          focus: "indie & arthouse" },
  { url: "https://deadline.com/category/film/feed/",            name: "Deadline",           focus: "Hollywood & byznys" },
  { url: "https://www.rogerebert.com/feed.xml",                 name: "RogerEbert.com",     focus: "recenze & kritiky" },
  { url: "https://filmschoolrejects.com/feed/",                 name: "Film School Rejects",focus: "indie & analýzy" },
  { url: "https://www.slashfilm.com/feed/",                     name: "/Film",              focus: "novinky & teasery" },
  { url: "https://variety.com/v/film/feed/",                    name: "Variety",            focus: "průmysl & premiéry" },
  { url: "https://www.hollywoodreporter.com/c/movies/feed/",    name: "Hollywood Reporter", focus: "byznys & premiéry" },
  { url: "https://www.empireonline.com/movies/news/rss/",       name: "Empire",             focus: "recenze & preview" },
  { url: "https://collider.com/feed/",                          name: "Collider",           focus: "trailer & novinky" },
  { url: "https://screenrant.com/feed/",                        name: "Screen Rant",        focus: "novinky & listy" },
  { url: "https://www.theguardian.com/film/rss",                name: "The Guardian Film",  focus: "kritiky & eseje" },
];

interface RawArticle {
  title: string; link: string; pubDate: string;
  description: string; source: string; focus: string; image?: string;
}

interface NewsArticle {
  title_cs: string; summary_cs: string; title_en: string;
  link: string; pubDate: string; source: string; focus: string; image?: string;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 280);
}

function extractImage(item: any): string | undefined {
  const mc = item["media:content"];
  if (mc?.["@_url"]) return mc["@_url"];
  if (Array.isArray(mc)) return mc[0]?.["@_url"];
  const mt = item["media:thumbnail"];
  if (mt?.["@_url"]) return mt["@_url"];
  const enc = item.enclosure;
  if (enc?.["@_url"] && enc?.["@_type"]?.startsWith("image")) return enc["@_url"];
  const desc = String(item.description ?? "");
  return desc.match(/<img[^>]+src="([^"]+)"/i)?.[1];
}

// Fetch with 6s timeout
async function fetchRSS(source: typeof RSS_SOURCES[0]): Promise<RawArticle[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MovieBot/1.0)" },
      next: { revalidate: 3600 },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = parser.parse(xml);
    const items = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];
    const arr = Array.isArray(items) ? items : [items];
    return arr.slice(0, 5).map((item: any) => ({
      title: stripHtml(item.title ?? ""),
      link: item.link?.["@_href"] ?? item.link ?? "",
      pubDate: item.pubDate ?? item.updated ?? item.published ?? "",
      description: stripHtml(item.description ?? item.summary ?? item.content ?? ""),
      source: source.name,
      focus: source.focus,
      image: extractImage(item),
    })).filter(a => a.title && a.link);
  } catch {
    clearTimeout(timer);
    return [];
  }
}

// Translate a batch — max 20 items at a time to stay fast
async function translateBatch(articles: RawArticle[], client: Anthropic): Promise<NewsArticle[]> {
  const payload = articles.map((a, i) => ({ i, title: a.title, summary: a.description }));
  const prompt = `Přelož do češtiny. Filmový styl. Vrať POUZE JSON pole s klíči "i","title_cs","summary_cs". Bez dalšího textu.\n${JSON.stringify(payload)}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    // Strip markdown code fences if present
    const clean = raw.replace(/```(?:json)?\n?/g, "").trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) throw new Error(`no json array in: ${clean.slice(0, 100)}`);
    const translated: { i: number; title_cs: string; summary_cs: string }[] = JSON.parse(match[0]);
    return articles.map((a, idx) => {
      const t = translated.find(x => x.i === idx);
      return { title_cs: t?.title_cs ?? a.title, summary_cs: t?.summary_cs ?? a.description,
               title_en: a.title, link: a.link, pubDate: a.pubDate, source: a.source, focus: a.focus, image: a.image };
    });
  } catch (err) {
    console.error("[news/translate] batch failed:", err);
    return articles.map(a => ({ title_cs: a.title, summary_cs: a.description,
      title_en: a.title, link: a.link, pubDate: a.pubDate, source: a.source, focus: a.focus, image: a.image }));
  }
}

async function translateAll(articles: RawArticle[]): Promise<NewsArticle[]> {
  const ANTHROPIC_KEY = getKeys().anthropic;
  console.log("[news/translate] key present:", !!ANTHROPIC_KEY, "articles:", articles.length);
  const fallback = articles.map(a => ({ title_cs: a.title, summary_cs: a.description,
    title_en: a.title, link: a.link, pubDate: a.pubDate, source: a.source, focus: a.focus, image: a.image }));
  if (!ANTHROPIC_KEY || articles.length === 0) return fallback;
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
  // Translate in parallel batches of 15
  const SIZE = 15;
  const batches: RawArticle[][] = [];
  for (let i = 0; i < articles.length; i += SIZE) batches.push(articles.slice(i, i + SIZE));
  const results = await Promise.all(batches.map(b => translateBatch(b, client)));
  return results.flat();
}

async function fetchTMDBTrending(): Promise<NewsArticle[]> {
  const { tmdb: TMDB_KEY } = getKeys();
  if (!TMDB_KEY) return [];
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_KEY}&language=cs`,
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

export async function GET() {
  // All RSS + TMDB trending in parallel, each with its own timeout
  const [rssResults, trending] = await Promise.all([
    Promise.all(RSS_SOURCES.map(fetchRSS)),
    fetchTMDBTrending(),
  ]);

  const allArticles = rssResults.flat()
    .filter(a => a.title && a.link)
    .sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return db - da;
    })
    .slice(0, 35); // keep top 35 for translation speed

  const articles = await translateAll(allArticles);

  return NextResponse.json({ articles, trending });
}
