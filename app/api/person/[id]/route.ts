import { NextResponse } from "next/server";

const TMDB_KEY = process.env.TMDB_API_KEY;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!TMDB_KEY) return NextResponse.json({ error: "No TMDB key" }, { status: 500 });

  const [person, credits] = await Promise.all([
    fetch(`https://api.themoviedb.org/3/person/${id}?api_key=${TMDB_KEY}&language=cs`,
      { next: { revalidate: 86400 } }).then(r => r.json()),
    fetch(`https://api.themoviedb.org/3/person/${id}/movie_credits?api_key=${TMDB_KEY}&language=cs`,
      { next: { revalidate: 86400 } }).then(r => r.json()),
  ]);

  const directed = (credits.crew ?? [])
    .filter((c: any) => c.job === "Director")
    .sort((a: any, b: any) => (b.release_date ?? "").localeCompare(a.release_date ?? ""))
    .slice(0, 20)
    .map((m: any) => ({
      id: m.id,
      title: m.title,
      original_title: m.original_title,
      year: m.release_date ? parseInt(m.release_date) : null,
      poster: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : null,
      vote_average: m.vote_average ?? null,
    }));

  const acted = (credits.cast ?? [])
    .sort((a: any, b: any) => (b.release_date ?? "").localeCompare(a.release_date ?? ""))
    .slice(0, 12)
    .map((m: any) => ({
      id: m.id,
      title: m.title,
      original_title: m.original_title,
      year: m.release_date ? parseInt(m.release_date) : null,
      poster: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : null,
      character: m.character ?? "",
      vote_average: m.vote_average ?? null,
    }));

  return NextResponse.json({
    id: person.id,
    name: person.name,
    photo: person.profile_path ? `https://image.tmdb.org/t/p/w300${person.profile_path}` : null,
    biography: person.biography ?? "",
    birthday: person.birthday ?? null,
    place_of_birth: person.place_of_birth ?? null,
    known_for: person.known_for_department ?? "",
    directed,
    acted,
  });
}
