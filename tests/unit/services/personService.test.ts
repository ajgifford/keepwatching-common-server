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

  describe('getPersons', () => {
    it('should return paginated persons list', async () => {
      const firstLetter = 'A';
      const page = 1;
      const offset = 0;
      const limit = 10;
      const totalCount = 25;
      const mockPersons = [
        {
          id: 1,
          tmdbId: 456,
          name: 'Alice Johnson',
          gender: 1,
          biography: 'Actor biography',
          profileImage: '/alice.jpg',
          birthdate: '1985-01-01',
          deathdate: null,
          placeOfBirth: 'Los Angeles, CA',
        },
      ];

      const expectedResult = {
        persons: mockPersons,
        pagination: {
          totalCount,
          totalPages: 3,
          currentPage: page,
          limit,
          hasNextPage: true,
          hasPrevPage: false,
        },
      };

      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (personsDb.getPersonsAlphaCount as jest.Mock).mockResolvedValue(totalCount);
      (personsDb.getPersons as jest.Mock).mockResolvedValue(mockPersons);

      const result = await service.getPersons(firstLetter, page, offset, limit);

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        PERSON_KEYS.list(firstLetter, page, offset, limit),
        expect.any(Function),
      );
      expect(personsDb.getPersonsAlphaCount).toHaveBeenCalledWith(firstLetter);
      expect(personsDb.getPersons).toHaveBeenCalledWith(firstLetter, offset, limit);
      expect(result).toEqual(expectedResult);
    });

    it('should calculate pagination correctly for last page', async () => {
      const firstLetter = 'B';
      const page = 3;
      const offset = 20;
      const limit = 10;
      const totalCount = 25;
      const mockPersons: Person[] = [];

      mockCache.getOrSet.mockImplementation(async (_key, fn) => fn());
      (personsDb.getPersonsAlphaCount as jest.Mock).mockResolvedValue(totalCount);
      (personsDb.getPersons as jest.Mock).mockResolvedValue(mockPersons);

      const result = await service.getPersons(firstLetter, page, offset, limit);

      expect(result.pagination).toEqual({
        totalCount,
        totalPages: 3,
        currentPage: page,
        limit,
        hasNextPage: false,
        hasPrevPage: true,
      });
    });

    it('should handle errors properly', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockRejectedValue(error);

      await expect(service.getPersons('A', 1, 0, 10)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getPersons(A, 1, 0, 10)');
    });
  });

  describe('getPersonsCount', () => {
    it('should return total persons count', async () => {
      const expectedCount = 150;
      (personsDb.getPersonsCount as jest.Mock).mockResolvedValue(expectedCount);

      const result = await service.getPersonsCount();

      expect(result).toBe(expectedCount);
      expect(personsDb.getPersonsCount).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const error = new Error('Count query failed');
      (personsDb.getPersonsCount as jest.Mock).mockRejectedValue(error);

      await expect(service.getPersonsCount()).rejects.toThrow('Count query failed');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getPersonsCount()');
    });
  });

  describe('getPeopleForUpdates', () => {
    it('should return people for specific block number', async () => {
      const blockNumber = 5;
      const mockPeople = [
        {
          id: 1,
          tmdbId: 456,
          name: 'John Doe',
          gender: 2,
          biography: 'Actor',
          profileImage: '/john.jpg',
          birthdate: '1980-01-01',
          deathdate: null,
          placeOfBirth: 'New York, NY',
        },
      ];

      (personsDb.getPeopleForUpdates as jest.Mock).mockResolvedValue(mockPeople);

      const result = await service.getPeopleForUpdates(blockNumber);

      expect(result).toEqual(mockPeople);
      expect(personsDb.getPeopleForUpdates).toHaveBeenCalledWith(blockNumber);
    });

    it('should handle database errors', async () => {
      const blockNumber = 3;
      const error = new Error('Update query failed');
      (personsDb.getPeopleForUpdates as jest.Mock).mockRejectedValue(error);

      await expect(service.getPeopleForUpdates(blockNumber)).rejects.toThrow('Update query failed');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getPeopleForUpdates()');
    });
  });

  describe('updatePerson', () => {
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

    const mockTMDBPerson: TMDBPerson = {
      id: 456,
      name: 'John Doe Updated',
      gender: 2,
      biography: 'Updated biography',
      profile_path: '/new-profile.jpg',
      birthday: '1980-01-01',
      deathday: null,
      place_of_birth: 'New York, NY',
      popularity: 85.5,
      known_for_department: 'Acting',
    };

    it('should update person successfully with changes', async () => {
      (personsDb.getPerson as jest.Mock).mockResolvedValue(mockPerson);
      mockTMDBService.getPersonDetails.mockResolvedValue(mockTMDBPerson);
      (personsDb.updatePerson as jest.Mock).mockResolvedValue(undefined);

      const result = await service.updatePerson(123, 456);

      expect(result).toEqual({
        personId: 123,
        success: true,
        hadUpdates: true,
      });
      expect(personsDb.getPerson).toHaveBeenCalledWith(123);
      expect(mockTMDBService.getPersonDetails).toHaveBeenCalledWith(456);
      expect(personsDb.updatePerson).toHaveBeenCalled();
    });

    it('should update person successfully without changes', async () => {
      const unchangedTMDBPerson = {
        ...mockTMDBPerson,
        name: 'John Doe',
        biography: 'Actor biography',
        profile_path: '/profile.jpg',
      };
      (personsDb.getPerson as jest.Mock).mockResolvedValue(mockPerson);
      mockTMDBService.getPersonDetails.mockResolvedValue(unchangedTMDBPerson);

      const result = await service.updatePerson(123, 456);

      expect(result).toEqual({
        personId: 123,
        success: true,
        hadUpdates: false,
      });
      expect(personsDb.updatePerson).not.toHaveBeenCalled();
    });

    it('should handle errors and log them', async () => {
      const error = new Error('Update failed');
      (personsDb.getPerson as jest.Mock).mockRejectedValue(error);

      await expect(service.updatePerson(123, 456)).rejects.toThrow('Update failed');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'updatePerson(123)');
    });
  });

  describe('checkAndUpdatePerson', () => {
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

    const mockTMDBPerson: TMDBPerson = {
      id: 456,
      name: 'John Doe Updated',
      gender: 2,
      biography: 'Updated biography',
      profile_path: '/new-profile.jpg',
      birthday: '1980-01-01',
      deathday: null,
      place_of_birth: 'New York, NY',
      popularity: 85.5,
      known_for_department: 'Acting',
    };

    it('should check and update person with changes', async () => {
      mockTMDBService.getPersonDetails.mockResolvedValue(mockTMDBPerson);
      (personsDb.updatePerson as jest.Mock).mockResolvedValue(undefined);

      const result = await service.checkAndUpdatePerson(mockPerson);

      expect(result).toEqual({
        personId: 123,
        success: true,
        hadUpdates: true,
      });
      expect(mockTMDBService.getPersonDetails).toHaveBeenCalledWith(456);
      expect(personsDb.updatePerson).toHaveBeenCalled();
    });

    it('should check and update person without changes', async () => {
      const unchangedTMDBPerson = {
        ...mockTMDBPerson,
        name: 'John Doe',
        biography: 'Actor biography',
        profile_path: '/profile.jpg',
      };
      mockTMDBService.getPersonDetails.mockResolvedValue(unchangedTMDBPerson);

      const result = await service.checkAndUpdatePerson(mockPerson);

      expect(result).toEqual({
        personId: 123,
        success: true,
        hadUpdates: false,
      });
      expect(personsDb.updatePerson).not.toHaveBeenCalled();
    });

    it('should handle TMDB API errors', async () => {
      const error = new Error('TMDB API error');
      mockTMDBService.getPersonDetails.mockRejectedValue(error);

      await expect(service.checkAndUpdatePerson(mockPerson)).rejects.toThrow('TMDB API error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'checkAndUpdatePerson(123)');
    });
  });

  describe('getTodayBlockInfo', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return today block information', async () => {
      const mockDate = new Date('2023-06-15T10:00:00Z');
      jest.setSystemTime(mockDate);

      const mockPeople = [{ id: 1 }, { id: 2 }];
      jest.spyOn(service, 'calculateBlockNumber').mockReturnValue(5);
      jest.spyOn(service, 'getPeopleForUpdates').mockResolvedValue(mockPeople as any);

      const result = await service.getTodayBlockInfo();

      expect(result).toEqual({
        blockNumber: 5,
        date: '2023-06-15',
        totalPeople: 2,
        nextBlockDate: '2023-06-27',
      });
    });
  });

  describe('calculateBlockNumber', () => {
    it('should calculate correct block number for different dates', () => {
      const testCases = [
        new Date('2023-01-01'),
        new Date('2023-01-13'),
        new Date('2023-06-15'),
        new Date('2023-12-31'),
      ];

      testCases.forEach((date) => {
        const result = service.calculateBlockNumber(date);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(12);
      });
    });

    it('should handle leap year correctly', () => {
      const leapYearDate = new Date('2024-02-29');
      const result = service.calculateBlockNumber(leapYearDate);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(12);
    });
  });

  describe('compareAndUpdate (integration through public methods)', () => {
    const basePerson: Person = {
      id: 123,
      tmdbId: 456,
      name: 'John Doe',
      gender: 2,
      biography: 'Original biography',
      profileImage: '/original.jpg',
      birthdate: '1980-01-01',
      deathdate: null,
      placeOfBirth: 'New York, NY',
    };

    it('should detect and update all changed fields', async () => {
      const changedTMDBPerson: TMDBPerson = {
        id: 456,
        name: 'John Doe Updated',
        gender: 1,
        biography: 'Updated biography',
        profile_path: '/updated.jpg',
        birthday: '1980-01-02',
        deathday: '2023-01-01',
        place_of_birth: 'Los Angeles, CA',
        popularity: 85.5,
        known_for_department: 'Acting',
      };

      mockTMDBService.getPersonDetails.mockResolvedValue(changedTMDBPerson);
      (personsDb.updatePerson as jest.Mock).mockResolvedValue(undefined);

      const result = await service.checkAndUpdatePerson(basePerson);

      expect(result.hadUpdates).toBe(true);
      expect(personsDb.updatePerson).toHaveBeenCalledWith({
        id: 123,
        tmdb_id: 456,
        name: 'John Doe Updated',
        gender: 1,
        biography: 'Updated biography',
        profile_image: '/updated.jpg',
        birthdate: '1980-01-02',
        deathdate: '2023-01-01',
        place_of_birth: 'Los Angeles, CA',
      });
    });

    it('should not update when no changes detected', async () => {
      const unchangedTMDBPerson: TMDBPerson = {
        id: 456,
        name: 'John Doe',
        gender: 2,
        biography: 'Original biography',
        profile_path: '/original.jpg',
        birthday: '1980-01-01',
        deathday: null,
        place_of_birth: 'New York, NY',
        popularity: 85.5,
        known_for_department: 'Acting',
      };

      mockTMDBService.getPersonDetails.mockResolvedValue(unchangedTMDBPerson);

      const result = await service.checkAndUpdatePerson(basePerson);

      expect(result.hadUpdates).toBe(false);
      expect(personsDb.updatePerson).not.toHaveBeenCalled();
    });

    it('should handle null to value transitions', async () => {
      const personWithNulls: Person = {
        ...basePerson,
        biography: null as any,
        profileImage: null as any,
        birthdate: null as any,
        deathdate: null as any,
        placeOfBirth: null as any,
      };

      const tmdbPersonWithValues: TMDBPerson = {
        id: 456,
        name: 'John Doe',
        gender: 2,
        biography: 'New biography',
        profile_path: '/new.jpg',
        birthday: '1980-01-01',
        deathday: '2023-01-01',
        place_of_birth: 'New York, NY',
        popularity: 85.5,
        known_for_department: 'Acting',
      };

      mockTMDBService.getPersonDetails.mockResolvedValue(tmdbPersonWithValues);
      (personsDb.updatePerson as jest.Mock).mockResolvedValue(undefined);

      const result = await service.checkAndUpdatePerson(personWithNulls);

      expect(result.hadUpdates).toBe(true);
      expect(personsDb.updatePerson).toHaveBeenCalled();
    });

    it('should handle value to null transitions correctly', async () => {
      const tmdbPersonWithNulls = {
        id: 456,
        name: 'John Doe',
        gender: 2,
        biography: null,
        profile_path: null,
        birthday: null,
        deathday: null,
        place_of_birth: null,
        popularity: 85.5,
        known_for_department: 'Acting',
      } as unknown as TMDBPerson;

      mockTMDBService.getPersonDetails.mockResolvedValue(tmdbPersonWithNulls);

      const result = await service.checkAndUpdatePerson(basePerson);

      // Should not update when TMDB values are null/empty
      expect(result.hadUpdates).toBe(false);
      expect(personsDb.updatePerson).not.toHaveBeenCalled();
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

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(personService).toBeInstanceOf(PersonService);
    });
  });
});
