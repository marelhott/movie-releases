"use client";

import { useState } from "react";
import Image from "next/image";
import { Star, Clock, Calendar } from "lucide-react";
import { Movie } from "@/types/movie";
import MovieModal from "./MovieModal";

export default function MovieCard({ movie }: { movie: Movie }) {
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <>
      <div
        className="group relative cursor-pointer rounded-xl overflow-hidden bg-zinc-900 shadow-lg hover:shadow-2xl hover:scale-[1.03] transition-all duration-300"
        onClick={() => setOpen(true)}
      >
        {/* Poster */}
        <div className="relative aspect-[2/3] w-full bg-zinc-800">
          {movie.poster && !imgError ? (
            <Image
              src={movie.poster}
              alt={movie.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm px-4 text-center">
              {movie.title}
            </div>
          )}

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
            {movie.overview && (
              <p className="text-xs text-zinc-300 line-clamp-4">{movie.overview}</p>
            )}
          </div>

          {/* Quality / source badges */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {movie.torrents?.[0] && (
              <span className="bg-black/70 text-xs font-bold px-2 py-0.5 rounded text-emerald-400 backdrop-blur-sm">
                {movie.torrents[0].quality}
              </span>
            )}
            {movie.scene_confirmed && (
              <span className="bg-purple-600/80 text-xs font-bold px-2 py-0.5 rounded text-white backdrop-blur-sm">
                SCENE
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="p-3 space-y-1">
          <h3 className="font-semibold text-sm text-white leading-tight line-clamp-2">
            {movie.title}
          </h3>
          {movie.czech_title && (
            <p className="text-xs text-zinc-400 line-clamp-1">{movie.czech_title}</p>
          )}

          <div className="flex items-center gap-3 text-xs text-zinc-400 pt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {movie.year}
            </span>
            {movie.runtime > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {movie.runtime} min
              </span>
            )}
          </div>

          {movie.ratings.imdb && (
            <div className="flex items-center gap-1 pt-1">
              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-bold text-yellow-400">{movie.ratings.imdb}</span>
              <span className="text-xs text-zinc-500">IMDB</span>
            </div>
          )}
        </div>
      </div>

      {open && <MovieModal movie={movie} onClose={() => setOpen(false)} />}
    </>
  );
}
