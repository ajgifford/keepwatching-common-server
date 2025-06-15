import { TMDBRelatedMovie, TMDBRelatedShow } from '../types/tmdbTypes';

export function filterUSOrEnglishShows(shows: TMDBRelatedShow[]) {
  return shows.filter((show) => {
    const isUSOrigin = show.origin_country.includes('US');
    const isEnglishLanguage = show.original_language === 'en';

    return isUSOrigin || (!isUSOrigin && isEnglishLanguage);
  });
}

export function filterEnglishMovies(movies: TMDBRelatedMovie[]) {
  return movies.filter((movie) => {
    return movie.original_language === 'en';
  });
}
