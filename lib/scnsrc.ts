export interface ScnRelease {
  title: string;
  category: string;
  size: string;
  date: string;
  url: string;
  quality: string;
  source: "scnsrc";
}

// Parse scene release name into readable title + quality
function parseReleaseName(name: string): { title: string; year: string; quality: string } {
  // e.g. "Movie.Title.2024.1080p.BluRay.x264"
  const qualityMatch = name.match(/(2160p|1080p|720p|480p|4K|UHD|BluRay|WEB-DL|WEBRip|HDTV|DVDRip)/i);
  const quality = qualityMatch?.[0] ?? "";
  const yearMatch = name.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch?.[0] ?? "";

  let title = name;
  if (year) title = title.split(year)[0];
  title = title.replace(/\./g, " ").replace(/_/g, " ").trim();

  return { title, year, quality };
}

export async function fetchScnsrc(): Promise<ScnRelease[]> {
  try {
    const res = await fetch("https://www.scnsrc.me/category/movies/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      next: { revalidate: 1800 },
    });

    if (!res.ok) return [];
    const html = await res.text();

    const releases: ScnRelease[] = [];

    // Parse article entries
    const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
    let articleMatch;

    while ((articleMatch = articleRegex.exec(html)) !== null) {
      const block = articleMatch[1];

      const titleMatch = block.match(/<h\d[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
      if (!titleMatch) continue;

      const url = titleMatch[1];
      const rawTitle = titleMatch[2].trim();

      const dateMatch = block.match(/<time[^>]*datetime="([^"]+)"/i);
      const catMatch = block.match(/category[^"]*"[^"]*"[^>]*>([^<]+)</i);

      const { title, year, quality } = parseReleaseName(rawTitle);

      // Filter only movie-like entries
      if (!rawTitle || rawTitle.length < 3) continue;

      releases.push({
        title: title || rawTitle,
        category: catMatch?.[1]?.trim() ?? "Movie",
        size: "",
        date: dateMatch?.[1] ?? new Date().toISOString(),
        url,
        quality,
        source: "scnsrc",
      });

      if (releases.length >= 20) break;
    }

    return releases;
  } catch {
    return [];
  }
}
