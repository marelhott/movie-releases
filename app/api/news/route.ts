import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import Anthropic from "@anthropic-ai/sdk";
import { unstable_cache } from "next/cache";

export const dynamic = "auto";
export const maxDuration = 60;

const RSS_ITEMS_PER_SOURCE = 18;
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 30;
const RAW_NEWS_LIMIT = 120;
const OG_IMAGE_FALLBACK_LIMIT = 10;
const CLAUDE_BATCH_SIZE = 10;
const ALLOWED_PERSON_DEPARTMENTS = new Set(["Acting", "Directing"]);
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "...",
  lt: "<",
  nbsp: " ",
  quot: "\"",
};

const getKeys = () => ({
  tmdb: process.env.TMDB_API_KEY,
  anthropic: process.env.MOVIE_ANTHROPIC_KEY,
});

const RSS_SOURCES = [
  { url: "https://deadline.com/v/film/feed/", name: "Deadline", focus: "breaking news, castingy & box office", lang: "en" },
  { url: "https://variety.com/c/film/feed/", name: "Variety", focus: "průmysl & business", lang: "en" },
  { url: "https://www.hollywoodreporter.com/c/movies/movie-news/feed/", name: "Hollywood Reporter", focus: "festivaly, rozhovory & awards", lang: "en" },
  { url: "https://www.indiewire.com/c/film/feed/", name: "IndieWire", focus: "indie & autorský film", lang: "en" },
  { url: "https://www.moviezone.cz/rss/", name: "MovieZone.cz", focus: "české trailery & novinky", lang: "cs" },
  { url: "https://www.screendaily.com/1366.rss", name: "Screen Daily", focus: "evropský filmový byznys, festivaly & severské tituly", lang: "en" },
  { url: "https://www.filmneweurope.com/?format=feed&type=rss", name: "Film New Europe", focus: "nové evropské filmy & regionální produkce", lang: "en" },
] as const;

interface RawArticle {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  fullText: string;
  source: string;
  focus: string;
  image?: string;
  lang: string;
}

export interface PersonSnippet {
  id: number;
  name: string;
  photo: string | null;
  known_for: string;
  top_films: { title: string; year: number; poster: string | null }[];
}

export interface NewsArticle {
  title_cs: string;
  body_cs: string;
  title_en: string;
  link: string;
  pubDate: string;
  source: string;
  focus: string;
  image?: string;
  person?: PersonSnippet;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "__cdata",
});

function decodeHtmlEntities(input: string) {
  return String(input ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (_, named) => NAMED_ENTITIES[named.toLowerCase()] ?? `&${named};`);
}

function stripHtml(html: string, maxLen = 900): string {
  return decodeHtmlEntities(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
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

function extractImage(item: Record<string, unknown>): string | undefined {
  const mediaContent = item["media:content"];
  if (Array.isArray(mediaContent)) {
    const image = mediaContent.find((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const url = String((entry as Record<string, unknown>)["@_url"] ?? "");
      const medium = String((entry as Record<string, unknown>)["@_medium"] ?? "");
      return Boolean(url) && (medium === "image" || /\.(jpe?g|png|webp)/i.test(url));
    }) as Record<string, unknown> | undefined;
    if (image?.["@_url"]) return String(image["@_url"]);
  } else if (mediaContent && typeof mediaContent === "object" && (mediaContent as Record<string, unknown>)["@_url"]) {
    return String((mediaContent as Record<string, unknown>)["@_url"]);
  }

  const thumbnail = item["media:thumbnail"];
  if (Array.isArray(thumbnail)) {
    const first = thumbnail[0] as Record<string, unknown> | undefined;
    if (first?.["@_url"]) return String(first["@_url"]);
  } else if (thumbnail && typeof thumbnail === "object" && (thumbnail as Record<string, unknown>)["@_url"]) {
    return String((thumbnail as Record<string, unknown>)["@_url"]);
  }

  const enclosure = item.enclosure;
  if (enclosure && typeof enclosure === "object") {
    const entry = enclosure as Record<string, unknown>;
    if (String(entry["@_type"] ?? "").startsWith("image") && entry["@_url"]) return String(entry["@_url"]);
  }

  const itunesImage = item["itunes:image"];
  if (itunesImage && typeof itunesImage === "object" && (itunesImage as Record<string, unknown>)["@_href"]) {
    return String((itunesImage as Record<string, unknown>)["@_href"]);
  }

  for (const raw of [
    item["content:encoded"],
    item.description,
    item.summary,
  ]) {
    const source = typeof raw === "object" && raw !== null
      ? String((raw as Record<string, unknown>).__cdata ?? raw)
      : String(raw ?? "");
    if (!source) continue;
    const match = source.match(/<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp)[^"']*?)["']/i);
    if (match?.[1]?.startsWith("http") && !match[1].includes("pixel") && !match[1].includes("1x1")) return match[1];
  }
}

async function fetchRSS(source: typeof RSS_SOURCES[number]): Promise<RawArticle[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FilmBot/1.0)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const xml = await res.text();
    const parsed = parser.parse(xml) as {
      rss?: { channel?: { item?: Record<string, unknown>[] | Record<string, unknown> } };
      feed?: { entry?: Record<string, unknown>[] | Record<string, unknown> };
    };

    const items = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];
    const entries = Array.isArray(items) ? items : [items];

    return entries.slice(0, RSS_ITEMS_PER_SOURCE).map((item) => {
      const titleRaw = typeof item.title === "object" && item.title !== null
        ? String((item.title as Record<string, unknown>).__cdata ?? item.title)
        : String(item.title ?? "");
      const descriptionRaw = typeof item.description === "object" && item.description !== null
        ? String((item.description as Record<string, unknown>).__cdata ?? item.description)
        : String(item.description ?? item.summary ?? "");
      const fullTextRaw = typeof item["content:encoded"] === "object" && item["content:encoded"] !== null
        ? String((item["content:encoded"] as Record<string, unknown>).__cdata ?? item["content:encoded"])
        : String(item["content:encoded"] ?? descriptionRaw);
      const linkValue = item.link;
      const link = typeof linkValue === "string"
        ? linkValue
        : typeof linkValue === "object" && linkValue !== null
          ? String((linkValue as Record<string, unknown>)["@_href"] ?? (linkValue as Record<string, unknown>)["#text"] ?? "")
          : "";

      return {
        title: stripHtml(titleRaw, 220),
        link,
        pubDate: String(item.pubDate ?? item.updated ?? item.published ?? ""),
        description: stripHtml(descriptionRaw, 450),
        fullText: stripHtml(fullTextRaw, 1200),
        source: source.name,
        focus: source.focus,
        lang: source.lang,
        image: extractImage(item),
      };
    }).filter((article) => article.title && article.link);
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

function deduplicate(articles: RawArticle[]): RawArticle[] {
  const seen = new Set<string>();
  return articles.filter((article) => {
    const key = decodeHtmlEntities(article.title)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .split(" ")
      .filter((word) => word.length > 3)
      .slice(0, 7)
      .join(" ");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchOGImage(url: string): Promise<string | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Googlebot/2.1" },
    });
    clearTimeout(timeout);
    if (!res.ok) return undefined;
    const html = await res.text();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    return match?.[1]?.startsWith("http") ? decodeHtmlEntities(match[1]) : undefined;
  } catch {
    clearTimeout(timeout);
    return undefined;
  }
}

async function findPersonByName(name: string, tmdbKey: string): Promise<PersonSnippet | null> {
  try {
    const searchRes = await fetch(
      `https://api.themoviedb.org/3/search/person?api_key=${tmdbKey}&query=${encodeURIComponent(name)}&language=cs`,
      { next: { revalidate: 86400 } }
    );
    const searchData = await searchRes.json() as { results?: Array<Record<string, unknown>> };
    const person = searchData.results?.[0];
    if (!person) return null;
    if (!ALLOWED_PERSON_DEPARTMENTS.has(String(person.known_for_department ?? ""))) return null;

    const creditsRes = await fetch(
      `https://api.themoviedb.org/3/person/${person.id}/movie_credits?api_key=${tmdbKey}&language=cs`,
      { next: { revalidate: 86400 } }
    );
    const credits = await creditsRes.json() as {
      crew?: Array<Record<string, unknown>>;
      cast?: Array<Record<string, unknown>>;
    };

    const seenFilmIds = new Set<number>();
    const topFilms = [...(credits.crew ?? []).filter((entry) => entry.job === "Director"), ...(credits.cast ?? [])]
      .sort((a, b) => Number(b.vote_count ?? 0) - Number(a.vote_count ?? 0))
      .filter((film) => {
        const id = Number(film.id ?? 0);
        if (!id || seenFilmIds.has(id)) return false;
        seenFilmIds.add(id);
        return true;
      })
      .slice(0, 5)
      .map((film) => ({
        title: String(film.title ?? film.original_title ?? ""),
        year: film.release_date ? parseInt(String(film.release_date), 10) : 0,
        poster: film.poster_path ? `https://image.tmdb.org/t/p/w185${String(film.poster_path)}` : null,
      }));

    return {
      id: Number(person.id),
      name: String(person.name ?? ""),
      photo: person.profile_path ? `https://image.tmdb.org/t/p/w185${String(person.profile_path)}` : null,
      known_for: String(person.known_for_department ?? ""),
      top_films: topFilms,
    };
  } catch {
    return null;
  }
}

const getCachedPersonByName = unstable_cache(
  async (name: string, tmdbKey: string) => findPersonByName(name, tmdbKey),
  ["news-person-by-name-v2"],
  { revalidate: 86400 }
);

async function translateSingleArticle(article: RawArticle, client: Anthropic, tmdbKey: string): Promise<NewsArticle> {
  const prompt = `Jsi filmový redaktor pro českou filmovou komunitu.

Přelož a přepiš následující filmovou zprávu do češtiny.
- "title_cs": český nadpis, max 12 slov, žádná angličtina, žádné HTML entity
- "body_cs": 3-5 vět v češtině, novinářský styl, přirozená a idiomatická čeština, správná diakritika, žádné HTML entity
- "person_name": pokud jde primárně o herce nebo režiséra, vrať celé jméno v angličtině, jinak null

Vrať POUZE validní JSON objekt se strukturou {"title_cs":"","body_cs":"","person_name":null}

${JSON.stringify({
  title: article.title,
  text: article.fullText || article.description,
  source: article.source,
  lang: article.lang,
})}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const cleaned = raw.replace(/```(?:json)?\n?/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) as { title_cs?: string; body_cs?: string; person_name?: string | null } : null;
    const person = parsed?.person_name ? await getCachedPersonByName(parsed.person_name, tmdbKey) : undefined;

    return {
      title_cs: decodeHtmlEntities(parsed?.title_cs?.trim() || article.title),
      body_cs: decodeHtmlEntities(parsed?.body_cs?.trim() || buildFallbackBody(article)),
      title_en: article.title,
      link: article.link,
      pubDate: article.pubDate,
      source: article.source,
      focus: article.focus,
      image: article.image,
      person: person ?? undefined,
    };
  } catch {
    return {
      title_cs: article.title,
      body_cs: buildFallbackBody(article),
      title_en: article.title,
      link: article.link,
      pubDate: article.pubDate,
      source: article.source,
      focus: article.focus,
      image: article.image,
    };
  }
}

async function generateArticleBatch(articles: RawArticle[], client: Anthropic, tmdbKey: string): Promise<NewsArticle[]> {
  const payload = articles.map((article, index) => ({
    i: index,
    title: article.title,
    text: article.fullText || article.description,
    source: article.source,
    lang: article.lang,
  }));

  const prompt = `Jsi filmový redaktor pro českou filmovou komunitu.

Pro každou položku vrať:
- "title_cs": český nadpis, max 12 slov, bez angličtiny a bez HTML entit
- "body_cs": 3-5 vět v češtině, novinářský styl, přirozená a idiomatická čeština, správná diakritika, bez HTML entit
- "person_name": pokud je hlavním tématem konkrétní herec nebo režisér, vrať celé jméno v angličtině, jinak null

Nepiš markdown ani komentář. Vrať POUZE validní JSON pole s klíči "i","title_cs","body_cs","person_name".

${JSON.stringify(payload)}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2800,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const cleaned = raw.replace(/```(?:json)?\n?/g, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Missing JSON array");

    const generated = JSON.parse(match[0]) as Array<{
      i: number;
      title_cs?: string;
      body_cs?: string;
      person_name?: string | null;
    }>;

    const byIndex = new Map(generated.map((entry) => [entry.i, entry]));
    const personResults = await Promise.all(
      articles.map((_, index) => {
        const personName = byIndex.get(index)?.person_name;
        return personName ? getCachedPersonByName(personName, tmdbKey) : Promise.resolve(null);
      })
    );

    return articles.map((article, index) => {
      const generatedArticle = byIndex.get(index);
      return {
        title_cs: decodeHtmlEntities(generatedArticle?.title_cs?.trim() || article.title),
        body_cs: decodeHtmlEntities(generatedArticle?.body_cs?.trim() || buildFallbackBody(article)),
        title_en: article.title,
        link: article.link,
        pubDate: article.pubDate,
        source: article.source,
        focus: article.focus,
        image: article.image,
        person: personResults[index] ?? undefined,
      };
    });
  } catch {
    return Promise.all(articles.map((article) => translateSingleArticle(article, client, tmdbKey)));
  }
}

const getRawNewsFeed = unstable_cache(
  async () => {
    const rssResults = await Promise.all(RSS_SOURCES.map(fetchRSS));
    return deduplicate(
      rssResults.flat()
        .filter((article) => article.title && article.link)
        .sort((a, b) => {
          const left = a.pubDate ? new Date(a.pubDate).getTime() : 0;
          const right = b.pubDate ? new Date(b.pubDate).getTime() : 0;
          return right - left;
        })
    ).slice(0, RAW_NEWS_LIMIT);
  },
  ["raw-news-feed-v3"],
  { revalidate: 1800 }
);

const getCachedNewsPage = unstable_cache(
  async (page: number, pageSize: number) => {
    const { tmdb, anthropic } = getKeys();
    const allArticles = await getRawNewsFeed();
    const start = Math.max(0, (page - 1) * pageSize);
    const pageItems = allArticles.slice(start, start + pageSize).map((article) => ({ ...article }));
    const hasMore = start + pageSize < allArticles.length;

    const missingImages = pageItems.filter((article) => !article.image).slice(0, OG_IMAGE_FALLBACK_LIMIT);
    const ogImages = await Promise.all(missingImages.map((article) => fetchOGImage(article.link)));
    missingImages.forEach((article, index) => {
      if (ogImages[index]) article.image = ogImages[index];
    });

    let articles: NewsArticle[] = pageItems.map((article) => ({
      title_cs: article.title,
      body_cs: buildFallbackBody(article),
      title_en: article.title,
      link: article.link,
      pubDate: article.pubDate,
      source: article.source,
      focus: article.focus,
      image: article.image,
    }));

    if (anthropic && tmdb) {
      const client = new Anthropic({ apiKey: anthropic });
      const batches: RawArticle[][] = [];
      for (let index = 0; index < pageItems.length; index += CLAUDE_BATCH_SIZE) {
        batches.push(pageItems.slice(index, index + CLAUDE_BATCH_SIZE));
      }
      const translated = await Promise.all(batches.map((batch) => generateArticleBatch(batch, client, tmdb)));
      articles = translated.flat();
    }

    return {
      articles,
      hasMore,
      page,
      pageSize,
      total: allArticles.length,
    };
  },
  ["news-page-v4"],
  { revalidate: 1800 }
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
  const data = await getCachedNewsPage(page, pageSize);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
  });
}
