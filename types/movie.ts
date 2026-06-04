export interface MovieRatings {
  imdb: number | null;
  tmdb: number | null;
  rt: string | null;
  metacritic: string | null;
}

export interface Torrent {
  quality: string;
  type: string;
  size: string;
  seeds: number;
}

export interface Movie {
  id: number;
  imdb_code: string;
  title: string;
  title_long: string;
  czech_title: string | null;
  year: number;
  runtime: number;
  genres: string[];
  overview: string | null;
  poster: string;
  backdrop: string | null;
  ratings: MovieRatings;
  cast: string[];
  director: string | null;
  date_uploaded: string;
  scene_confirmed?: boolean;
  source?: string;
  torrents: Torrent[];
}
