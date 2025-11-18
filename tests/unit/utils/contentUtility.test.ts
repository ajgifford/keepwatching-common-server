import { TMDBMovie } from '../../../src/types/tmdbTypes';
import {
  getDirectors,
  getEpisodeToAirId,
  getInProduction,
  getStreamingPremieredDate,
  getTMDBItemName,
  getTMDBPremieredDate,
  getUSMPARating,
  getUSNetwork,
  getUSProductionCompanies,
  getUSRating,
  isFutureSeason,
  stripPrefix,
} from '@utils/contentUtility';
import { Show, ShowType } from 'streaming-availability';

describe('contentUtility', () => {
  describe('getUSNetwork', () => {
    it('should return the name of a US network when present', () => {
      const networks = [
        {
          id: '1',
          logo_path: '/path/to/logo1.png',
          name: 'Non-US Network',
          origin_country: 'UK',
        },
        {
          id: '2',
          logo_path: '/path/to/logo2.png',
          name: 'US Network',
          origin_country: 'US',
        },
      ];

      expect(getUSNetwork(networks)).toBe('US Network');
    });

    it('should return null when no US network is present', () => {
      const networks = [
        {
          id: '1',
          logo_path: '/path/to/logo1.png',
          name: 'Non-US Network',
          origin_country: 'UK',
        },
        {
          id: '2',
          logo_path: '/path/to/logo2.png',
          name: 'Another Network',
          origin_country: 'CA',
        },
      ];

      expect(getUSNetwork(networks)).toBeNull();
    });

    it('should return null for empty networks array', () => {
      expect(getUSNetwork([])).toBeNull();
    });
  });

  describe('getUSRating', () => {
    it('should return the US rating when present', () => {
      const contentRatings = {
        results: [
          {
            descriptors: [],
            iso_3166_1: 'UK',
            rating: 'PG',
          },
          {
            descriptors: [],
            iso_3166_1: 'US',
            rating: 'TV-MA',
          },
        ],
      };

      expect(getUSRating(contentRatings)).toBe('TV-MA');
    });

    it('should return default "TV-G" when no US rating is present', () => {
      const contentRatings = {
        results: [
          {
            descriptors: [],
            iso_3166_1: 'UK',
            rating: 'PG',
          },
          {
            descriptors: [],
            iso_3166_1: 'CA',
            rating: 'G',
          },
        ],
      };

      expect(getUSRating(contentRatings)).toBe('TV-G');
    });

    it('should return default "TV-G" for empty results array', () => {
      const contentRatings = {
        results: [],
      };

      expect(getUSRating(contentRatings)).toBe('TV-G');
    });
  });

  describe('getInProduction', () => {
    it('should return 1 when in_production is true', () => {
      const show = { in_production: true };
      expect(getInProduction(show)).toBe(1);
    });

    it('should return 0 when in_production is false', () => {
      const show = { in_production: false };
      expect(getInProduction(show)).toBe(0);
    });
  });

  describe('getEpisodeToAirId', () => {
    it('should return the episode id when episode is present', () => {
      const episode = {
        id: 12345,
        air_date: '',
        episode_number: 1,
        name: '',
        overview: '',
        production_code: '',
        season_number: 1,
        still_path: '',
        vote_average: 1,
        vote_count: 1,
      };
      expect(getEpisodeToAirId(episode)).toBe(12345);
    });

    it('should return null when episode is null', () => {
      expect(getEpisodeToAirId(null)).toBeNull();
    });
  });

  describe('getUSMPARating', () => {
    it('should return the US certification when present', () => {
      const releaseDates = {
        results: [
          {
            iso_3166_1: 'UK',
            release_dates: [
              {
                certification: '15',
                descriptors: [],
                iso_639_1: 'en',
                note: '',
                release_date: new Date('2023-01-01'),
                type: 3,
              },
            ],
          },
          {
            iso_3166_1: 'US',
            release_dates: [
              {
                certification: 'PG-13',
                descriptors: [],
                iso_639_1: 'en',
                note: '',
                release_date: new Date('2023-01-15'),
                type: 3,
              },
            ],
          },
        ],
      };

      expect(getUSMPARating(releaseDates)).toBe('PG-13');
    });

    it('should return default "unknown" when no US certification is present', () => {
      const releaseDates = {
        results: [
          {
            iso_3166_1: 'UK',
            release_dates: [
              {
                certification: '15',
                descriptors: [],
                iso_639_1: 'en',
                note: '',
                release_date: new Date('2023-01-01'),
                type: 3,
              },
            ],
          },
        ],
      };

      expect(getUSMPARating(releaseDates)).toBe('Unknown');
    });

    it('should return default "unknown" for empty results array', () => {
      const releaseDates = {
        results: [],
      };

      expect(getUSMPARating(releaseDates)).toBe('Unknown');
    });
  });

  describe('getDirectors', () => {
    it('should return the director when present', () => {
      const movie = {
        credits: {
          crew: [
            {
              id: 1,
              department: 'Movie',
              job: 'Director',
              name: 'John Smith',
              credit_id: '',
              gender: 1,
              profile_path: 'image.png',
            },
          ],
        },
      } as TMDBMovie;

      expect(getDirectors(movie)).toBe('John Smith');
    });

    it('should return multiple directors when present', () => {
      const movie = {
        credits: {
          crew: [
            {
              id: 1,
              department: 'Movie',
              job: 'Director',
              name: 'John Smith',
              credit_id: '',
              gender: 1,
              profile_path: 'image.png',
            },
            {
              id: 2,
              department: 'Movie',
              job: 'Director',
              name: 'John Doe',
              credit_id: '',
              gender: 1,
              profile_path: 'image.png',
            },
          ],
        },
      } as TMDBMovie;

      expect(getDirectors(movie)).toBe('John Smith, John Doe');
    });

    it('should return default "unknown" when no director is present', () => {
      const movie = {
        credits: {
          crew: [
            {
              id: 1,
              department: 'Movie',
              job: 'Camera Operator',
              name: 'Tyson Jones',
              credit_id: '',
              gender: 1,
              profile_path: 'image.png',
            },
          ],
        },
      } as TMDBMovie;

      expect(getDirectors(movie)).toBe('Unknown');
    });
  });

  describe('getUSProductionCompanies', () => {
    it('should return the US production company when present', () => {
      const productionCompanies = [
        {
          id: 1,
          logo_path: '',
          name: 'MGM',
          origin_country: 'US',
        },
        {
          id: 2,
          logo_path: '',
          name: 'MGM Global',
          origin_country: 'FR',
        },
      ];

      expect(getUSProductionCompanies(productionCompanies)).toBe('MGM');
    });

    it('should return multiple production companies when present', () => {
      const productionCompanies = [
        {
          id: 1,
          logo_path: '',
          name: 'MGM',
          origin_country: 'US',
        },
        {
          id: 2,
          logo_path: '',
          name: 'MGM Global',
          origin_country: 'FR',
        },
        {
          id: 3,
          logo_path: '',
          name: 'Blue Sky',
          origin_country: 'US',
        },
      ];

      expect(getUSProductionCompanies(productionCompanies)).toBe('MGM, Blue Sky');
    });

    it('should return the first three production companies when multiple are present', () => {
      const productionCompanies = [
        {
          id: 1,
          logo_path: '',
          name: 'MGM',
          origin_country: 'US',
        },
        {
          id: 2,
          logo_path: '',
          name: 'MGM Global',
          origin_country: 'US',
        },
        {
          id: 3,
          logo_path: '',
          name: 'Blue Sky',
          origin_country: 'US',
        },
        {
          id: 4,
          logo_path: '',
          name: 'Red Sky',
          origin_country: 'US',
        },
        {
          id: 5,
          logo_path: '',
          name: 'Purple Sky',
          origin_country: 'US',
        },
      ];

      expect(getUSProductionCompanies(productionCompanies)).toBe('MGM, MGM Global, Blue Sky');
    });

    it('should return default "unknown" when no US production company is present', () => {
      const productionCompanies = [
        {
          id: 2,
          logo_path: '',
          name: 'MGM Global',
          origin_country: 'FR',
        },
      ];

      expect(getUSProductionCompanies(productionCompanies)).toBe('Unknown');
    });
  });

  describe('stripPrefix', () => {
    it('should remove "tv/" prefix from input string', () => {
      expect(stripPrefix('tv/show-name')).toBe('show-name');
    });

    it('should remove "movie/" prefix from input string', () => {
      expect(stripPrefix('movie/movie-name')).toBe('movie-name');
    });

    it('should return input string if no matching prefix is found', () => {
      expect(stripPrefix('show-name')).toBe('show-name');
    });
  });

  describe('getStreamingPremieredDate', () => {
    const mockMovieShow: Show = {
      itemType: 'show',
      showType: ShowType.Movie,
      id: 'movie-001',
      imdbId: 'tt1234567',
      tmdbId: '98765',
      title: 'Example Movie',
      overview: 'A thrilling adventure of a lifetime.',
      releaseYear: 2022,
      firstAirYear: 2023,
      originalTitle: 'Example Movie Original',
      genres: [{ id: '1', name: 'Adventure' }],
      directors: ['Jane Doe'],
      cast: ['Actor A', 'Actor B'],
      rating: 8.2,
      runtime: 130,
      imageSet: {
        verticalPoster: {
          w240: '',
          w360: '',
          w480: '',
          w600: '',
          w720: '',
        },
        horizontalPoster: {
          w360: '',
          w480: '',
          w720: '',
          w1080: '',
          w1440: '',
        },
      },
      streamingOptions: {
        US: [],
      },
    };
    it('should return releaseYear for movie type', () => {
      expect(getStreamingPremieredDate('movie', mockMovieShow)).toBe('2022');
    });

    it('should return firstAirYear for tv type', () => {
      const mockTVShow: Show = {
        itemType: 'show',
        showType: 'series',
        id: 'tv-001',
        imdbId: 'tt7654321',
        tmdbId: '12345',
        title: 'Example Series',
        overview: 'A gripping drama about interconnected lives.',
        releaseYear: 2022,
        firstAirYear: 2018,
        lastAirYear: 2021,
        originalTitle: 'Example Series Original',
        genres: [{ id: '2', name: 'Drama' }],
        creators: ['John Smith'],
        cast: ['Actor X', 'Actor Y', 'Actor Z'],
        rating: 9.1,
        seasonCount: 3,
        episodeCount: 30,
        imageSet: {
          verticalPoster: {
            w240: '',
            w360: '',
            w480: '',
            w600: '',
            w720: '',
          },
          horizontalPoster: {
            w360: '',
            w480: '',
            w720: '',
            w1080: '',
            w1440: '',
          },
        },
        streamingOptions: {
          US: [],
        },
      };
      expect(getStreamingPremieredDate('tv', mockTVShow)).toBe('2018');
    });
  });

  describe('getTMDBPremieredDate', () => {
    it('should return release_date for movie type', () => {
      const result = { release_date: '2023-01-15', first_air_date: '2022-06-10' };
      expect(getTMDBPremieredDate('movie', result)).toBe('2023-01-15');
    });

    it('should return first_air_date for tv type', () => {
      const result = { release_date: '2023-01-15', first_air_date: '2022-06-10' };
      expect(getTMDBPremieredDate('tv', result)).toBe('2022-06-10');
    });
  });

  describe('getTMDBItemName', () => {
    it('should return title for movie type', () => {
      const result = { title: 'Movie Title', name: 'Show Name' };
      expect(getTMDBItemName('movie', result)).toBe('Movie Title');
    });

    it('should return name for tv type', () => {
      const result = { title: 'Movie Title', name: 'Show Name' };
      expect(getTMDBItemName('tv', result)).toBe('Show Name');
    });
  });

  describe('isFutureSeason', () => {
    it('should return if there is no season air date', () => {
      expect(isFutureSeason(null, 0)).toBe(true);
    });

    it('should return true if the date is in the future', () => {
      expect(isFutureSeason('2099-12-31T00:00:00', 0)).toBe(true);
    });

    it('should return true if there are no episodes', () => {
      expect(isFutureSeason('2025-05-01T00:00:00', 0)).toBe(true);
    });

    it('should return false if its not a future season', () => {
      expect(isFutureSeason('2025-05-01T00:00:00', 10)).toBe(false);
    });
  });
});
