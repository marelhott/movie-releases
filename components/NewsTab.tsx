"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { RefreshCw, Loader2, Clapperboard, Film, X, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
import PersonModal from "./PersonModal";

interface PersonPreview {
  id: number;
  name: string;
  photo: string | null;
  known_for: string;
  top_films: { title: string; year: number; poster: string | null }[];
}

interface NewsArticle {
  title_cs: string;
  body_cs: string;
  title_en: string;
  link: string;
  pubDate: string;
  source: string;
  focus: string;
  image?: string;
  person?: PersonPreview;
}

interface NewsResponse {
  articles: NewsArticle[];
  hasMore: boolean;
  page: number;
  pageSize: number;
  total: number;
}

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
  person: PersonPreview;
  onClickPerson: (id: number) => void;
}) {
  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onClickPerson(person.id);
      }}
      className="mt-3 flex w-full items-center gap-3 rounded-xl bg-zinc-800 p-2.5 text-left transition-colors hover:bg-zinc-700 group"
    >
      <div className="h-12 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-700">
        {person.photo ? (
          <img src={person.photo} alt={person.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-500">
            <Film className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white transition-colors group-hover:text-emerald-400">
          {person.name}
        </p>
        <p className="text-xs text-zinc-400">{person.known_for}</p>
        {person.top_films.length > 0 && (
          <div className="mt-1.5 flex gap-1 overflow-x-auto">
            {person.top_films.slice(0, 4).map((film, index) => (
              <div key={`${film.title}-${index}`} className="h-11 w-8 flex-shrink-0 overflow-hidden rounded bg-zinc-700">
                {film.poster ? (
                  <img
                    src={film.poster}
                    alt={film.title}
                    title={`${film.title} (${film.year})`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">
                    {film.year}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-zinc-500" />
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" onClick={onClose}>
        <div
          className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-zinc-900 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/80"
          >
            <X className="h-5 w-5" />
          </button>

          {article.image && (
            <div className="h-56 w-full overflow-hidden rounded-t-2xl">
              <img src={article.image} alt="" className="h-full w-full object-cover" />
            </div>
          )}

          <div className="p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-300">
                {article.source}
              </span>
              <span className="text-xs text-zinc-500">{article.focus}</span>
              {article.pubDate && <span className="ml-auto text-xs text-zinc-600">{timeAgo(article.pubDate)}</span>}
            </div>

            <h2 className="mb-3 text-xl font-bold leading-snug text-white">{article.title_cs}</h2>
            <p className="text-sm leading-relaxed text-zinc-300">{article.body_cs}</p>

            {article.person && (
              <div className="mt-4">
                <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">O kom je rec</p>
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

function NewsCard({ article, onClick }: { article: NewsArticle; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);
  const [personId, setPersonId] = useState<number | null>(null);
  const badge = SOURCE_BADGE[article.source] ?? "bg-zinc-800/80 text-zinc-300";

  return (
    <>
      <article
        className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-zinc-900 shadow transition-colors hover:bg-zinc-800"
        onClick={onClick}
      >
        <div className="relative aspect-video w-full flex-shrink-0 bg-zinc-800">
          {article.image && !imgError ? (
            <img
              src={article.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
              <Clapperboard className="h-7 w-7" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          <span className={`absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur-sm ${badge}`}>
            {article.source}
          </span>
          {article.pubDate && (
            <span className="absolute right-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-xs text-zinc-300 backdrop-blur-sm">
              {timeAgo(article.pubDate)}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <p className="mb-2 text-xs text-zinc-500">{article.focus}</p>
          <h3 className="mb-2 text-lg font-semibold leading-snug text-white transition-colors group-hover:text-emerald-400">
            {article.title_cs}
          </h3>
          <p className="line-clamp-4 flex-1 text-sm leading-relaxed text-zinc-400">{article.body_cs}</p>

          {article.person && (
            <div
              className="mt-3 flex items-center gap-2 border-t border-zinc-800 pt-3"
              onClick={(event) => {
                event.stopPropagation();
                setPersonId(article.person!.id);
              }}
            >
              {article.person.photo && (
                <img
                  src={article.person.photo}
                  alt={article.person.name}
                  className="h-8 w-8 flex-shrink-0 rounded-full object-cover ring-1 ring-zinc-600"
                />
              )}
              <span className="text-xs text-zinc-400 transition-colors hover:text-emerald-400">
                {article.person.name}
              </span>
              <ChevronRight className="ml-auto h-3 w-3 text-zinc-600" />
            </div>
          )}
        </div>
      </article>

      {personId && <PersonModal personId={personId} onClose={() => setPersonId(null)} />}
    </>
  );
}

export default function NewsTab() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("vse");
  const [selected, setSelected] = useState<NewsArticle | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const pendingPagesRef = useRef(new Set<number>());

  const loadPage = useEffectEvent(async (nextPage: number, mode: "replace" | "append") => {
    if (pendingPagesRef.current.has(nextPage)) return;

    pendingPagesRef.current.add(nextPage);
    if (mode === "replace") {
      setLoadingInitial(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const res = await fetch(`/api/news?page=${nextPage}&pageSize=${PAGE_SIZE}`);
      if (!res.ok) throw new Error("Chyba nacitani");
      const payload = await res.json() as NewsResponse;

      setArticles((current) => {
        if (mode === "replace") return payload.articles;
        const seen = new Set(current.map((article) => article.link));
        return [...current, ...payload.articles.filter((article) => !seen.has(article.link))];
      });
      setPage(payload.page);
      setHasMore(payload.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chyba");
    } finally {
      pendingPagesRef.current.delete(nextPage);
      setLoadingInitial(false);
      setLoadingMore(false);
    }
  });

  useEffect(() => {
    void loadPage(1, "replace");
  }, [loadPage]);

  const refresh = useEffectEvent(async () => {
    setHasMore(true);
    setPage(0);
    void loadPage(1, "replace");
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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Clapperboard className="h-5 w-5 text-blue-400" />
          Filmove novinky
          {articles.length > 0 && (
            <span className="text-sm font-normal text-zinc-500">{filteredArticles.length} zprav</span>
          )}
        </h2>

        <button
          onClick={() => void refresh()}
          disabled={loadingInitial || loadingMore}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingInitial || loadingMore ? "animate-spin" : ""}`} />
          Aktualizovat
        </button>
      </div>

      {SOURCE_FILTERS.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {SOURCE_FILTERS.map((source) => (
            <button
              key={source}
              onClick={() => setFilter(source)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === source ? "bg-emerald-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {source === "vse" ? "vse" : source}
            </button>
          ))}
        </div>
      )}

      {error && <div className="py-12 text-center text-red-400">{error}</div>}

      {loadingInitial && articles.length === 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl bg-zinc-900">
              <div className="aspect-video animate-pulse bg-zinc-800" />
              <div className="space-y-3 p-4">
                <div className="h-3 w-24 animate-pulse rounded bg-zinc-800" />
                <div className="h-6 w-full animate-pulse rounded bg-zinc-800" />
                <div className="h-4 w-full animate-pulse rounded bg-zinc-800" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredArticles.map((article) => (
          <NewsCard key={article.link} article={article} onClick={() => setSelected(article)} />
        ))}
      </div>

      <div ref={sentinelRef} className="h-10" />

      {loadingMore && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      )}

      {!loadingInitial && !loadingMore && hasMore && (
        <div className="flex justify-center py-4">
          <button
            onClick={() => void loadNextPage()}
            className="rounded-xl bg-zinc-800 px-5 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            Nacist dalsich 30
          </button>
        </div>
      )}

      {!hasMore && articles.length > 0 && (
        <p className="py-6 text-center text-sm text-zinc-500">Dosel jsem na konec filmoveho feedu.</p>
      )}

      {selected && <ArticleModal article={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
