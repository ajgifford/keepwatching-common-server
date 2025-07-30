import { TMDBPerson, TMDBPersonCredits } from '../../../src/types/tmdbTypes';
import { Person, SearchPerson, SearchPersonCredits } from '@ajgifford/keepwatching-types';
import { CACHE_KEY_PATTERNS, PERSON_KEYS } from '@constants/cacheKeys';
import * as personsDb from '@db/personsDb';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { PersonService, personService } from '@services/personService';
import { getTMDBService } from '@services/tmdbService';

jest.mock('@db/personsDb');
jest.mock('@services/tmdbService', () => ({
  getTMDBService: jest.fn(),
}));
jest.mock('@services/errorService');
jest.mock('@services/cacheService');

const mockTMDBService = {
  getPersonDetails: jest.fn(),
  getPersonCredits: jest.fn(),
} as any;

describe('PersonService', () => {
  let service: PersonService;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCache = {
      getOrSet: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
      invalidatePerson: jest.fn(),
      invalidatePattern: jest.fn(),
      invalidateAccount: jest.fn(),
      invalidateProfile: jest.fn(),
      invalidateProfileStatistics: jest.fn(),
      invalidateAccountStatistics: jest.fn(),
      flushAll: jest.fn(),
      getStats: jest.fn(),
      keys: jest.fn(),
    } as any;

    Object.setPrototypeOf(personService, PersonService.prototype);
    (personService as any).cache = mockCache;

    (errorService.handleError as jest.Mock).mockImplementation((error) => {
      throw error;
    });

    (getTMDBService as jest.Mock).mockReturnValue(mockTMDBService);

    service = personService;
  });

  describe('constructor', () => {
    it('should initialize with cache service instance', () => {
      new PersonService();
      expect(CacheService.getInstance).toHaveBeenCalled();
    });
  });

  describe('invalidatePersonCache', () => {
    it('should invalidate cache for specific person', async () => {
      const personId = 123;

      await service.invalidatePersonCache(personId);

      expect(mockCache.invalidatePerson).toHaveBeenCalledWith(personId);
    });
  });

  describe('invalidateAllPersonsCache', () => {
    it('should invalidate all person-related cache entries', async () => {
      await service.invalidateAllPersonsCache();

      expect(mockCache.invalidatePattern).toHaveBeenCalledWith(CACHE_KEY_PATTERNS.PERSON);
    });
  });

  describe('getPersonDetails', () => {
    const mockPerson: Person = {
      id: 123,
      tmdbId: 456,
      name: 'John Doe',
      gender: 2,
      biography: 'Actor biography',
      profileImage: '/profile.jpg',
      birthdate: '1980-01-01',
      deathdate: null,
      placeOfBirth: 'New York, NY',
    };

    it('should return person details from cache', async () => {
      const personId = 123;
      mockCache.getOrSet.mockResolvedValue(mockPerson);

      const result = await service.getPersonDetails(personId);

      expect(mockCache.getOrSet).toHaveBeenCalledWith(PERSON_KEYS.details(personId), expect.any(Function), 600);
      expect(result).toEqual(mockPerson);
    });

    it('should fetch from database when not in cache', async () => {
      const personId = 123;
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (personsDb.getPersonDetails as jest.Mock).mockResolvedValue(mockPerson);

      const result = await service.getPersonDetails(personId);

      expect(personsDb.getPersonDetails).toHaveBeenCalledWith(personId);
      expect(result).toEqual(mockPerson);
    });

    it('should handle database errors', async () => {
      const personId = 123;
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (personsDb.getPersonDetails as jest.Mock).mockRejectedValue(error);

      await expect(service.getPersonDetails(personId)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, `getPersonDetails(${personId})`);
    });
  });

  describe('getTMDBPersonDetails', () => {
    const mockTMDBPerson: TMDBPerson = {
      id: 456,
      name: 'John Doe',
      gender: 2,
      biography: 'Actor biography',
      profile_path: '/profile.jpg',
      birthday: '1980-01-01',
      deathday: null,
      place_of_birth: 'New York, NY',
      popularity: 85.5,
      known_for_department: 'Acting',
    };

    const expectedSearchPerson: SearchPerson = {
      id: 456,
      name: 'John Doe',
      profileImage: '/profile.jpg',
      department: 'Acting',
      popularity: 85.5,
      biography: 'Actor biography',
      birthday: '1980-01-01',
      birthplace: 'New York, NY',
      deathday: null,
    };

    it('should return TMDB person details from cache', async () => {
      const personId = 456;
      mockCache.getOrSet.mockResolvedValue(expectedSearchPerson);

      const result = await service.getTMDBPersonDetails(personId);

      expect(mockCache.getOrSet).toHaveBeenCalledWith(PERSON_KEYS.tmdbDetails(personId), expect.any(Function), 600);
      expect(result).toEqual(expectedSearchPerson);
    });

    it('should fetch from TMDB API when not in cache', async () => {
      const personId = 456;
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      mockTMDBService.getPersonDetails.mockResolvedValue(mockTMDBPerson);

      const result = await service.getTMDBPersonDetails(personId);

      expect(mockTMDBService.getPersonDetails).toHaveBeenCalledWith(personId);
      expect(result).toEqual(expectedSearchPerson);
    });

    it('should handle TMDB API errors', async () => {
      const personId = 456;
      const error = new Error('TMDB API error');
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      mockTMDBService.getPersonDetails.mockRejectedValue(error);

      await expect(service.getTMDBPersonDetails(personId)).rejects.toThrow('TMDB API error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, `getTMDBPersonDetails(${personId})`);
    });
  });

  describe('getTMDBPersonCredits', () => {
    const mockTMDBCredits: TMDBPersonCredits = {
      cast: [
        {
          id: 1,
          title: 'Movie Title',
          poster_path: '/poster1.jpg',
          release_date: '2023-01-01',
          character: 'Main Character',
          job: 'Actor',
          media_type: 'movie',
        },
        {
          id: 2,
          name: 'Another Show',
          poster_path: '/poster2.jpg',
          first_air_date: '2023-04-01',
          character: 'Supporting Character',
          job: 'Actor',
          media_type: 'tv',
        },
      ],
      crew: [
        {
          id: 3,
          title: 'Director Movie',
          poster_path: '/poster3.jpg',
          release_date: '2023-05-01',
          character: 'Director',
          job: 'Director',
          media_type: 'movie',
        },
      ],
    };

    const expectedCredits: SearchPersonCredits = {
      cast: [
        {
          tmdbId: 1,
          title: 'Movie Title',
          posterImage: '/poster1.jpg',
          releaseDate: '2023-01-01',
          character: 'Main Character',
          job: 'Actor',
          mediaType: 'movie',
        },
        {
          tmdbId: 2,
          title: 'Another Show',
          posterImage: '/poster2.jpg',
          releaseDate: '2023-04-01',
          character: 'Supporting Character',
          job: 'Actor',
          mediaType: 'tv',
        },
      ],
      crew: [
        {
          tmdbId: 3,
          title: 'Director Movie',
          posterImage: '/poster3.jpg',
          releaseDate: '2023-05-01',
          character: 'Director',
          job: 'Director',
          mediaType: 'movie',
        },
      ],
    };

    it('should return TMDB person credits from cache', async () => {
      const personId = 456;
      mockCache.getOrSet.mockResolvedValue(expectedCredits);

      const result = await service.getTMDBPersonCredits(personId);

      expect(mockCache.getOrSet).toHaveBeenCalledWith(PERSON_KEYS.tmdbCredits(personId), expect.any(Function), 600);
      expect(result).toEqual(expectedCredits);
    });

    it('should fetch from TMDB API and transform credits when not in cache', async () => {
      const personId = 456;
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      mockTMDBService.getPersonCredits.mockResolvedValue(mockTMDBCredits);

      const result = await service.getTMDBPersonCredits(personId);

      expect(mockTMDBService.getPersonCredits).toHaveBeenCalledWith(personId);
      expect(result).toEqual(expectedCredits);
    });

    it('should handle empty credits arrays', async () => {
      const personId = 456;
      const emptyCredits: TMDBPersonCredits = { cast: [], crew: [] };
      const expectedEmptyCredits: SearchPersonCredits = { cast: [], crew: [] };

      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      mockTMDBService.getPersonCredits.mockResolvedValue(emptyCredits);

      const result = await service.getTMDBPersonCredits(personId);

      expect(result).toEqual(expectedEmptyCredits);
    });

    it('should prioritize title over name for movies and name over title for TV shows', async () => {
      const personId = 456;
      const mixedCredits: TMDBPersonCredits = {
        cast: [
          {
            id: 1,
            title: 'Movie Title',
            poster_path: '/poster1.jpg',
            release_date: '2023-01-01',
            character: 'Character',
            job: 'Actor',
            media_type: 'movie',
          },
          {
            id: 2,
            name: 'Show Name',
            poster_path: '/poster2.jpg',
            first_air_date: '2023-04-01',
            character: 'Character',
            job: 'Actor',
            media_type: 'tv',
          },
        ],
        crew: [],
      };

      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      mockTMDBService.getPersonCredits.mockResolvedValue(mixedCredits);

      const result = await service.getTMDBPersonCredits(personId);

      // Should use title for movie and name for TV show
      expect(result.cast[0].title).toBe('Movie Title');
      expect(result.cast[1].title).toBe('Show Name');
    });

    it('should handle missing poster paths and release dates', async () => {
      const personId = 456;
      const incompleteCredits: TMDBPersonCredits = {
        cast: [
          {
            id: 1,
            title: 'Movie Title',
            poster_path: null as any,
            release_date: null as any,
            first_air_date: null as any,
            character: 'Character',
            job: 'Actor',
            media_type: 'movie',
          },
        ],
        crew: [],
      };

      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      mockTMDBService.getPersonCredits.mockResolvedValue(incompleteCredits);

      const result = await service.getTMDBPersonCredits(personId);

      expect(result.cast[0].posterImage).toBeNull();
      expect(result.cast[0].releaseDate).toBe('');
    });

    it('should handle TMDB API errors', async () => {
      const personId = 456;
      const error = new Error('TMDB API error');
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      mockTMDBService.getPersonCredits.mockRejectedValue(error);

      await expect(service.getTMDBPersonCredits(personId)).rejects.toThrow('TMDB API error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, `getTMDBPersonCredits(${personId})`);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle cache service errors gracefully', async () => {
      const personId = 123;
      const cacheError = new Error('Cache service error');
      mockCache.getOrSet.mockRejectedValue(cacheError);

      await expect(service.getPersonDetails(personId)).rejects.toThrow('Cache service error');
      expect(errorService.handleError).toHaveBeenCalledWith(cacheError, `getPersonDetails(${personId})`);
    });

    it('should handle negative person IDs', async () => {
      const personId = -1;
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (personsDb.getPersonDetails as jest.Mock).mockResolvedValue(null as any);

      await expect(service.getPersonDetails(personId)).resolves.toBeNull();
    });

    it('should handle zero person IDs', async () => {
      const personId = 0;
      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (personsDb.getPersonDetails as jest.Mock).mockResolvedValue(null as any);

      await expect(service.getPersonDetails(personId)).resolves.toBeNull();
    });
  });

  describe('integration scenarios', () => {
    it('should use correct cache keys for all operations', async () => {
      const personId = 123;

      // Test getPersonDetails cache key
      mockCache.getOrSet.mockResolvedValue({} as Person);
      await service.getPersonDetails(personId);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(PERSON_KEYS.details(personId), expect.any(Function), 600);

      // Test getTMDBPersonDetails cache key
      mockCache.getOrSet.mockResolvedValue({} as SearchPerson);
      await service.getTMDBPersonDetails(personId);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(PERSON_KEYS.tmdbDetails(personId), expect.any(Function), 600);

      // Test getTMDBPersonCredits cache key
      mockCache.getOrSet.mockResolvedValue({} as SearchPersonCredits);
      await service.getTMDBPersonCredits(personId);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(PERSON_KEYS.tmdbCredits(personId), expect.any(Function), 600);
    });

    it('should maintain consistent cache TTL across all methods', async () => {
      const personId = 123;
      const expectedTTL = 600;

      mockCache.getOrSet.mockResolvedValue({});

      await service.getPersonDetails(personId);
      await service.getTMDBPersonDetails(personId);
      await service.getTMDBPersonCredits(personId);

      // Verify all cache calls use the same TTL
      expect(mockCache.getOrSet).toHaveBeenCalledTimes(3);
      mockCache.getOrSet.mock.calls.forEach((call) => {
        expect(call[2]).toBe(expectedTTL);
      });
    });
  });
});
