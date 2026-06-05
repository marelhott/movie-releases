"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { RefreshCw, Loader2, Clapperboard, Film, X, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
import PersonModal from "./PersonModal";
import type { NewsArticle, NewsResponse, PersonSnippet as PersonSnippetData } from "@/types/news";

const PAGE_SIZE = 30;
const SOURCE_FILTERS = [
  "vse",
  "Deadline",
  "Variety",
  "Hollywood Reporter",
  "IndieWire",
  "Screen Daily",
  "Film New Europe",
  "MovieZone.cz",
] as const;

type NewsCache = {
  articles: NewsArticle[];
  page: number;
  hasMore: boolean;
  hydrated: boolean;
  fetchedAt: number;
};

const CACHE_TTL_MS = 15 * 60 * 1000;
const STORAGE_KEY = "movie-releases:news-cache:v1";

const newsCache: NewsCache = {
  articles: [],
  page: 0,
  hasMore: true,
  hydrated: false,
  fetchedAt: 0,
};

function localizeKnownFor(value: string) {
  switch (value) {
    case "Acting":
      return "Herectví";
    case "Directing":
      return "Režie";
    default:
      return value;
  }
}

function timeAgo(value: string) {
  if (!value) return "";
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true, locale: cs });
  } catch {
    return "";
  }
}

function PersonSnippet({
  person,
  onClickPerson,
}: {
  person: PersonSnippetData;
  onClickPerson: (id: number) => void;
}) {
  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onClickPerson(person.id);
      }}
      className="group mt-3 flex w-full items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[color:var(--surface-muted)] sm:gap-4 sm:px-5"
    >
      <div className="h-20 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-[color:var(--surface-muted)] shadow-sm">
        {person.photo ? (
          <img src={person.photo} alt={person.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[color:var(--muted)]">
            <Film className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold leading-tight text-[color:var(--foreground)] transition-colors group-hover:text-[color:var(--accent)] sm:text-[1.1rem]">
          {person.name}
        </p>
        <p className="mt-1 text-sm text-[color:var(--muted)]">{localizeKnownFor(person.known_for)}</p>
        {person.top_films.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {person.top_films.slice(0, 4).map((film, index) => (
              <div
                key={`${film.title}-${index}`}
                className="h-16 w-11 flex-shrink-0 overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-muted)] shadow-sm"
                title={`${film.title} (${film.year})`}
              >
                {film.poster ? (
                  <img
                    src={film.poster}
                    alt={film.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-[color:var(--muted)]">
                    {film.year}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <ChevronRight className="h-5 w-5 flex-shrink-0 text-[color:var(--muted)] transition-colors group-hover:text-[color:var(--accent)]" />
    </button>
  );
}

function ArticleModal({ article, onClose }: { article: NewsArticle; onClose: () => void }) {
  const [personId, setPersonId] = useState<number | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !personId) onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, personId]);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(29,42,36,0.28)] p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
        <div
          className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[1.75rem] border border-[color:var(--line)] bg-[color:var(--surface)] shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 z-10 rounded-full bg-white/85 p-1.5 text-[color:var(--foreground)] hover:bg-white"
          >
            <X className="h-5 w-5" />
          </button>

          {article.image && (
            <div className="h-44 w-full overflow-hidden rounded-t-[1.75rem] sm:h-56 sm:rounded-t-2xl">
              <img src={article.image} alt="" className="h-full w-full object-cover" />
            </div>
          )}

          <div className="p-4 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[color:var(--surface-muted)] px-2 py-0.5 text-xs font-medium text-[color:var(--foreground)]">
                {article.source}
              </span>
              <span className="text-xs text-[color:var(--muted)]">{article.focus}</span>
              {article.pubDate && <span className="text-xs text-[color:var(--muted)] sm:ml-auto">{timeAgo(article.pubDate)}</span>}
            </div>

            <h2 className="mb-3 text-lg font-bold leading-snug text-[color:var(--foreground)] sm:text-xl">{article.title_cs}</h2>
            <p className="text-sm leading-relaxed text-[color:var(--foreground)]">{article.body_cs}</p>

            {article.person && (
              <div className="mt-4">
                <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">O kom je řeč</p>
                <PersonSnippet person={article.person} onClickPerson={setPersonId} />
              </div>
            )}
          </div>
        </div>
      </div>
      {personId && <PersonModal personId={personId} onClose={() => setPersonId(null)} />}
    </>
  );
}

const SOURCE_BADGE: Record<string, string> = {
  "Deadline": "bg-red-900/80 text-red-300",
  "Film New Europe": "bg-cyan-900/80 text-cyan-300",
  "Hollywood Reporter": "bg-purple-900/80 text-purple-300",
  "IndieWire": "bg-blue-900/80 text-blue-300",
  "MovieZone.cz": "bg-emerald-900/80 text-emerald-300",
  "Screen Daily": "bg-amber-900/80 text-amber-300",
  "Variety": "bg-orange-900/80 text-orange-300",
};

function SourcePill({ article }: { article: NewsArticle }) {
  const badge = SOURCE_BADGE[article.source] ?? "bg-[rgba(255,253,248,0.88)] text-[color:var(--foreground)]";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur-sm ${badge}`}>{article.source}</span>;
}

function NewsHeroCard({ article, onClick }: { article: NewsArticle; onClick: () => void }) {
  const [personId, setPersonId] = useState<number | null>(null);

  return (
    <>
      <article
        className="group relative cursor-pointer overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--foreground)] text-white shadow-[0_22px_70px_rgba(17,26,22,0.14)]"
        onClick={onClick}
      >
        {article.image ? (
          <>
            <img
              src={article.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-88 transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,26,22,0.14)_0%,rgba(17,26,22,0.22)_34%,rgba(17,26,22,0.92)_100%)]" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,159,118,0.42),transparent_42%),linear-gradient(180deg,#203029_0%,#111a16_100%)]" />
        )}

        <div className="relative flex min-h-[29rem] flex-col justify-end p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-white/84">
            <SourcePill article={article} />
            <span>{article.category_label}</span>
            {article.cluster_size > 1 && <span>{article.cluster_size} zdroje</span>}
            {article.pubDate && <span className="sm:ml-auto">{timeAgo(article.pubDate)}</span>}
          </div>

          <h3 className="max-w-2xl text-3xl font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-[2.35rem]">
            {article.title_cs}
          </h3>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/82 sm:text-[0.98rem]">
            {article.body_cs}
          </p>

          {article.person && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                setPersonId(article.person!.id);
              }}
              className="mt-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/18 bg-white/8 px-3 py-2 text-xs text-white/92 backdrop-blur"
            >
              {article.person.photo && (
                <img
                  src={article.person.photo}
                  alt={article.person.name}
                  className="h-7 w-7 rounded-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              )}
              <span>{article.person.name}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </article>

      {personId && <PersonModal personId={personId} onClose={() => setPersonId(null)} />}
    </>
  );
}

function NewsHighlightCard({ article, onClick }: { article: NewsArticle; onClick: () => void }) {
  const [personId, setPersonId] = useState<number | null>(null);

  return (
    <>
      <article
        className="group flex cursor-pointer flex-col overflow-hidden rounded-[1.6rem] border border-[color:var(--line)] bg-white shadow-sm transition-transform duration-300 hover:-translate-y-0.5"
        onClick={onClick}
      >
        {article.image && (
          <div className="aspect-[16/10] overflow-hidden bg-[color:var(--surface-muted)]">
            <img
              src={article.image}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              loading="lazy"
              decoding="async"
            />
          </div>
        )}
        <div className="flex flex-1 flex-col p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] text-[color:var(--muted)]">
            <span className="font-medium text-[color:var(--foreground)]">{article.source}</span>
            <span>{article.category_label}</span>
          </div>
          <h3 className="text-xl font-semibold leading-[1.1] tracking-[-0.03em] text-[color:var(--foreground)]">
            {article.title_cs}
          </h3>
          <p className="mt-3 line-clamp-4 text-sm leading-6 text-[color:var(--muted)]">{article.body_cs}</p>
          {article.person && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                setPersonId(article.person!.id);
              }}
              className="mt-4 inline-flex items-center gap-2 text-xs text-[color:var(--muted)]"
            >
              {article.person.photo && (
                <img
                  src={article.person.photo}
                  alt={article.person.name}
                  className="h-7 w-7 rounded-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              )}
              <span>{article.person.name}</span>
            </button>
          )}
        </div>
      </article>

      {personId && <PersonModal personId={personId} onClose={() => setPersonId(null)} />}
    </>
  );
}

function NewsCard({ article, onClick }: { article: NewsArticle; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);
  const [personId, setPersonId] = useState<number | null>(null);
  const showHeroImage = Boolean(article.image && !imgError && article.image_quality !== "low");
  const showThumbImage = Boolean(article.image && !imgError && article.image_quality === "low");

  return (
    <>
      <article
        className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] shadow-sm transition-colors hover:bg-[color:var(--surface-muted)]"
        onClick={onClick}
        style={{ contentVisibility: "auto", containIntrinsicSize: "320px 420px" }}
      >
        {showHeroImage ? (
          <div className="relative aspect-[16/10] w-full flex-shrink-0 bg-[color:var(--surface-muted)]">
            <img
              src={article.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImgError(true)}
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(29,42,36,0.55)] via-[rgba(29,42,36,0.06)] to-transparent" />
            <div className="absolute bottom-2 left-2">
              <SourcePill article={article} />
            </div>
            {article.pubDate && (
              <span className="absolute right-2 top-2 rounded bg-white/80 px-1.5 py-0.5 text-xs text-[color:var(--foreground)] backdrop-blur-sm">
                {timeAgo(article.pubDate)}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-3">
            <span className="text-xs font-medium text-[color:var(--foreground)]">{article.source}</span>
            {article.pubDate && (
              <span className="text-xs text-[color:var(--muted)]">{timeAgo(article.pubDate)}</span>
            )}
          </div>
        )}

        <div className="flex flex-1 flex-col p-4">
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[color:var(--muted)]">
            <span>{article.category_label}</span>
            {article.cluster_size > 1 && <span>{article.cluster_size} zdroje</span>}
          </div>
          {showThumbImage ? (
            <div className="mb-3 flex gap-3">
              <div className="h-20 w-28 flex-shrink-0 overflow-hidden rounded-2xl bg-[color:var(--surface-muted)]">
                <img
                  src={article.image}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setImgError(true)}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold leading-snug text-[color:var(--foreground)] transition-colors group-hover:text-[color:var(--accent)] sm:text-lg">
                  {article.title_cs}
                </h3>
              </div>
            </div>
          ) : (
            <h3 className="mb-2 text-base font-semibold leading-snug text-[color:var(--foreground)] transition-colors group-hover:text-[color:var(--accent)] sm:text-lg">
              {article.title_cs}
            </h3>
          )}
          <p className="line-clamp-4 flex-1 text-sm leading-relaxed text-[color:var(--muted)]">{article.body_cs}</p>

          {article.person && (
            <div
              className="mt-3 flex items-center gap-2 border-t border-[color:var(--line)] pt-3"
              onClick={(event) => {
                event.stopPropagation();
                setPersonId(article.person!.id);
              }}
            >
              {article.person.photo && (
                <img
                  src={article.person.photo}
                  alt={article.person.name}
                  className="h-8 w-8 flex-shrink-0 rounded-full object-cover ring-1 ring-[color:var(--line)]"
                  loading="lazy"
                  decoding="async"
                />
              )}
              <span className="text-xs text-[color:var(--muted)] transition-colors hover:text-[color:var(--accent)]">
                {article.person.name}
              </span>
              <ChevronRight className="ml-auto h-3 w-3 text-[color:var(--muted)]" />
            </div>
          )}
        </div>
      </article>

      {personId && <PersonModal personId={personId} onClose={() => setPersonId(null)} />}
    </>
  );
}

export default function NewsTab() {
  const [articles, setArticles] = useState<NewsArticle[]>(newsCache.articles);
  const [page, setPage] = useState(newsCache.page);
  const [hasMore, setHasMore] = useState(newsCache.hasMore);
  const [loadingInitial, setLoadingInitial] = useState(!newsCache.hydrated);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("vse");
  const [selected, setSelected] = useState<NewsArticle | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const pendingPagesRef = useRef(new Set<number>());

  const loadPage = useEffectEvent(async (
    nextPage: number,
    mode: "replace" | "append",
    options?: { forceRefresh?: boolean }
  ) => {
    if (pendingPagesRef.current.has(nextPage)) return;

    pendingPagesRef.current.add(nextPage);
    if (mode === "replace") {
      setLoadingInitial(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const refreshSuffix = options?.forceRefresh ? `&refresh=${Date.now()}` : "";
      const res = await fetch(`/api/news?page=${nextPage}&pageSize=${PAGE_SIZE}${refreshSuffix}`, {
        cache: options?.forceRefresh ? "no-store" : "default",
      });
      if (!res.ok) throw new Error("Chyba načítání");
      const payload = await res.json() as NewsResponse;

      setArticles((current) => {
        if (mode === "replace") {
          newsCache.articles = payload.articles;
          return payload.articles;
        }
        const seen = new Set(current.map((article) => article.link));
        const merged = [...current, ...payload.articles.filter((article) => !seen.has(article.link))];
        newsCache.articles = merged;
        return merged;
      });
      setPage(payload.page);
      setHasMore(payload.hasMore);
      newsCache.page = payload.page;
      newsCache.hasMore = payload.hasMore;
      newsCache.hydrated = true;
      newsCache.fetchedAt = Date.now();

      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            articles: newsCache.articles,
            page: newsCache.page,
            hasMore: newsCache.hasMore,
            hydrated: newsCache.hydrated,
            fetchedAt: newsCache.fetchedAt,
          } satisfies NewsCache)
        );
      } catch {}

      if (payload.page === 1 && payload.hasMore) {
        window.setTimeout(() => {
          void fetch(`/api/news?page=2&pageSize=${PAGE_SIZE}`);
        }, 800);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chyba");
    } finally {
      pendingPagesRef.current.delete(nextPage);
      setLoadingInitial(false);
      setLoadingMore(false);
    }
  });

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as NewsCache;
        if (Array.isArray(parsed.articles) && parsed.articles.length > 0) {
          newsCache.articles = parsed.articles;
          newsCache.page = parsed.page;
          newsCache.hasMore = parsed.hasMore;
          newsCache.hydrated = true;
          newsCache.fetchedAt = parsed.fetchedAt;
          setArticles(parsed.articles);
          setPage(parsed.page);
          setHasMore(parsed.hasMore);
          setLoadingInitial(false);
        }
      }
    } catch {}

    if (newsCache.hydrated) return;
    void loadPage(1, "replace");
  }, [loadPage]);

  useEffect(() => {
    if (!newsCache.hydrated) return;
    if (Date.now() - newsCache.fetchedAt < CACHE_TTL_MS) return;
    if (newsCache.page !== 1) return;
    void loadPage(1, "replace");
  }, [loadPage]);

  const refresh = useEffectEvent(async () => {
    newsCache.articles = [];
    newsCache.page = 0;
    newsCache.hasMore = true;
    newsCache.hydrated = false;
    newsCache.fetchedAt = 0;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setArticles([]);
    setHasMore(true);
    setPage(0);
    void loadPage(1, "replace", { forceRefresh: true });
  });

  const loadNextPage = useEffectEvent(async () => {
    if (!hasMore || loadingInitial || loadingMore) return;
    void loadPage(page + 1, "append");
  });

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadNextPage();
        }
      },
      { rootMargin: "800px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadNextPage]);

  const filteredArticles = articles.filter((article) => filter === "vse" || article.source === filter);
  const featuredArticles = filter === "vse" ? filteredArticles.slice(0, 5) : [];
  const streamArticles = filter === "vse" ? filteredArticles.slice(5) : filteredArticles;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[color:var(--foreground)]">
          <Clapperboard className="h-5 w-5 text-[color:var(--accent)]" />
          Filmové novinky
          {articles.length > 0 && (
            <span className="text-sm font-normal text-[color:var(--muted)]">{filteredArticles.length} zpráv</span>
          )}
        </h2>

        <button
          onClick={() => void refresh()}
          disabled={loadingInitial || loadingMore}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-1.5 text-xs text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-muted)] disabled:opacity-50 sm:w-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingInitial || loadingMore ? "animate-spin" : ""}`} />
          Aktualizovat
        </button>
      </div>

      {SOURCE_FILTERS.length > 1 && (
        <div className="mb-5 -mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-5 border-b border-[color:var(--line)] pb-2">
            {SOURCE_FILTERS.map((source) => (
              <button
                key={source}
                onClick={() => setFilter(source)}
                className={`whitespace-nowrap border-b-2 pb-2 text-sm transition-colors ${
                  filter === source
                    ? "border-[color:var(--foreground)] font-semibold text-[color:var(--foreground)]"
                    : "border-transparent text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                }`}
              >
                {source === "vse" ? "vše" : source}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="py-12 text-center text-red-400">{error}</div>}

      {loadingInitial && articles.length === 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)]">
              <div className="aspect-[16/10] animate-pulse bg-[color:var(--surface-muted)]" />
              <div className="space-y-3 p-4">
                <div className="h-3 w-24 animate-pulse rounded bg-[color:var(--surface-muted)]" />
                <div className="h-6 w-full animate-pulse rounded bg-[color:var(--surface-muted)]" />
                <div className="h-4 w-full animate-pulse rounded bg-[color:var(--surface-muted)]" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-[color:var(--surface-muted)]" />
              </div>
            </div>
          ))}
        </div>
      )}

      {featuredArticles.length > 0 && (
        <section className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <NewsHeroCard article={featuredArticles[0]} onClick={() => setSelected(featuredArticles[0])} />
          <div className="grid gap-4 sm:grid-cols-2">
            {featuredArticles.slice(1).map((article) => (
              <NewsHighlightCard key={article.link} article={article} onClick={() => setSelected(article)} />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {streamArticles.map((article) => (
          <NewsCard key={article.link} article={article} onClick={() => setSelected(article)} />
        ))}
      </div>

      <div ref={sentinelRef} className="h-10" />

      {loadingMore && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-[color:var(--muted)]" />
        </div>
      )}

      {!loadingInitial && !loadingMore && hasMore && (
        <div className="flex justify-center py-4">
          <button
            onClick={() => void loadNextPage()}
            className="min-h-11 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] px-5 py-2 text-sm text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-muted)]"
          >
            Načíst dalších 30
          </button>
        </div>
      )}

      {!hasMore && articles.length > 0 && (
        <p className="py-6 text-center text-sm text-[color:var(--muted)]">Došel jsem na konec filmového feedu.</p>
      )}

      {selected && <ArticleModal article={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
