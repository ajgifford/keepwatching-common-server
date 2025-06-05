import {
  getEpisodeToAirId,
  getInProduction,
  getStreamingPremieredDate,
  getTMDBItemName,
  getTMDBPremieredDate,
  getUSMPARating,
  getUSNetwork,
  getUSRating,
  stripPrefix,
} from '@utils/contentUtility';

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
      const episode = { id: 12345 };
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

    it('should return default "PG" when no US certification is present', () => {
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

      expect(getUSMPARating(releaseDates)).toBe('PG');
    });

    it('should return default "PG" for empty results array', () => {
      const releaseDates = {
        results: [],
      };

      expect(getUSMPARating(releaseDates)).toBe('PG');
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
    it('should return releaseYear for movie type', () => {
      const result = { releaseYear: '2023', firstAirYear: '2022' };
      expect(getStreamingPremieredDate('movie', result)).toBe('2023');
    });

    it('should return firstAirYear for tv type', () => {
      const result = { releaseYear: '2023', firstAirYear: '2022' };
      expect(getStreamingPremieredDate('tv', result)).toBe('2022');
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
});
