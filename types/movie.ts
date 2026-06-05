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

export interface MovieRelease {
  source: string;
  label: string;
  quality: string | null;
  date: string | null;
  url: string | null;
  size?: string | null;
  seeds?: number | null;
  group?: string | null;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  photo: string | null;
}

export interface Movie {
  id: number;
  imdb_code: string;
  title: string;
  czech_title: string | null;
  year: number;
  runtime: number;
  genres: string[];
  overview: string | null;
  poster: string;
  backdrop: string | null;
  ratings: MovieRatings;
  cast: CastMember[];
  director: { id: number; name: string; photo: string | null } | null;
  date_added: string;
  sources: string[];
  torrents: Torrent[];
  releases: MovieRelease[];
}
