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
      <div className="group relative cursor-pointer rounded-xl overflow-hidden bg-zinc-900 shadow-lg hover:shadow-2xl hover:scale-[1.03] transition-all duration-300" onClick={() => setOpen(true)}>
        {/* Poster */}
        <div className="relative aspect-[2/3] w-full bg-zinc-800">
          {movie.poster && !imgError ? (
            <Image src={movie.poster} alt={movie.title} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
              className="object-cover" onError={() => setImgError(true)} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-xs px-2 text-center">{movie.title}</div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5">
            {movie.overview && <p className="text-xs text-zinc-300 line-clamp-4">{movie.overview}</p>}
          </div>

          {/* Badges */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {movie.torrents?.[0] && (
              <span className="bg-black/70 text-xs font-bold px-1.5 py-0.5 rounded text-emerald-400 backdrop-blur-sm leading-none">
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
        <div className="p-2.5 space-y-0.5">
          <h3 className="font-semibold text-xs text-white leading-tight line-clamp-2">{movie.title}</h3>
          {movie.czech_title && (
            <p className="text-xs text-zinc-500 line-clamp-1">{movie.czech_title}</p>
          )}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{movie.year}</span>
              {movie.runtime > 0 && <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{movie.runtime}m</span>}
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
