"use client";

import { useState, useEffect, useEffectEvent } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Movie } from "@/types/movie";
import MovieCard from "./MovieCard";

type MovieCache = {
  movies: Movie[];
  page: number;
  hasMore: boolean;
  hydrated: boolean;
};

const movieCache: MovieCache = {
  movies: [],
  page: 1,
  hasMore: true,
  hydrated: false,
};

export default function MovieGrid() {
  const [movies, setMovies] = useState<Movie[]>(movieCache.movies);
  const [page, setPage] = useState(movieCache.page);
  const [loading, setLoading] = useState(!movieCache.hydrated);
  const [hasMore, setHasMore] = useState(movieCache.hasMore);
  const [error, setError] = useState<string | null>(null);

  const loadMovies = useEffectEvent(async (p: number, mode: "replace" | "append" = "replace") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/movies?page=${p}`);
      if (!res.ok) throw new Error("Chyba při načítání filmů");
      const data = await res.json();
      if (!data.movies?.length) {
        setHasMore(false);
        movieCache.hasMore = false;
      } else {
        setMovies((prev) => {
          const next = mode === "replace" ? data.movies : [...prev, ...data.movies];
          movieCache.movies = next;
          return next;
        });
        setPage(p);
        setHasMore(true);
        movieCache.page = p;
        movieCache.hasMore = true;
      }
      movieCache.hydrated = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neznámá chyba");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    if (movieCache.hydrated) return;
    void loadMovies(1, "replace");
  }, [loadMovies]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[color:var(--foreground)]">
          <Sparkles className="h-5 w-5 text-[color:var(--accent)]" />
          Nové filmy
          {movies.length > 0 && <span className="text-sm font-normal text-[color:var(--muted)]">{movies.length} titulů</span>}
        </h2>
      </div>

      {error && <div className="text-center py-12 text-red-400">{error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
        {movies.map(movie => <MovieCard key={`${movie.id}-${movie.imdb_code}`} movie={movie} />)}
        {loading && Array.from({ length: 14 }).map((_, i) => (
          <div key={`sk-${i}`} className="aspect-[2/3] animate-pulse overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)]" />
        ))}
      </div>

      {!loading && hasMore && movies.length > 0 && (
        <div className="flex justify-center mt-10">
          <button onClick={() => { const n = page + 1; void loadMovies(n, "append"); }}
            className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] px-8 py-3 font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-muted)]">
            Načíst další
          </button>
        </div>
      )}

      {loading && movies.length > 0 && (
        <div className="flex justify-center mt-8">
          <Loader2 className="w-6 h-6 animate-spin text-[color:var(--muted)]" />
        </div>
      )}
    </div>
  );
}
