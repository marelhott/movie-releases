import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import Anthropic from "@anthropic-ai/sdk";

const TMDB_KEY = process.env.TMDB_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const RSS_SOURCES = [
  { url: "https://www.indiewire.com/c/film/feed/", name: "IndieWire", focus: "indie & arthouse" },
  { url: "https://deadline.com/category/film/feed/", name: "Deadline", focus: "Hollywood & byznys" },
  { url: "https://www.rogerebert.com/feed.xml", name: "RogerEbert.com", focus: "recenze & kritiky" },
  { url: "https://filmschoolrejects.com/feed/", name: "Film School Rejects", focus: "indie & analýzy" },
  { url: "https://www.slashfilm.com/feed/", name: "/Film", focus: "novinky & teasery" },
  { url: "https://variety.com/v/film/feed/", name: "Variety", focus: "průmysl & premiéry" },
  { url: "https://www.hollywoodreporter.com/c/movies/feed/", name: "Hollywood Reporter", focus: "byznys & premiéry" },
  { url: "https://pitchfork.com/news/feed/rss", name: "Pitchfork Film", focus: "hudba ve filmu" },
  { url: "https://www.empireonline.com/movies/news/rss/", name: "Empire", focus: "recenze & preview" },
  { url: "https://collider.com/feed/", name: "Collider", focus: "trailer & novinky" },
  { url: "https://screenrant.com/feed/", name: "Screen Rant", focus: "novinky & listy" },
  { url: "https://www.theguardian.com/film/rss", name: "The Guardian Film", focus: "kritiky & eseje" },
];

interface RawArticle {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  focus: string;
  image?: string;
}

interface NewsArticle {
  title_cs: string;
  summary_cs: string;
  title_en: string;
  link: string;
  pubDate: string;
  source: string;
  focus: string;
  image?: string;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function extractImage(item: any): string | undefined {
  // Try media:content
  const mc = item["media:content"];
  if (mc?.["@_url"]) return mc["@_url"];
  if (Array.isArray(mc)) return mc[0]?.["@_url"];

  // Try media:thumbnail
  const mt = item["media:thumbnail"];
  if (mt?.["@_url"]) return mt["@_url"];

  // Try enclosure
  const enc = item.enclosure;
  if (enc?.["@_url"] && enc?.["@_type"]?.startsWith("image")) return enc["@_url"];

  // Try og image in description
  const desc = item.description ?? "";
  const imgMatch = desc.match(/<img[^>]+src="([^"]+)"/i);
  return imgMatch?.[1];
}

async function fetchRSS(source: (typeof RSS_SOURCES)[0]): Promise<RawArticle[]> {
  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MovieBot/1.0)" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = parser.parse(xml);
    const items = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];
    const arr = Array.isArray(items) ? items : [items];

    return arr.slice(0, 10).map((item: any) => ({
      title: stripHtml(item.title ?? ""),
      link: item.link?.["@_href"] ?? item.link ?? "",
      pubDate: item.pubDate ?? item.updated ?? item.published ?? "",
      description: stripHtml(item.description ?? item.summary ?? item.content ?? ""),
      source: source.name,
      focus: source.focus,
      image: extractImage(item),
    }));
  } catch {
    return [];
  }
}

async function translateWithClaude(articles: RawArticle[]): Promise<NewsArticle[]> {
  if (!ANTHROPIC_KEY || articles.length === 0) {
    return articles.map((a) => ({
      title_cs: a.title,
      summary_cs: a.description,
      title_en: a.title,
      link: a.link,
      pubDate: a.pubDate,
      source: a.source,
      focus: a.focus,
      image: a.image,
    }));
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_KEY });

  const payload = articles.map((a, i) => ({
    i,
    title: a.title,
    summary: a.description,
  }));

  const prompt = `Přelož tato filmová zpravodajská shrnutí do češtiny. Zachovej filmový styl, používej správnou českou terminologii. Vrať POUZE validní JSON pole objektů s klíči "i", "title_cs", "summary_cs". Žádný jiný text.

${JSON.stringify(payload)}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON");

    const translated: { i: number; title_cs: string; summary_cs: string }[] = JSON.parse(
      jsonMatch[0]
    );

    return articles.map((a, idx) => {
      const t = translated.find((x) => x.i === idx);
      return {
        title_cs: t?.title_cs ?? a.title,
        summary_cs: t?.summary_cs ?? a.description,
        title_en: a.title,
        link: a.link,
        pubDate: a.pubDate,
        source: a.source,
        focus: a.focus,
        image: a.image,
      };
    });
  } catch {
    return articles.map((a) => ({
      title_cs: a.title,
      summary_cs: a.description,
      title_en: a.title,
      link: a.link,
      pubDate: a.pubDate,
      source: a.source,
      focus: a.focus,
      image: a.image,
    }));
  }
}

async function fetchTMDBTrending(): Promise<NewsArticle[]> {
  if (!TMDB_KEY) return [];

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
    image: m.backdrop_path
      ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}`
      : m.poster_path
      ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
      : undefined,
  }));
}

export async function GET() {
  // Fetch all RSS sources in parallel
  const rssResults = await Promise.all(RSS_SOURCES.map(fetchRSS));
  const allArticles = rssResults.flat();

  // Sort by date, take top 30
  allArticles.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  const topArticles = allArticles.slice(0, 60);

  // Translate + fetch TMDB trending in parallel
  const [translated, trending] = await Promise.all([
    translateWithClaude(topArticles),
    fetchTMDBTrending(),
  ]);

  return NextResponse.json({ articles: translated, trending });
}
