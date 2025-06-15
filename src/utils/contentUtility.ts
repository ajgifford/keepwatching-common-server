import {
  TMDBContentRatings,
  TMDBEpisodeToAir,
  TMDBMovie,
  TMDBNetwork,
  TMDBProductionCompanies,
  TMDBReleaseDates,
} from '../types/tmdbTypes';
import { Show } from 'streaming-availability';

export function getUSNetwork(networks: TMDBNetwork[]): string | null {
  for (const network of networks) {
    if (network.origin_country === 'US') {
      return network.name;
    }
  }
  return null;
}

export function getUSRating(contentRatings: TMDBContentRatings): string {
  for (const result of contentRatings.results) {
    if (result.iso_3166_1 === 'US') {
      return result.rating;
    }
  }
  return 'TV-G';
}

export function getInProduction(show: { in_production: boolean }): 0 | 1 {
  return show.in_production ? 1 : 0;
}

export function getEpisodeToAirId(episode: TMDBEpisodeToAir | null) {
  if (episode) {
    return episode.id;
  }
  return null;
}

export function getUSMPARating(releaseDates: TMDBReleaseDates): string {
  const usRelease = releaseDates.results.find((r) => r.iso_3166_1 === 'US');
  if (usRelease) {
    const releaseDates = usRelease.release_dates;
    const theatricalRelease = releaseDates.find((r) => r.type === 3);
    return theatricalRelease?.certification || 'Unknown';
  }
  return 'Unknown';
}

export function getDirectors(movie: TMDBMovie) {
  const crew = movie.credits?.crew ?? [];
  const directors = crew.filter((member) => member.job === 'Director').map((director) => director.name);

  return directors.length > 0 ? directors.join(', ') : 'Unknown';
}

export function getUSProductionCompanies(companies: TMDBProductionCompanies[]): string {
  const usCompanies = companies
    .filter((company) => company.origin_country === 'US')
    .slice(0, 3)
    .map((company) => company.name);

  return usCompanies.length > 0 ? usCompanies.join(', ') : 'Unknown';
}

export function stripPrefix(input: string): string {
  return input.replace(/^(tv\/|movie\/)/, '');
}

export function getStreamingPremieredDate(showType: string, result: Show) {
  if (showType === 'movie') {
    return `${result.releaseYear}`;
  } else {
    return `${result.firstAirYear}`;
  }
}

export function getTMDBPremieredDate(showType: string, result: { first_air_date?: string; release_date?: string }) {
  if (showType === 'movie') {
    return result.release_date;
  } else {
    return result.first_air_date;
  }
}

export function getTMDBItemName(searchType: string, result: { name?: string; title?: string }) {
  if (searchType === 'movie') {
    return result.title;
  } else {
    return result.name;
  }
}

export function isFutureSeason(seasonAirDate: string | null, episodeCount: number): boolean {
  // If no air date is set, assume it's future content
  if (!seasonAirDate) {
    return true;
  }

  // If air date is in the future, it's future content
  if (new Date(seasonAirDate) > new Date()) {
    return true;
  }

  // If no episodes exist yet, treat as future content even if air date has passed
  // (This handles cases where TMDB has placeholder seasons)
  if (episodeCount === 0) {
    return true;
  }

  return false;
}
