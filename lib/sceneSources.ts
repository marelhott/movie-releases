export interface SceneRelease {
  title: string;
  year: number;
  quality: string;
  group: string;
  date: string;
  size: number;
  imdbId: string | null;
  source: string;
  url?: string | null;
  releaseName?: string | null;
}

function parseReleaseName(name: string) {
  const yearMatch = name.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? parseInt(yearMatch[0]) : 0;
  const qualityMatch = name.match(/(2160p|1080p|720p|480p|4K|UHD)/i);
  const quality = qualityMatch?.[0] ?? "";
  const groupMatch = name.match(/-([A-Z0-9]+)$/i);
  const group = groupMatch?.[1] ?? "";
  let title = name;
  if (year) title = title.split(String(year))[0];
  title = title.replace(/\./g, " ").replace(/_/g, " ").trim();
  return { title, year, quality, group };
}

// srrdb.com RSS feed — latest scene releases
export async function fetchSrrdb(): Promise<SceneRelease[]> {
  try {
    const res = await fetch("https://www.srrdb.com/feed/srrs", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MovieBot/1.0)" },
      next: { revalidate: 900 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: SceneRelease[] = [];
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const block = m[1];
      const titleMatch = block.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/) ||
                         block.match(/<title>([^<]+)<\/title>/);
      const dateMatch = block.match(/<pubDate>([^<]+)<\/pubDate>/);
      const linkMatch = block.match(/<link>([^<]+)<\/link>/);
      if (!titleMatch) continue;
      const raw = titleMatch[1].trim();
      // Skip non-movie categories (TV, music, etc.)
      if (/S\d{2}E\d{2}|\.EP\.|SEASON|DISC\d/i.test(raw)) continue;
      // Only video releases
      if (!/(x264|x265|HEVC|BluRay|WEB-DL|WEBRip|HDRip|DVDRip|2160p|1080p|720p)/i.test(raw)) continue;
      const { title, year, quality, group } = parseReleaseName(raw);
      if (!title || title.length < 3) continue;
      items.push({
        title, year, quality, group,
        date: dateMatch?.[1] ?? new Date().toISOString(),
        size: 0,
        imdbId: null,
        source: "srrdb",
        url: linkMatch?.[1] ?? null,
        releaseName: raw,
      });
      if (items.length >= 20) break;
    }
    return items;
  } catch { return []; }
}

// predb.me — scene pre database
export async function fetchPredb(): Promise<SceneRelease[]> {
  try {
    const res = await fetch("https://predb.me/rss.php?cats=MOVIE", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MovieBot/1.0)" },
      next: { revalidate: 900 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: SceneRelease[] = [];
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const block = m[1];
      const titleMatch = block.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/) ||
                         block.match(/<title>([^<]+)<\/title>/);
      const dateMatch = block.match(/<pubDate>([^<]+)<\/pubDate>/);
      const linkMatch = block.match(/<link>([^<]+)<\/link>/);
      if (!titleMatch) continue;
      const raw = titleMatch[1].trim();
      const { title, year, quality, group } = parseReleaseName(raw);
      if (!title || title.length < 3) continue;
      items.push({
        title, year, quality, group,
        date: dateMatch?.[1] ?? new Date().toISOString(),
        size: 0,
        imdbId: null,
        source: "predb",
        url: linkMatch?.[1] ?? null,
        releaseName: raw,
      });
      if (items.length >= 20) break;
    }
    return items;
  } catch { return []; }
}

// scnsrc.me — scene news site scraping
export async function fetchScnsrcScene(): Promise<SceneRelease[]> {
  try {
    const res = await fetch("https://www.scnsrc.me/category/movies/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const items: SceneRelease[] = [];
    const articleRe = /<article[^>]*>([\s\S]*?)<\/article>/gi;
    let match;
    while ((match = articleRe.exec(html)) !== null) {
      const block = match[1];
      const titleMatch = block.match(/<h\d[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
      const dateMatch = block.match(/<time[^>]*datetime="([^"]+)"/i);
      if (!titleMatch) continue;
      const raw = titleMatch[2].trim();
      const { title, year, quality, group } = parseReleaseName(raw);
      if (!title || title.length < 3) continue;
      items.push({
        title, year, quality, group,
        date: dateMatch?.[1] ?? new Date().toISOString(),
        size: 0,
        imdbId: null,
        source: "scnsrc",
        url: titleMatch[1] ?? null,
        releaseName: raw,
      });
      if (items.length >= 15) break;
    }
    return items;
  } catch { return []; }
}
