interface ReleaseDateInfo {
  certification: string;
  descriptors: string[];
  iso_639_1: string;
  note: string;
  release_date: Date;
  type: number;
}

interface ReleaseDates {
  results: {
    iso_3166_1: string;
    release_dates: ReleaseDateInfo[];
  }[];
}

interface ContentRatings {
  results: { descriptors: string[]; iso_3166_1: string; rating: string }[];
}

interface Network {
  id: string;
  logo_path: string;
  name: string;
  origin_country: string;
}

export function getUSNetwork(networks: Network[]): string | null {
  for (const network of networks) {
    if (network.origin_country === 'US') {
      return network.name;
    }
  }
  return null;
}

export function getUSRating(contentRatings: ContentRatings): string {
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

export function getEpisodeToAirId(episode: { id: number } | null) {
  if (episode) {
    return episode.id;
  }
  return null;
}

export function getUSMPARating(releaseDates: ReleaseDates): string {
  for (const releaseDate of releaseDates.results) {
    if (releaseDate.iso_3166_1 === 'US') {
      const release: ReleaseDateInfo = releaseDate.release_dates[0];
      return release.certification;
    }
  }
  return 'PG';
}

export function stripPrefix(input: string): string {
  return input.replace(/^(tv\/|movie\/)/, '');
}

export function getStreamingPremieredDate(showType: string, result: { firstAirYear?: any; releaseYear?: any }) {
  if (showType === 'movie') {
    return result.releaseYear;
  } else {
    return result.firstAirYear;
  }
}

export function getTMDBPremieredDate(showType: string, result: { first_air_date?: any; release_date?: any }) {
  if (showType === 'movie') {
    return result.release_date;
  } else {
    return result.first_air_date;
  }
}

export function getTMDBItemName(searchType: string, result: { name?: any; title?: any }) {
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
