import { TMDBRelatedMovie, TMDBRelatedShow } from '../../../src/types/tmdbTypes';
import { filterEnglishMovies, filterUSOrEnglishShows } from '@utils/usSearchFilter';

describe('usSearchFilter', () => {
  function createTMDBRelatedShow(
    id: number,
    name: string,
    origin_country: string[],
    original_language: string,
  ): TMDBRelatedShow {
    return {
      adult: false,
      backdrop_path: '',
      genre_ids: [],
      id,
      name,
      original_language,
      original_name: '',
      overview: '',
      popularity: 0,
      poster_path: '',
      first_air_date: '',
      vote_average: 0,
      vote_count: 0,
      origin_country,
    };
  }

  function createTMDBRelatedMovie(id: number, title: string, original_language: string): TMDBRelatedMovie {
    return {
      adult: false,
      backdrop_path: '',
      genre_ids: [],
      id,
      title,
      original_language,
      original_title: '',
      overview: '',
      popularity: 0,
      poster_path: '',
      release_date: '',
      vote_average: 0,
      vote_count: 0,
      video: false,
    };
  }

  describe('filterUSOrEnglishShows', () => {
    it('should return shows with US origin', () => {
      const shows = [
        createTMDBRelatedShow(1, 'US Show', ['US'], 'en'),
        createTMDBRelatedShow(1, 'UK Show', ['GB'], 'en'),
        createTMDBRelatedShow(1, 'French Show', ['FR'], 'fr'),
      ];

      const result = filterUSOrEnglishShows(shows);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('US Show');
      expect(result[1].name).toBe('UK Show');
    });

    it('should return shows with English language even if not US origin', () => {
      const shows = [
        createTMDBRelatedShow(1, 'US Show', ['US'], 'en'),
        createTMDBRelatedShow(1, 'UK Show', ['GB'], 'en'),
        createTMDBRelatedShow(1, 'Canada Show', ['CA'], 'en'),
        createTMDBRelatedShow(1, 'French Show', ['FR'], 'fr'),
      ];

      const result = filterUSOrEnglishShows(shows);

      expect(result).toHaveLength(3);
      expect(result.map((show) => show.name)).toEqual(['US Show', 'UK Show', 'Canada Show']);
    });

    it('should exclude non-English shows that are not from the US', () => {
      const shows = [
        createTMDBRelatedShow(1, 'US Show', ['US'], 'en'),
        createTMDBRelatedShow(1, 'US Spanish Show', ['US'], 'es'),
        createTMDBRelatedShow(1, 'French Show', ['FR'], 'fr'),
        createTMDBRelatedShow(1, 'German Show', ['DE'], 'de'),
      ];

      const result = filterUSOrEnglishShows(shows);

      expect(result).toHaveLength(2);
      expect(result.map((show) => show.name)).toEqual(['US Show', 'US Spanish Show']);
    });

    it('should handle shows with multiple origin countries', () => {
      const shows = [
        createTMDBRelatedShow(1, 'US/UK Show', ['US', 'GB'], 'en'),
        createTMDBRelatedShow(1, 'Canada/France Show', ['CA', 'FR'], 'fr'),
        createTMDBRelatedShow(1, 'Germany/Italy Show', ['DE', 'IT'], 'de'),
      ];

      const result = filterUSOrEnglishShows(shows);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('US/UK Show');
    });

    it('should return an empty array when no shows match the criteria', () => {
      const shows = [
        createTMDBRelatedShow(1, 'French Show', ['FR'], 'fr'),
        createTMDBRelatedShow(1, 'German Show', ['DE'], 'de'),
        createTMDBRelatedShow(1, 'Spanish Show', ['ES'], 'es'),
      ];

      const result = filterUSOrEnglishShows(shows);

      expect(result).toHaveLength(0);
    });

    it('should handle an empty array', () => {
      const result = filterUSOrEnglishShows([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('filterEnglishMovies', () => {
    it('should handle an empty array', () => {
      const result = filterEnglishMovies([]);
      expect(result).toHaveLength(0);
    });

    it('should return movies with english language', () => {
      const movies = [
        createTMDBRelatedMovie(1, 'US Movie', 'en'),
        createTMDBRelatedMovie(1, 'UK Movie', 'en'),
        createTMDBRelatedMovie(1, 'French Movie', 'fr'),
      ];

      const result = filterEnglishMovies(movies);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('US Movie');
      expect(result[1].title).toBe('UK Movie');
    });
  });
});
