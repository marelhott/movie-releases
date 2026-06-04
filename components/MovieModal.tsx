"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X, Star, Clock, Calendar, User, Film, ExternalLink } from "lucide-react";
import { Movie } from "@/types/movie";

export default function MovieModal({ movie, onClose }: { movie: Movie; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const { ratings } = movie;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Backdrop */}
        {movie.backdrop && (
          <div className="relative h-48 w-full overflow-hidden rounded-t-2xl">
            <Image src={movie.backdrop} alt="" fill className="object-cover opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-900" />
          </div>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex gap-6 p-6 -mt-16 relative">
          {/* Poster */}
          <div className="flex-shrink-0 w-32 hidden sm:block">
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-xl ring-2 ring-white/10">
              {movie.poster ? (
                <Image src={movie.poster} alt={movie.title} fill className="object-cover" />
              ) : (
                <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center text-zinc-600 text-xs text-center p-2">
                  {movie.title}
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 pt-16 sm:pt-0">
            <h2 className="text-2xl font-bold text-white leading-tight">{movie.title}</h2>
            {movie.czech_title && (
              <p className="text-zinc-400 mt-0.5">{movie.czech_title}</p>
            )}

            {/* Meta */}
            <div className="flex flex-wrap gap-3 mt-3 text-sm text-zinc-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" /> {movie.year}
              </span>
              {movie.runtime > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {movie.runtime} min
                </span>
              )}
              {movie.director && (
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" /> {movie.director}
                </span>
              )}
            </div>

            {/* Genres */}
            {movie.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {movie.genres.map((g) => (
                  <span
                    key={g}
                    className="px-2 py-0.5 rounded-full text-xs bg-zinc-700 text-zinc-300"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Ratings */}
            <div className="flex flex-wrap gap-4 mt-4">
              {ratings.imdb && (
                <RatingBadge label="IMDB" value={`${ratings.imdb}/10`} color="text-yellow-400" />
              )}
              {ratings.tmdb && (
                <RatingBadge label="TMDB" value={`${ratings.tmdb}/10`} color="text-blue-400" />
              )}
              {ratings.rt && (
                <RatingBadge label="Rotten Tomatoes" value={ratings.rt} color="text-red-400" />
              )}
              {ratings.metacritic && (
                <RatingBadge label="Metacritic" value={ratings.metacritic} color="text-green-400" />
              )}
            </div>

            {/* Overview */}
            {movie.overview ? (
              <p className="mt-4 text-zinc-300 text-sm leading-relaxed">{movie.overview}</p>
            ) : (
              <p className="mt-4 text-zinc-500 text-sm italic">Popis není k dispozici.</p>
            )}

            {/* Cast */}
            {movie.cast.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Herci</p>
                <p className="text-sm text-zinc-300">{movie.cast.join(", ")}</p>
              </div>
            )}

            {/* Torrents */}
            {movie.torrents?.length > 0 && (
              <div className="mt-5">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                  Dostupné kvalitě
                </p>
                <div className="flex flex-wrap gap-2">
                  {movie.torrents.map((t) => (
                    <div
                      key={`${t.quality}-${t.type}`}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 flex gap-2 items-center"
                    >
                      <span className="font-bold text-emerald-400">{t.quality}</span>
                      <span className="text-zinc-500">{t.type}</span>
                      <span>{t.size}</span>
                      <span className="text-green-500">▲ {t.seeds}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* External links */}
            <div className="flex gap-3 mt-5">
              <a
                href={`https://www.imdb.com/title/${movie.imdb_code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> IMDB
              </a>
              <a
                href={`https://yts.mx/movies/${movie.title.toLowerCase().replace(/\s+/g, "-")}-${movie.year}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <Film className="w-3.5 h-3.5" /> YTS
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RatingBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-lg font-bold ${color}`}>{value}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}
