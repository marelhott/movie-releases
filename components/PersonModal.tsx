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
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800 mb-1.5">
        {film.poster && !err ? (
          <Image src={film.poster} alt={film.title} fill className="object-cover group-hover:scale-105 transition-transform" onError={() => setErr(true)} sizes="112px" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Film className="w-6 h-6 text-zinc-600" />
          </div>
        )}
        {film.vote_average ? (
          <span className="absolute bottom-1 left-1 flex items-center gap-0.5 bg-black/70 rounded px-1 py-0.5 text-xs text-yellow-400 font-bold">
            <Star className="w-2.5 h-2.5 fill-yellow-400" />{film.vote_average.toFixed(1)}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-zinc-300 line-clamp-2 leading-tight group-hover:text-white">{film.title}</p>
      {film.year && <p className="text-xs text-zinc-500">{film.year}</p>}
      {film.character && <p className="text-xs text-zinc-500 italic line-clamp-1">{film.character}</p>}
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-900 shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80">
          <X className="w-5 h-5" />
        </button>

        {loading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
        )}

        {data && (
          <div className="p-6">
            <div className="flex gap-5 mb-6">
              <div className="flex-shrink-0 w-28 h-36 rounded-xl overflow-hidden bg-zinc-800">
                {data.photo ? (
                  <Image src={data.photo} alt={data.name} width={112} height={144} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <Film className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-white">{data.name}</h2>
                <p className="text-sm text-emerald-400 mt-0.5">{data.known_for}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-zinc-400">
                  {data.birthday && (
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{data.birthday}</span>
                  )}
                  {data.place_of_birth && (
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{data.place_of_birth}</span>
                  )}
                </div>
                {data.biography && (
                  <p className="mt-3 text-sm text-zinc-400 line-clamp-4">{data.biography}</p>
                )}
              </div>
            </div>

            {/* Tabs */}
            {data.directed.length > 0 && data.acted.length > 0 && (
              <div className="flex gap-2 mb-4">
                {(["directed", "acted"] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"}`}>
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
