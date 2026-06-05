"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, Film, Star, MapPin, Calendar, Loader2 } from "lucide-react";

interface PersonData {
  id: number;
  name: string;
  photo: string | null;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
  known_for: string;
  directed: FilmItem[];
  acted: FilmItem[];
}

interface FilmItem {
  id: number;
  title: string;
  original_title: string;
  year: number | null;
  poster: string | null;
  vote_average: number | null;
  character?: string;
}

function FilmCard({ film }: { film: FilmItem }) {
  const [err, setErr] = useState(false);
  return (
    <a
      href={`https://www.themoviedb.org/movie/${film.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex-shrink-0 w-28"
    >
      <div className="relative mb-1.5 aspect-[2/3] overflow-hidden rounded-lg bg-[color:var(--surface-muted)]">
        {film.poster && !err ? (
          <Image src={film.poster} alt={film.title} fill className="object-cover group-hover:scale-105 transition-transform" onError={() => setErr(true)} sizes="112px" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Film className="w-6 h-6 text-[color:var(--muted)]" />
          </div>
        )}
        {film.vote_average ? (
          <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-[rgba(255,253,248,0.88)] px-1 py-0.5 text-xs font-bold text-yellow-700">
            <Star className="w-2.5 h-2.5 fill-yellow-400" />{film.vote_average.toFixed(1)}
          </span>
        ) : null}
      </div>
      <p className="line-clamp-2 text-xs leading-tight text-[color:var(--foreground)] group-hover:text-[color:var(--accent)]">{film.title}</p>
      {film.year && <p className="text-xs text-[color:var(--muted)]">{film.year}</p>}
      {film.character && <p className="line-clamp-1 text-xs italic text-[color:var(--muted)]">{film.character}</p>}
    </a>
  );
}

export default function PersonModal({ personId, onClose }: { personId: number; onClose: () => void }) {
  const [data, setData] = useState<PersonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"directed" | "acted">("directed");

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [onClose]);

  useEffect(() => {
    fetch(`/api/person/${personId}`)
      .then(r => r.json())
      .then(d => { setData(d); setTab(d.directed?.length > 0 ? "directed" : "acted"); })
      .finally(() => setLoading(false));
  }, [personId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(29,42,36,0.28)] p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-white/80 p-1.5 text-[color:var(--foreground)] hover:bg-white">
          <X className="w-5 h-5" />
        </button>

        {loading && (
            <div className="flex h-64 items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[color:var(--muted)]" />
          </div>
        )}

        {data && (
          <div className="p-6">
            <div className="flex gap-5 mb-6">
              <div className="h-36 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-[color:var(--surface-muted)]">
                {data.photo ? (
                  <Image src={data.photo} alt={data.name} width={112} height={144} className="object-cover w-full h-full" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[color:var(--muted)]">
                    <Film className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-[color:var(--foreground)]">{data.name}</h2>
                <p className="mt-0.5 text-sm text-[color:var(--accent)]">{data.known_for}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-[color:var(--muted)]">
                  {data.birthday && (
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{data.birthday}</span>
                  )}
                  {data.place_of_birth && (
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{data.place_of_birth}</span>
                  )}
                </div>
                {data.biography && (
                  <p className="mt-3 line-clamp-4 text-sm text-[color:var(--muted)]">{data.biography}</p>
                )}
              </div>
            </div>

            {/* Tabs */}
            {data.directed.length > 0 && data.acted.length > 0 && (
              <div className="flex gap-2 mb-4">
                {(["directed", "acted"] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${tab === t ? "bg-[color:var(--accent)] text-white" : "text-[color:var(--muted)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"}`}>
                    {t === "directed" ? `Režie (${data.directed.length})` : `Jako herec (${data.acted.length})`}
                  </button>
                ))}
              </div>
            )}

            {/* Film list */}
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {(tab === "directed" ? data.directed : data.acted).map(film => (
                <FilmCard key={film.id} film={film} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
