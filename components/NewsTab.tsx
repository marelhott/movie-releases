"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink, Flame, RefreshCw, Loader2, Newspaper } from "lucide-react";
import { NewsArticle, NewsData } from "@/types/news";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";

function timeAgo(d: string) {
  if (!d) return "";
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: cs }); }
  catch { return ""; }
}

// ── Detail modal ─────────────────────────────────────────────────────────────

function ArticleModal({ article, onClose }: { article: NewsArticle; onClose: () => void }) {
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-900 shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80">
          <X className="w-5 h-5" />
        </button>

        {article.image && !imgErr && (
          <div className="relative w-full h-56 rounded-t-2xl overflow-hidden">
            <img src={article.image} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setImgErr(true)} />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-900" />
          </div>
        )}

        <div className="p-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300">{article.source}</span>
            <span className="text-xs text-zinc-500">{article.focus}</span>
            {article.pubDate && <span className="text-xs text-zinc-600 ml-auto">{timeAgo(article.pubDate)}</span>}
          </div>

          <h2 className="text-xl font-bold text-white leading-snug mb-4">{article.title_cs}</h2>
          <p className="text-zinc-300 text-sm leading-relaxed">{article.summary_cs}</p>

          {article.title_en !== article.title_cs && (
            <p className="mt-3 text-xs text-zinc-500 italic">Originál: {article.title_en}</p>
          )}

          <a href={article.link} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm text-white transition-colors">
            <ExternalLink className="w-4 h-4" /> Číst celý článek
          </a>
        </div>
      </div>
    </div>
  );
}

// ── News card ─────────────────────────────────────────────────────────────────

function NewsCard({ article, onClick }: { article: NewsArticle; onClick: () => void }) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <button onClick={onClick} className="group text-left rounded-xl overflow-hidden bg-zinc-900 hover:bg-zinc-800 hover:scale-[1.02] transition-all duration-200 shadow-md">
      {/* Thumbnail */}
      <div className="relative w-full aspect-video bg-zinc-800">
        {article.image && !imgErr ? (
          <img src={article.image} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgErr(true)} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
            <Newspaper className="w-8 h-8" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <span className="absolute bottom-2 left-2 text-xs font-medium px-2 py-0.5 rounded-full bg-black/60 text-zinc-300 backdrop-blur-sm">
          {article.source}
        </span>
        {article.pubDate && (
          <span className="absolute top-2 right-2 text-xs text-zinc-400 bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm">
            {timeAgo(article.pubDate)}
          </span>
        )}
      </div>

      {/* Text */}
      <div className="p-3">
        <p className="text-xs text-zinc-500 mb-1">{article.focus}</p>
        <h3 className="font-semibold text-sm text-white leading-snug line-clamp-3 group-hover:text-emerald-400 transition-colors">
          {article.title_cs}
        </h3>
        {article.summary_cs && (
          <p className="mt-1.5 text-xs text-zinc-400 line-clamp-2">{article.summary_cs}</p>
        )}
      </div>
    </button>
  );
}

// ── Trending card ─────────────────────────────────────────────────────────────

function TrendingCard({ article }: { article: NewsArticle }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <a href={article.link} target="_blank" rel="noopener noreferrer"
      className="group relative rounded-xl overflow-hidden bg-zinc-900 hover:scale-[1.02] transition-transform shadow-md">
      <div className="relative aspect-video w-full bg-zinc-800">
        {article.image && !imgErr ? (
          <img src={article.image} alt={article.title_cs} className="absolute inset-0 w-full h-full object-cover" onError={() => setImgErr(true)} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-700"><Flame className="w-8 h-8" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h3 className="font-semibold text-sm text-white line-clamp-2 group-hover:text-emerald-400 transition-colors">{article.title_cs}</h3>
        {article.pubDate && <p className="text-xs text-zinc-400 mt-0.5">{timeAgo(article.pubDate)}</p>}
      </div>
    </a>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function NewsTab() {
  const [data, setData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("vše");
  const [selected, setSelected] = useState<NewsArticle | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error("Chyba načítání");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const sources = data ? ["vše", ...Array.from(new Set(data.articles.map(a => a.source)))] : [];
  const articles = data?.articles.filter(a => filter === "vše" || a.source === filter) ?? [];

  return (
    <div>
      {/* Trending */}
      {data?.trending && data.trending.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-bold">Trending tento týden</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.trending.slice(0, 8).map((a, i) => <TrendingCard key={i} article={a} />)}
          </div>
        </section>
      )}

      {/* News grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold">Filmové novinky</h2>
            {data && <span className="text-sm text-zinc-500">{articles.length} článků</span>}
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Aktualizovat
          </button>
        </div>

        {/* Source filter */}
        {sources.length > 1 && (
          <div className="flex gap-2 flex-wrap mb-5">
            {sources.map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === s ? "bg-emerald-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                {s}
              </button>
            ))}
          </div>
        )}

        {error && <div className="text-center py-12 text-red-400">{error}</div>}

        {loading && !data && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {articles.map((a, i) => (
            <NewsCard key={i} article={a} onClick={() => setSelected(a)} />
          ))}
        </div>

        {!loading && articles.length === 0 && !error && (
          <div className="text-center py-12 text-zinc-500">Žádné novinky k zobrazení.</div>
        )}
      </section>

      {selected && <ArticleModal article={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
