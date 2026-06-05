"use client";

import { useState } from "react";
import Image from "next/image";
import { Star, Clock, Calendar } from "lucide-react";
import { Movie } from "@/types/movie";
import MovieModal from "./MovieModal";

const SOURCE_COLORS: Record<string, string> = {
  srrdb: "bg-purple-600/80", predb: "bg-blue-600/80", scnsrc: "bg-orange-600/80",
};

export default function MovieCard({ movie }: { movie: Movie }) {
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const sceneSource = movie.sources?.find(s => ["srrdb", "predb", "scnsrc"].includes(s));

  return (
    <>
      <div
        className="group relative cursor-pointer overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
        onClick={() => setOpen(true)}
        style={{ contentVisibility: "auto", containIntrinsicSize: "240px 360px" }}
      >
        {/* Poster */}
        <div className="relative aspect-[2/3] w-full bg-[color:var(--surface-muted)]">
          {movie.poster && !imgError ? (
            <Image src={movie.poster} alt={movie.title} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
              className="object-cover" onError={() => setImgError(true)} loading="lazy" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs text-[color:var(--muted)]">{movie.title}</div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 hidden flex-col justify-end bg-gradient-to-t from-[rgba(29,42,36,0.92)] via-[rgba(29,42,36,0.18)] to-transparent p-2.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:flex">
            {movie.overview && <p className="line-clamp-4 text-xs text-stone-100">{movie.overview}</p>}
          </div>

          {/* Badges */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {movie.torrents?.[0] && (
              <span className="rounded bg-[rgba(255,253,248,0.88)] px-1.5 py-0.5 text-xs font-bold leading-none text-[color:var(--accent)] backdrop-blur-sm">
                {movie.torrents[0].quality}
              </span>
            )}
            {sceneSource && (
              <span className={`${SOURCE_COLORS[sceneSource] ?? "bg-zinc-700"} text-xs font-bold px-1.5 py-0.5 rounded text-white backdrop-blur-sm leading-none`}>
                {sceneSource.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="space-y-1 p-2.5 sm:space-y-0.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-[color:var(--foreground)] sm:text-xs">{movie.title}</h3>
          {movie.czech_title && (
            <p className="line-clamp-1 text-xs text-[color:var(--muted)]">{movie.czech_title}</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted)]">
              <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{movie.year}</span>
              {movie.runtime > 0 && <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{movie.runtime} min</span>}
            </div>
            {movie.ratings.imdb && (
              <span className="flex items-center gap-0.5">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-bold text-yellow-400">{movie.ratings.imdb}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {open && <MovieModal movie={movie} onClose={() => setOpen(false)} />}
    </>
  );
}
