export const genreIdToGenreMap: Map<number, string> = new Map();

genreIdToGenreMap.set(28, 'Action');
genreIdToGenreMap.set(10759, 'Action & Adventure');
genreIdToGenreMap.set(12, 'Adventure');
genreIdToGenreMap.set(16, 'Animation');
genreIdToGenreMap.set(35, 'Comedy');
genreIdToGenreMap.set(80, 'Crime');
genreIdToGenreMap.set(99, 'Documentary');
genreIdToGenreMap.set(18, 'Drama');
genreIdToGenreMap.set(10751, 'Family');
genreIdToGenreMap.set(14, 'Fantasy');
genreIdToGenreMap.set(36, 'History');
genreIdToGenreMap.set(27, 'Horror');
genreIdToGenreMap.set(10762, 'Kids');
genreIdToGenreMap.set(10402, 'Music');
genreIdToGenreMap.set(9648, 'Mystery');
genreIdToGenreMap.set(10763, 'News');
genreIdToGenreMap.set(10764, 'Reality');
genreIdToGenreMap.set(10749, 'Romance');
genreIdToGenreMap.set(10765, 'Sci-Fi & Fantasy');
genreIdToGenreMap.set(878, 'Science Fiction');
genreIdToGenreMap.set(10766, 'Soap');
genreIdToGenreMap.set(10767, 'Talk');
genreIdToGenreMap.set(53, 'Thriller');
genreIdToGenreMap.set(10770, 'TV Movie');
genreIdToGenreMap.set(10752, 'War');
genreIdToGenreMap.set(10768, 'War & Politics');
genreIdToGenreMap.set(37, 'Western');

export function generateGenreArrayFromIds(genreIds: number[]): string[] {
  const genres: string[] = [];
  genreIds.map((id) => {
    genres.push(genreIdToGenreMap.get(id)!);
  });
  return genres;
}
