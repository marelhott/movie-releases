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
    <button onClick={onClick} className="group w-20 flex-shrink-0 text-left">
      <div className="relative mb-1 h-24 w-20 overflow-hidden rounded-lg bg-[color:var(--surface-muted)]">
        {member.photo && !err ? (
          <Image src={member.photo} alt={member.name} fill className="object-cover group-hover:scale-105 transition-transform" onError={() => setErr(true)} sizes="80px" />
        ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[color:var(--muted)]">
              <Film className="w-5 h-5" />
            </div>
          )}
        </div>
      <p className="line-clamp-2 text-xs leading-tight text-[color:var(--foreground)] group-hover:text-[color:var(--accent)]">{member.name}</p>
      {member.character && <p className="line-clamp-1 text-xs italic text-[color:var(--muted)]">{member.character}</p>}
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
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(29,42,36,0.28)] p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
        <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[1.75rem] border border-[color:var(--line)] bg-[color:var(--surface)] shadow-2xl sm:max-h-[90vh] sm:rounded-2xl" onClick={e => e.stopPropagation()}>

          {/* Backdrop */}
          {movie.backdrop && (
            <div className="relative h-36 w-full overflow-hidden rounded-t-[1.75rem] sm:h-48 sm:rounded-t-2xl">
              <Image src={movie.backdrop} alt="" fill className="object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[color:var(--surface)]" />
            </div>
          )}

          <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-white/80 p-1.5 text-[color:var(--foreground)] shadow hover:bg-white transition-colors">
            <X className="w-5 h-5" />
          </button>

          <div className={`relative flex flex-col gap-4 px-4 pb-4 sm:gap-6 sm:px-6 sm:pb-6 ${movie.backdrop ? "-mt-10 sm:-mt-16" : "pt-4 sm:pt-6"}`}>
            {/* Poster */}
            <div className="w-24 flex-shrink-0 self-center sm:block sm:w-32 sm:self-auto">
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-xl ring-2 ring-white/10">
                {movie.poster ? (
                  <Image src={movie.poster} alt={movie.title} fill className="object-cover" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--surface-muted)] p-2 text-center text-xs text-[color:var(--muted)]">{movie.title}</div>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1 pt-0 sm:pt-0">
              <h2 className="text-xl font-bold leading-tight text-[color:var(--foreground)] sm:text-2xl">{movie.title}</h2>
              {movie.czech_title && <p className="mt-0.5 text-[color:var(--muted)]">{movie.czech_title}</p>}

              <div className="mt-3 flex flex-wrap gap-3 text-sm text-[color:var(--muted)]">
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{movie.year}</span>
                {movie.runtime > 0 && <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{movie.runtime} min</span>}
              </div>

              {movie.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {movie.genres.map(g => (
                    <span key={g} className="rounded-full bg-[color:var(--surface-muted)] px-2 py-0.5 text-xs text-[color:var(--foreground)]">{g}</span>
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
                <p className="mt-4 text-sm leading-relaxed text-[color:var(--foreground)]">{movie.overview}</p>
              ) : (
                <p className="mt-4 text-sm italic text-[color:var(--muted)]">Popis není k dispozici.</p>
              )}

              {/* Director */}
              {movie.director && (
                <div className="mt-5">
                  <p className="mb-2 text-xs uppercase tracking-wider text-[color:var(--muted)]">Režisér</p>
                  <button
                    onClick={() => setPersonId(movie.director!.id)}
                    className="-ml-2 flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[color:var(--surface-muted)] group"
                  >
                    <div className="h-14 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-[color:var(--surface-muted)]">
                      {movie.director.photo ? (
                        <Image src={movie.director.photo} alt={movie.director.name} width={48} height={56} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600"><Film className="w-4 h-4" /></div>
                      )}
                    </div>
                    <span className="font-semibold text-[color:var(--foreground)] transition-colors group-hover:text-[color:var(--accent)]">{movie.director.name}</span>
                  </button>
                </div>
              )}

              {/* Cast */}
              {movie.cast.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs uppercase tracking-wider text-[color:var(--muted)]">Obsazení</p>
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
                    <span key={s} className="rounded-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-2 py-0.5 text-xs text-[color:var(--muted)]">
                      {SOURCE_LABELS[s] ?? s}
                    </span>
                  ))}
                </div>
              )}

              {/* Torrents */}
              {movie.torrents?.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs uppercase tracking-wider text-[color:var(--muted)]">Dostupné kvality</p>
                  <div className="flex flex-wrap gap-2">
                    {movie.torrents.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-1.5 text-xs text-[color:var(--foreground)]">
                        <span className="font-bold text-[color:var(--accent)]">{t.quality}</span>
                        <span className="text-[color:var(--muted)]">{t.type}</span>
                        <span>{t.size}</span>
                        <span className="text-green-500">▲ {t.seeds}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Links */}
              <div className="mt-5 flex flex-wrap gap-3">
                {movie.imdb_code && (
                  <a href={`https://www.imdb.com/title/${movie.imdb_code}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-yellow-500/10 px-3 py-1.5 text-xs text-yellow-700 transition-colors hover:bg-yellow-500/20">
                    <ExternalLink className="w-3.5 h-3.5" /> IMDB
                  </a>
                )}
                {movie.torrents?.length > 0 && (
                  <a href={`https://yts.mx/movies/${movie.title.toLowerCase().replace(/\s+/g, "-")}-${movie.year}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-[color:var(--accent)] transition-colors hover:bg-emerald-500/20">
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
      <span className="text-xs text-[color:var(--muted)]">{label}</span>
    </div>
  );
}
