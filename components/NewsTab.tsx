"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Loader2, Clapperboard, Film, X, ChevronRight, Flame } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
import MovieCard from "./MovieCard";
import PersonModal from "./PersonModal";

function timeAgo(d: string) {
  if (!d) return "";
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: cs }); }
  catch { return ""; }
}

// ── Inline person snippet (shown inside news card / modal) ────────────────────
function PersonSnippet({ person, onClickPerson }: { person: any; onClickPerson: (id: number) => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClickPerson(person.id); }}
      className="w-full text-left mt-3 flex items-center gap-3 p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors group"
    >
      <div className="w-10 h-12 rounded-lg overflow-hidden bg-zinc-700 flex-shrink-0">
        {person.photo
          ? <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-zinc-500"><Film className="w-4 h-4" /></div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">{person.name}</p>
        <p className="text-xs text-zinc-400">{person.known_for}</p>
        {person.top_films?.length > 0 && (
          <div className="flex gap-1 mt-1.5 overflow-x-auto">
            {person.top_films.slice(0, 4).map((f: any, i: number) => (
              <div key={i} className="flex-shrink-0 w-8 h-11 rounded bg-zinc-700 overflow-hidden">
                {f.poster
                  ? <img src={f.poster} alt={f.title} className="w-full h-full object-cover" title={`${f.title} (${f.year})`} />
                  : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">{f.year}</div>
                }
              </div>
            ))}
          </div>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-zinc-500 flex-shrink-0" />
    </button>
  );
}

// ── Article detail modal ──────────────────────────────────────────────────────
function ArticleModal({ article, onClose }: { article: any; onClose: () => void }) {
  const [personId, setPersonId] = useState<number | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !personId && onClose();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [onClose, personId]);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" onClick={onClose}>
        <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-900 shadow-2xl" onClick={e => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80">
            <X className="w-5 h-5" />
          </button>
          {article.image && (
            <div className="w-full h-48 rounded-t-2xl overflow-hidden">
              <img src={article.image} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300">{article.source}</span>
              <span className="text-xs text-zinc-500">{article.focus}</span>
              {article.pubDate && <span className="text-xs text-zinc-600 ml-auto">{timeAgo(article.pubDate)}</span>}
            </div>
            <h2 className="text-lg font-bold text-white leading-snug mb-3">{article.title_cs}</h2>
            <p className="text-zinc-300 text-sm leading-relaxed">{article.body_cs}</p>

            {/* Filmmaker detail */}
            {article.person && (
              <div className="mt-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">O kom je řeč</p>
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

// ── News card ─────────────────────────────────────────────────────────────────
const SOURCE_BADGE: Record<string, string> = {
  "Deadline":           "bg-red-900/80 text-red-300",
  "Variety":            "bg-orange-900/80 text-orange-300",
  "Hollywood Reporter": "bg-purple-900/80 text-purple-300",
  "IndieWire":          "bg-blue-900/80 text-blue-300",
  "MovieZone.cz":       "bg-emerald-900/80 text-emerald-300",
};

function NewsCard({ article, onClick }: { article: any; onClick: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const [personId, setPersonId] = useState<number | null>(null);
  const badge = SOURCE_BADGE[article.source] ?? "bg-zinc-800/80 text-zinc-300";

  return (
    <>
      <div className="group rounded-xl overflow-hidden bg-zinc-900 hover:bg-zinc-800 transition-colors shadow flex flex-col cursor-pointer"
           onClick={onClick}>
        {/* Thumbnail */}
        <div className="relative w-full aspect-video bg-zinc-800 flex-shrink-0">
          {article.image && !imgErr ? (
            <img src={article.image} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImgErr(true)} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-700"><Clapperboard className="w-7 h-7" /></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <span className={`absolute bottom-2 left-2 text-xs font-medium px-2 py-0.5 rounded-full backdrop-blur-sm ${badge}`}>
            {article.source}
          </span>
          {article.pubDate && (
            <span className="absolute top-2 right-2 text-xs text-zinc-300 bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm">
              {timeAgo(article.pubDate)}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-3 flex flex-col flex-1">
          <p className="text-xs text-zinc-500 mb-1">{article.focus}</p>
          <h3 className="font-semibold text-sm text-white leading-snug line-clamp-2 group-hover:text-emerald-400 transition-colors mb-1.5">
            {article.title_cs}
          </h3>
          <p className="text-xs text-zinc-400 line-clamp-3 flex-1">{article.body_cs}</p>

          {/* Person mini-preview */}
          {article.person && (
            <div className="mt-2 flex items-center gap-2 pt-2 border-t border-zinc-800"
                 onClick={e => { e.stopPropagation(); setPersonId(article.person.id); }}>
              {article.person.photo && (
                <img src={article.person.photo} alt={article.person.name}
                  className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-1 ring-zinc-600" />
              )}
              <span className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors">
                {article.person.name}
              </span>
              <ChevronRight className="w-3 h-3 text-zinc-600 ml-auto" />
            </div>
          )}
        </div>
      </div>

      {personId && <PersonModal personId={personId} onClose={() => setPersonId(null)} />}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
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
    } catch (e) { setError(e instanceof Error ? e.message : "Chyba"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const sources: string[] = data?.articles
    ? ["vše", ...Array.from(new Set<string>(data.articles.map((a: any) => a.source as string)))]
    : [];
  const articles = (data?.articles ?? []).filter((a: any) => filter === "vše" || a.source === filter);

  return (
    <div>
      {/* Trending grid — same style as movie releases */}
      {data?.trending?.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-bold">Tento týden v kinech & trending</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
            {data.trending.map((film: any) => (
              <MovieCard key={film.id} movie={film} />
            ))}
          </div>
        </section>
      )}

      {/* News section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Clapperboard className="w-5 h-5 text-blue-400" />
          Filmové novinky
          {data && <span className="text-sm font-normal text-zinc-500">{articles.length} článků</span>}
        </h2>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Aktualizovat
        </button>
      </div>

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {articles.map((a: any, i: number) => (
          <NewsCard key={i} article={a} onClick={() => setSelected(a)} />
        ))}
      </div>

      {selected && <ArticleModal article={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
