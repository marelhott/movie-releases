"use client";

import { useState, useEffect } from "react";
import { Star, Clock, RefreshCw, Loader2, Clapperboard, Film, X, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
import PersonModal from "./PersonModal";

function timeAgo(d: string) {
  if (!d) return "";
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: cs }); }
  catch { return ""; }
}

// ── Film týdne ────────────────────────────────────────────────────────────────

function FilmTydne({ film }: { film: any }) {
  const [personId, setPersonId] = useState<number | null>(null);

  return (
    <>
      <div className="rounded-2xl overflow-hidden bg-zinc-900 mb-10">
        {/* Backdrop */}
        {film.backdrop && (
          <div className="relative h-56 md:h-72 overflow-hidden">
            <img src={film.backdrop} alt="" className="w-full h-full object-cover opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/50 to-transparent" />
            <div className="absolute bottom-4 left-5">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                Film týdne
              </span>
            </div>
          </div>
        )}

        <div className="p-5 md:p-6">
          <div className="flex gap-5">
            {/* Poster */}
            {film.poster && (
              <div className="hidden sm:block flex-shrink-0 w-28 -mt-16 relative z-10">
                <img src={film.poster} alt={film.title} className="w-full aspect-[2/3] object-cover rounded-xl shadow-2xl ring-2 ring-white/10" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-white leading-tight">{film.title}</h2>
              {film.czech_title && <p className="text-zinc-400 mt-0.5 text-sm">{film.czech_title}</p>}
              {film.tagline && <p className="text-emerald-400 text-sm italic mt-1">„{film.tagline}"</p>}

              <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-zinc-400">
                {film.year > 0 && <span>{film.year}</span>}
                {film.runtime > 0 && (
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{film.runtime} min</span>
                )}
                {film.ratings?.imdb && (
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-yellow-400">{film.ratings.imdb}</span>
                  </span>
                )}
              </div>

              {film.genres?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {film.genres.map((g: string) => (
                    <span key={g} className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-300">{g}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Overview */}
          {film.overview_cs && (
            <p className="mt-4 text-zinc-300 text-sm leading-relaxed">{film.overview_cs}</p>
          )}

          {/* Director */}
          {film.director?.name && (
            <div className="mt-5">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Režisér</p>
              <button
                onClick={() => film.director.id && setPersonId(film.director.id)}
                className="flex items-center gap-3 group hover:bg-zinc-800 rounded-xl p-2 -ml-2 transition-colors w-full text-left"
              >
                <div className="w-12 h-14 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                  {film.director.photo
                    ? <img src={film.director.photo} alt={film.director.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-zinc-600"><Film className="w-4 h-4" /></div>
                  }
                </div>
                <div>
                  <p className="font-semibold text-white group-hover:text-emerald-400 transition-colors">{film.director.name}</p>
                  {film.director.bio_cs && (
                    <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5">{film.director.bio_cs}</p>
                  )}
                </div>
              </button>
            </div>
          )}

          {/* Cast */}
          {film.cast?.length > 0 && (
            <div className="mt-5">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Obsazení</p>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {film.cast.map((c: any) => (
                  <button key={c.id} onClick={() => setPersonId(c.id)}
                    className="flex-shrink-0 w-16 text-left group">
                    <div className="w-16 h-20 rounded-lg overflow-hidden bg-zinc-800 mb-1">
                      {c.photo
                        ? <img src={c.photo} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        : <div className="w-full h-full flex items-center justify-center text-zinc-600"><Film className="w-4 h-4" /></div>
                      }
                    </div>
                    <p className="text-xs text-zinc-300 line-clamp-1 group-hover:text-white">{c.name}</p>
                    {c.character && <p className="text-xs text-zinc-500 line-clamp-1 italic">{c.character}</p>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Similar films */}
          {film.similar?.length > 0 && (
            <div className="mt-5">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Podobné filmy</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {film.similar.map((s: any) => (
                  <div key={s.id} className="flex-shrink-0 w-20">
                    <div className="w-20 h-28 rounded-lg overflow-hidden bg-zinc-800 mb-1">
                      {s.poster
                        ? <img src={s.poster} alt={s.title} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-zinc-600"><Film className="w-4 h-4" /></div>
                      }
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-tight">{s.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {personId && <PersonModal personId={personId} onClose={() => setPersonId(null)} />}
    </>
  );
}

// ── Article detail modal ──────────────────────────────────────────────────────

function ArticleModal({ article, onClose }: { article: any; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-900 shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80">
          <X className="w-5 h-5" />
        </button>
        {article.image && (
          <div className="relative w-full h-48 rounded-t-2xl overflow-hidden">
            <img src={article.image} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-900" />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300">{article.source}</span>
            <span className="text-xs text-zinc-500">{article.focus}</span>
            {article.pubDate && <span className="text-xs text-zinc-600 ml-auto">{timeAgo(article.pubDate)}</span>}
          </div>
          <h2 className="text-lg font-bold text-white leading-snug mb-3">{article.title_cs}</h2>
          <p className="text-zinc-300 text-sm leading-relaxed">{article.body_cs}</p>
        </div>
      </div>
    </div>
  );
}

// ── News card ─────────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  "MUBI Notebook": "bg-blue-900/80 text-blue-300",
  "Little White Lies": "bg-rose-900/80 text-rose-300",
  "Filmmaker Magazine": "bg-amber-900/80 text-amber-300",
  "RogerEbert.com": "bg-emerald-900/80 text-emerald-300",
  "The Guardian Film": "bg-purple-900/80 text-purple-300",
};

function NewsCard({ article, onClick }: { article: any; onClick: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const labelCls = SOURCE_COLORS[article.source] ?? "bg-zinc-800/80 text-zinc-300";

  return (
    <button onClick={onClick} className="group text-left rounded-xl overflow-hidden bg-zinc-900 hover:bg-zinc-800 hover:scale-[1.02] transition-all duration-200 shadow flex flex-col">
      <div className="relative w-full aspect-video bg-zinc-800 flex-shrink-0">
        {article.image && !imgErr ? (
          <img src={article.image} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgErr(true)} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
            <Clapperboard className="w-8 h-8" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <span className={`absolute bottom-2 left-2 text-xs font-medium px-2 py-0.5 rounded-full backdrop-blur-sm ${labelCls}`}>
          {article.source}
        </span>
        {article.pubDate && (
          <span className="absolute top-2 right-2 text-xs text-zinc-300 bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm">
            {timeAgo(article.pubDate)}
          </span>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1">
        <p className="text-xs text-zinc-500 mb-1">{article.focus}</p>
        <h3 className="font-semibold text-sm text-white leading-snug line-clamp-2 group-hover:text-emerald-400 transition-colors mb-1.5">
          {article.title_cs}
        </h3>
        <p className="text-xs text-zinc-400 line-clamp-3 flex-1">{article.body_cs}</p>
        <div className="flex items-center gap-1 mt-2 text-xs text-zinc-600 group-hover:text-emerald-500 transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
          <span>číst více</span>
        </div>
      </div>
    </button>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function NewsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("vše");
  const [selected, setSelected] = useState<any>(null);

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

  const sources: string[] = data?.articles ? ["vše", ...Array.from(new Set<string>(data.articles.map((a: any) => a.source as string)))] : [];
  const articles = (data?.articles ?? []).filter((a: any) => filter === "vše" || a.source === filter);

  return (
    <div>
      {/* Film týdne */}
      {data?.filmTydne && <FilmTydne film={data.filmTydne} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Clapperboard className="w-5 h-5 text-blue-400" /> Filmové novinky
          {data && <span className="text-sm font-normal text-zinc-500">{articles.length} článků</span>}
        </h2>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Aktualizovat
        </button>
      </div>

      {/* Source filter */}
      {sources.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-5">
          {sources.map((s: string) => (
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {articles.map((a: any, i: number) => (
          <NewsCard key={i} article={a} onClick={() => setSelected(a)} />
        ))}
      </div>

      {selected && <ArticleModal article={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
