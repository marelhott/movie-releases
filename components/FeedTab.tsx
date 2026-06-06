"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";

export type FeedCategory = "ai" | "tech";

type FeedArticle = {
  id: string;
  title: string;
  title_cs?: string;
  summary: string;
  summary_cs?: string;
  url: string;
  image: string | null;
  source: string;
  publishedAt: string;
};

type FeedCache = {
  articles: FeedArticle[];
  hydrated: boolean;
  fetchedAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;

function makeCache(): FeedCache {
  return { articles: [], hydrated: false, fetchedAt: 0 };
}

const caches: Record<FeedCategory, FeedCache> = {
  ai: makeCache(),
  tech: makeCache(),
};

function storageKey(category: FeedCategory) {
  return `movie-releases:feed-${category}:v1`;
}

function timeAgo(value: string) {
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true, locale: cs });
  } catch {
    return "";
  }
}

function FeedCard({ article }: { article: FeedArticle }) {
  const title = article.title_cs ?? article.title;
  const body = article.summary_cs ?? article.summary;

  return (
    <article
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl bg-[color:var(--surface)] transition-all duration-150 hover:shadow-[0_4px_24px_rgba(39,26,0,0.10)]"
      onClick={() => window.open(article.url, "_blank", "noopener,noreferrer")}
    >
      {/* 16:9 image */}
      <div
        className="relative w-full overflow-hidden bg-[color:var(--surface-muted)]"
        style={{ aspectRatio: "16/9" }}
      >
        {article.image ? (
          <img
            src={article.image}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[color:var(--faint)]">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        <h3
          className="line-clamp-2 text-[0.9rem] font-medium leading-[1.35] text-[color:var(--foreground)] transition-colors group-hover:text-[color:var(--accent)]"
          style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
        >
          {title}
        </h3>
        {body && (
          <p className="line-clamp-3 flex-1 text-[0.8125rem] leading-[1.5] text-[color:var(--muted)]">
            {body}
          </p>
        )}
        {/* Meta row */}
        <div className="mt-auto flex items-center gap-1.5 pt-1 text-[11px] font-medium text-[color:var(--muted)]">
          <span className="truncate">{article.source}</span>
          <span className="opacity-40">·</span>
          <span className="flex-shrink-0">{timeAgo(article.publishedAt)}</span>
        </div>
      </div>
    </article>
  );
}

export default function FeedTab({ category }: { category: FeedCategory }) {
  const cache = caches[category];
  const [articles, setArticles] = useState<FeedArticle[]>(cache.articles);
  const [loading, setLoading] = useState(!cache.hydrated);
  const [error, setError] = useState<string | null>(null);

  const load = useEffectEvent(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/feed/${category}${forceRefresh ? "?refresh=1" : ""}`;
      const res = await fetch(url, { cache: forceRefresh ? "no-store" : "default" });
      if (!res.ok) throw new Error("Chyba při načítání");
      const data = await res.json();
      const items: FeedArticle[] = data.articles ?? [];
      setArticles(items);
      cache.articles = items;
      cache.hydrated = true;
      cache.fetchedAt = Date.now();
      try {
        localStorage.setItem(storageKey(category), JSON.stringify({ articles: items, hydrated: true, fetchedAt: cache.fetchedAt }));
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neznámá chyba");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    // Restore from localStorage
    try {
      const stored = localStorage.getItem(storageKey(category));
      if (stored) {
        const parsed = JSON.parse(stored) as FeedCache;
        if (parsed.articles?.length) {
          cache.articles = parsed.articles;
          cache.hydrated = true;
          cache.fetchedAt = parsed.fetchedAt;
          setArticles(parsed.articles);
          setLoading(false);
        }
      }
    } catch {}

    if (cache.hydrated && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return;
    void load();

    const interval = window.setInterval(() => {
      if (Date.now() - cache.fetchedAt < CACHE_TTL_MS) return;
      void load(true);
    }, 60_000);

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - cache.fetchedAt < CACHE_TTL_MS) return;
      void load(true);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load, category]);

  const refresh = useEffectEvent(() => {
    cache.hydrated = false;
    cache.articles = [];
    cache.fetchedAt = 0;
    try { localStorage.removeItem(storageKey(category)); } catch {}
    setArticles([]);
    void load(true);
  });

  const heading = category === "ai" ? "Umělá inteligence" : "Technologie";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2
          className="text-[1.1rem] font-semibold text-[color:var(--foreground)]"
          style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
        >
          {heading}
          {articles.length > 0 && (
            <span className="ml-2 text-[0.85rem] font-normal text-[color:var(--muted)]">
              {articles.length} článků
            </span>
          )}
        </h2>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-muted)] disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Aktualizovat
        </button>
      </div>

      {error && <div className="py-12 text-center text-red-400">{error}</div>}

      <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {articles.map(article => (
          <FeedCard key={article.id} article={article} />
        ))}
        {loading && Array.from({ length: 8 }).map((_, i) => (
          <div key={`sk-${i}`} className="overflow-hidden rounded-xl bg-[color:var(--surface)]">
            <div className="aspect-video w-full animate-pulse bg-[color:var(--surface-muted)]" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-[color:var(--surface-muted)]" />
              <div className="h-3 w-full animate-pulse rounded bg-[color:var(--surface-muted)]" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-[color:var(--surface-muted)]" />
            </div>
          </div>
        ))}
      </div>

      {!loading && articles.length === 0 && !error && (
        <div className="py-16 text-center text-[color:var(--muted)]">Žádné články k zobrazení</div>
      )}

      {loading && articles.length > 0 && (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[color:var(--muted)]" />
        </div>
      )}
    </div>
  );
}
