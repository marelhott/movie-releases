"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, Star, Clock, Calendar, ExternalLink, Film } from "lucide-react";
import { Movie, CastMember } from "@/types/movie";
import PersonModal from "./PersonModal";

const SOURCE_LABELS: Record<string, string> = {
  yts: "YTS", tmdb: "TMDB", srrdb: "SRRDB", predb: "PreDB",
  scnsrc: "ScnSrc", letterboxd: "Letterboxd",
};

function CastCard({ member, onClick }: { member: CastMember; onClick?: () => void }) {
  const [err, setErr] = useState(false);
  return (
    <button onClick={onClick} className="flex-shrink-0 w-20 text-left group">
      <div className="relative w-20 h-24 rounded-lg overflow-hidden bg-zinc-800 mb-1">
        {member.photo && !err ? (
          <Image src={member.photo} alt={member.name} fill className="object-cover group-hover:scale-105 transition-transform" onError={() => setErr(true)} sizes="80px" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
            <Film className="w-5 h-5" />
          </div>
        )}
      </div>
      <p className="text-xs text-zinc-300 line-clamp-2 leading-tight group-hover:text-white">{member.name}</p>
      {member.character && <p className="text-xs text-zinc-500 line-clamp-1 italic">{member.character}</p>}
    </button>
  );
}

export default function MovieModal({ movie, onClose }: { movie: Movie; onClose: () => void }) {
  const [personId, setPersonId] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && !personId && onClose();
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [onClose, personId]);

  const { ratings } = movie;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
        <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-900 shadow-2xl" onClick={e => e.stopPropagation()}>

          {/* Backdrop */}
          {movie.backdrop && (
            <div className="relative h-48 w-full overflow-hidden rounded-t-2xl">
              <Image src={movie.backdrop} alt="" fill className="object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-900" />
            </div>
          )}

          <button onClick={onClose} className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors">
            <X className="w-5 h-5" />
          </button>

          <div className={`flex gap-6 px-6 pb-6 ${movie.backdrop ? "-mt-16 relative" : "pt-6"}`}>
            {/* Poster */}
            <div className="flex-shrink-0 w-32 hidden sm:block">
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-xl ring-2 ring-white/10">
                {movie.poster ? (
                  <Image src={movie.poster} alt={movie.title} fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center text-zinc-600 text-xs text-center p-2">{movie.title}</div>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 pt-16 sm:pt-0">
              <h2 className="text-2xl font-bold text-white leading-tight">{movie.title}</h2>
              {movie.czech_title && <p className="text-zinc-400 mt-0.5">{movie.czech_title}</p>}

              <div className="flex flex-wrap gap-3 mt-3 text-sm text-zinc-400">
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{movie.year}</span>
                {movie.runtime > 0 && <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{movie.runtime} min</span>}
              </div>

              {movie.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {movie.genres.map(g => (
                    <span key={g} className="px-2 py-0.5 rounded-full text-xs bg-zinc-700 text-zinc-300">{g}</span>
                  ))}
                </div>
              )}

              {/* Ratings */}
              <div className="flex flex-wrap gap-5 mt-4">
                {ratings.imdb && <RatingBadge label="IMDB" value={`${ratings.imdb}/10`} color="text-yellow-400" />}
                {ratings.tmdb && <RatingBadge label="TMDB" value={`${ratings.tmdb}/10`} color="text-blue-400" />}
                {ratings.rt && <RatingBadge label="Rotten Tomatoes" value={ratings.rt} color="text-red-400" />}
                {ratings.metacritic && <RatingBadge label="Metacritic" value={ratings.metacritic} color="text-green-400" />}
              </div>

              {/* Overview */}
              {movie.overview ? (
                <p className="mt-4 text-zinc-300 text-sm leading-relaxed">{movie.overview}</p>
              ) : (
                <p className="mt-4 text-zinc-500 text-sm italic">Popis není k dispozici.</p>
              )}

              {/* Director */}
              {movie.director && (
                <div className="mt-5">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Režisér</p>
                  <button
                    onClick={() => setPersonId(movie.director!.id)}
                    className="flex items-center gap-3 group hover:bg-zinc-800 rounded-xl p-2 -ml-2 transition-colors"
                  >
                    <div className="w-12 h-14 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                      {movie.director.photo ? (
                        <Image src={movie.director.photo} alt={movie.director.name} width={48} height={56} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600"><Film className="w-4 h-4" /></div>
                      )}
                    </div>
                    <span className="font-semibold text-white group-hover:text-emerald-400 transition-colors">{movie.director.name}</span>
                  </button>
                </div>
              )}

              {/* Cast */}
              {movie.cast.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Obsazení</p>
                  <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
                    {movie.cast.map(m => (
                      <CastCard key={m.id} member={m} onClick={() => setPersonId(m.id)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Sources */}
              {movie.sources?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {movie.sources.map(s => (
                    <span key={s} className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-400 border border-zinc-700">
                      {SOURCE_LABELS[s] ?? s}
                    </span>
                  ))}
                </div>
              )}

              {/* Torrents */}
              {movie.torrents?.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Dostupné kvality</p>
                  <div className="flex flex-wrap gap-2">
                    {movie.torrents.map((t, i) => (
                      <div key={i} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 flex gap-2 items-center">
                        <span className="font-bold text-emerald-400">{t.quality}</span>
                        <span className="text-zinc-500">{t.type}</span>
                        <span>{t.size}</span>
                        <span className="text-green-500">▲ {t.seeds}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Links */}
              <div className="flex gap-3 mt-5">
                {movie.imdb_code && (
                  <a href={`https://www.imdb.com/title/${movie.imdb_code}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> IMDB
                  </a>
                )}
                {movie.torrents?.length > 0 && (
                  <a href={`https://yts.mx/movies/${movie.title.toLowerCase().replace(/\s+/g, "-")}-${movie.year}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                    <Film className="w-3.5 h-3.5" /> YTS
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {personId && <PersonModal personId={personId} onClose={() => setPersonId(null)} />}
    </>
  );
}

function RatingBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-lg font-bold ${color}`}>{value}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}
