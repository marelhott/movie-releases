import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { unstable_cache } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── Source lists ──────────────────────────────────────────────────────────────

const AI_SOURCES = [
  { name: "OpenAI Blog", url: "https://openai.com/news/rss.xml", siteUrl: "https://openai.com/news" },
  { name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", siteUrl: "https://deepmind.google/blog/" },
  { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", siteUrl: "https://huggingface.co/blog" },
  { name: "The Verge AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", siteUrl: "https://www.theverge.com/ai-artificial-intelligence" },
  { name: "MIT Tech Review AI", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/", siteUrl: "https://www.technologyreview.com/topic/artificial-intelligence/" },
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", siteUrl: "https://techcrunch.com/category/artificial-intelligence/" },
  { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/", siteUrl: "https://venturebeat.com/category/ai/" },
  { name: "The Decoder", url: "https://the-decoder.com/feed/", siteUrl: "https://the-decoder.com/" },
  { name: "Microsoft AI Blog", url: "https://blogs.microsoft.com/ai/feed/", siteUrl: "https://blogs.microsoft.com/ai/" },
  { name: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", siteUrl: "https://blog.google/technology/ai/" },
];

const TECH_SOURCES = [
  { name: "Hacker News", url: "https://news.ycombinator.com/rss", siteUrl: "https://news.ycombinator.com/" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", siteUrl: "https://arstechnica.com/" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", siteUrl: "https://www.theverge.com/" },
  { name: "The Register", url: "https://www.theregister.com/headlines.atom", siteUrl: "https://www.theregister.com/" },
  { name: "9to5Mac", url: "https://9to5mac.com/feed/", siteUrl: "https://9to5mac.com/" },
  { name: "Engadget", url: "https://www.engadget.com/rss.xml", siteUrl: "https://www.engadget.com/" },
  { name: "MacRumors", url: "https://www.macrumors.com/macrumors.xml", siteUrl: "https://www.macrumors.com/" },
  { name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", siteUrl: "https://www.bleepingcomputer.com/" },
  { name: "Tom's Hardware", url: "https://www.tomshardware.com/feeds/all", siteUrl: "https://www.tomshardware.com/" },
  { name: "IEEE Spectrum", url: "https://spectrum.ieee.org/rss/fulltext", siteUrl: "https://spectrum.ieee.org/" },
];

// ── RSS parser ────────────────────────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "...")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function extractImage(item: any): string | null {
  // media:content
  const mc = item["media:content"] ?? item["media:thumbnail"];
  if (mc) {
    const url = mc["@_url"] ?? mc?.["$"]?.url;
    if (typeof url === "string" && url.startsWith("http")) return url;
  }
  // enclosure
  if (item.enclosure?.["@_url"]) return item.enclosure["@_url"];
  if (item.enclosure?.url) return item.enclosure.url;
  // content/description — grab first img src
  const raw = item["content:encoded"] ?? item.content ?? item.description ?? "";
  const m = String(raw).match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m?.[1]) return m[1];
  return null;
}

async function fetchRss(source: { name: string; url: string; siteUrl: string }, limit = 8, fresh = false) {
  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)" },
      ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 1800 } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const text = await res.text();
    const parsed = xmlParser.parse(text);

    const channel = parsed?.rss?.channel ?? parsed?.feed ?? {};
    const rawItems: any[] = channel.item ?? channel.entry ?? [];
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];

    return items.slice(0, limit).map((item: any) => {
      const title = decodeEntities(String(item.title?.["#text"] ?? item.title ?? ""));
      const summary = decodeEntities(
        String(item["content:encoded"] ?? item.content?.["#text"] ?? item.content ?? item.description ?? "").slice(0, 300)
      );
      const link = item.link?.["@_href"] ?? item.link?.["#text"] ?? item.link ?? source.siteUrl;
      const pubDate = item.pubDate ?? item.updated ?? item.published ?? null;
      const image = extractImage(item);

      return {
        id: item.guid?.["#text"] ?? item.guid ?? item.id ?? link,
        title,
        summary,
        url: typeof link === "string" ? link.trim() : source.siteUrl,
        image,
        source: source.name,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      };
    }).filter((a: any) => a.title && a.url);
  } catch {
    return [];
  }
}

// ── OG image enrichment ───────────────────────────────────────────────────────

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)" },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // og:image
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (og?.[1]) return og[1];
    // twitter:image
    const tw = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (tw?.[1]) return tw[1];
    return null;
  } catch {
    return null;
  }
}

async function enrichImages(articles: any[]): Promise<any[]> {
  const missing = articles.filter(a => !a.image);
  // Enrich up to 20 articles without images, in parallel
  const enriched = await Promise.all(
    missing.slice(0, 20).map(async a => ({
      url: a.url,
      image: await fetchOgImage(a.url),
    }))
  );
  const imageMap = new Map(enriched.map(e => [e.url, e.image]));
  return articles.map(a => ({
    ...a,
    image: a.image ?? imageMap.get(a.url) ?? null,
  }));
}

// ── Translation ───────────────────────────────────────────────────────────────

async function translateBatch(articles: any[]): Promise<any[]> {
  const key = process.env.MOVIE_ANTHROPIC_KEY;
  if (!key) return articles;

  try {
    const client = new Anthropic({ apiKey: key });
    const toTranslate = articles.filter(a => a.title).slice(0, 20);

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `Přelož titulky a perex (summary) těchto zpráv do češtiny. Zachovej přesný smysl, piš přirozenou novinářskou češtinou se správnou diakritikou.

Vrať POUZE JSON pole ve formátu:
[{"title_cs":"...","summary_cs":"..."}]

Zprávy:
${JSON.stringify(toTranslate.map(a => ({ title: a.title, summary: a.summary })))}`,
      }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return articles;
    const translations: { title_cs: string; summary_cs: string }[] = JSON.parse(match[0]);

    return articles.map((a, i) => ({
      ...a,
      title_cs: translations[i]?.title_cs ?? a.title,
      summary_cs: translations[i]?.summary_cs ?? a.summary,
    }));
  } catch {
    return articles.map(a => ({ ...a, title_cs: a.title, summary_cs: a.summary }));
  }
}

// ── Build feed ────────────────────────────────────────────────────────────────

async function buildFeed(category: "ai" | "tech", fresh = false) {
  const sources = category === "ai" ? AI_SOURCES : TECH_SOURCES;

  const rawBatches = await Promise.all(sources.map(s => fetchRss(s, 6, fresh)));
  const allRaw = rawBatches.flat();

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = allRaw.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  // Sort by date desc, keep top 40
  const sorted = deduped
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 40);

  const withImages = await enrichImages(sorted);
  const translated = await translateBatch(withImages);
  return translated;
}

const getCachedFeed = unstable_cache(
  async (category: "ai" | "tech") => buildFeed(category),
  ["feed-category-v1"],
  { revalidate: 1800 }
);

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ category: string }> }
) {
  const { category } = await params;
  if (category !== "ai" && category !== "tech") {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }

  const forceRefresh = new URL(request.url).searchParams.has("refresh");
  const articles = forceRefresh
    ? await buildFeed(category, true)
    : await getCachedFeed(category);

  return NextResponse.json({ articles }, {
    headers: {
      "Cache-Control": forceRefresh
        ? "no-store"
        : "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
