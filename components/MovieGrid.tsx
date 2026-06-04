"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Movie } from "@/types/movie";
import MovieCard from "./MovieCard";

export default function MovieGrid() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMovies = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/movies?page=${p}`);
      if (!res.ok) throw new Error("Chyba při načítání filmů");
      const data = await res.json();
      if (!data.movies?.length) {
        setHasMore(false);
      } else {
        setMovies(prev => p === 1 ? data.movies : [...prev, ...data.movies]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neznámá chyba");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMovies(1); }, [loadMovies]);

  return (
    <div>
      {error && <div className="text-center py-12 text-red-400">{error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
        {movies.map(movie => <MovieCard key={`${movie.id}-${movie.imdb_code}`} movie={movie} />)}
        {loading && Array.from({ length: 14 }).map((_, i) => (
          <div key={`sk-${i}`} className="rounded-xl overflow-hidden bg-zinc-800 animate-pulse aspect-[2/3]" />
        ))}
      </div>

      {!loading && hasMore && movies.length > 0 && (
        <div className="flex justify-center mt-10">
          <button onClick={() => { const n = page + 1; setPage(n); loadMovies(n); }}
            className="px-8 py-3 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors">
            Načíst další
          </button>
        </div>
      )}

      {loading && movies.length > 0 && (
        <div className="flex justify-center mt-8">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      )}
    </div>
  );
}
