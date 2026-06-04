"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ExternalLink, Flame, Newspaper, RefreshCw } from "lucide-react";
import { NewsArticle, NewsData } from "@/types/news";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";

function timeAgo(dateStr: string) {
  if (!dateStr) return "";
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: cs });
  } catch {
    return "";
  }
}

function ArticleCard({ article }: { article: NewsArticle }) {
  const [imgError, setImgError] = useState(false);

  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-colors"
    >
      {article.image && !imgError && (
        <div className="relative w-full sm:w-36 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-800">
          <Image
            src={article.image}
            alt=""
            fill
            className="object-cover"
            onError={() => setImgError(true)}
            sizes="(max-width: 640px) 100vw, 144px"
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300">
            {article.source}
          </span>
          <span className="text-xs text-zinc-500">{article.focus}</span>
          {article.pubDate && (
            <span className="text-xs text-zinc-600 ml-auto">{timeAgo(article.pubDate)}</span>
          )}
        </div>

        <h3 className="font-semibold text-white text-sm leading-snug group-hover:text-emerald-400 transition-colors line-clamp-2">
          {article.title_cs}
        </h3>

        {article.summary_cs && (
          <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{article.summary_cs}</p>
        )}

        <div className="flex items-center gap-1 mt-2 text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">
          <ExternalLink className="w-3 h-3" />
          <span>číst dále</span>
        </div>
      </div>
    </a>
  );
}

function TrendingCard({ article }: { article: NewsArticle }) {
  const [imgError, setImgError] = useState(false);

  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative rounded-xl overflow-hidden bg-zinc-900 hover:scale-[1.02] transition-transform"
    >
      <div className="relative aspect-video w-full bg-zinc-800">
        {article.image && !imgError ? (
          <Image
            src={article.image}
            alt={article.title_cs}
            fill
            className="object-cover"
            onError={() => setImgError(true)}
            sizes="(max-width: 640px) 100vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
            <Flame className="w-8 h-8" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h3 className="font-semibold text-sm text-white leading-tight line-clamp-2 group-hover:text-emerald-400 transition-colors">
          {article.title_cs}
        </h3>
        {article.pubDate && (
          <p className="text-xs text-zinc-400 mt-0.5">{timeAgo(article.pubDate)}</p>
        )}
      </div>
    </a>
  );
}

export default function NewsTab() {
  const [data, setData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("vše");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error("Chyba načítání novinek");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neznámá chyba");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sources = data ? ["vše", ...Array.from(new Set(data.articles.map((a) => a.source)))] : [];

  const filtered =
    data?.articles.filter((a) => activeFilter === "vše" || a.source === activeFilter) ?? [];

  return (
    <div>
      {/* Trending */}
      {data?.trending && data.trending.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-bold">Trending tento týden</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.trending.slice(0, 8).map((a, i) => (
              <TrendingCard key={i} article={a} />
            ))}
          </div>
        </section>
      )}

      {/* Articles */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold">Filmové novinky</h2>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Aktualizovat
          </button>
        </div>

        {/* Source filter */}
        {sources.length > 1 && (
          <div className="flex gap-2 flex-wrap mb-5">
            {sources.map((s) => (
              <button
                key={s}
                onClick={() => setActiveFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeFilter === s
                    ? "bg-emerald-500 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {error && <div className="text-center py-12 text-red-400">{error}</div>}

        {loading && !data && (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-zinc-900 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && !error && (
          <div className="text-center py-12 text-zinc-500">Žádné novinky k zobrazení.</div>
        )}

        <div className="space-y-3">
          {filtered.map((a, i) => (
            <ArticleCard key={i} article={a} />
          ))}
        </div>
      </section>
    </div>
  );
}
