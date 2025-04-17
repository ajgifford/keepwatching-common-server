import { ACCOUNT_KEYS, INVALIDATION_PATTERNS, PROFILE_KEYS } from '@constants/cacheKeys';
import { cliLogger } from '@logger/logger';
import { CacheService } from '@services/cacheService';
import NodeCache from 'node-cache';

// Mock dependencies
jest.mock('@logger/logger', () => ({
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('node-cache');

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockNodeCache: jest.Mocked<NodeCache>;

  beforeEach(() => {
    // Reset singleton instance for each test
    Object.defineProperty(CacheService, 'instance', { value: null, writable: true });

    // Mock NodeCache implementation
    mockNodeCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      flushAll: jest.fn(),
      getStats: jest.fn(),
    } as unknown as jest.Mocked<NodeCache>;

    (NodeCache as unknown as jest.Mock).mockImplementation(() => mockNodeCache);

    // Get a fresh instance with our mocks
    cacheService = CacheService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should create a new instance when called for the first time', () => {
      // Reset mock call count before test
      jest.clearAllMocks();
      // Force null instance before test
      Object.defineProperty(CacheService, 'instance', { value: null, writable: true });

      const instance = CacheService.getInstance();

      expect(instance).toBeInstanceOf(CacheService);
      expect(NodeCache).toHaveBeenCalledTimes(1);
      expect(NodeCache).toHaveBeenCalledWith({
        stdTTL: 300,
        checkperiod: 600,
        useClones: false,
      });
    });

    it('should return the same instance when called multiple times', () => {
      const instance1 = CacheService.getInstance();
      const instance2 = CacheService.getInstance();
      const instance3 = CacheService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
      expect(NodeCache).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value when it exists', async () => {
      const key = 'test-key';
      const cachedValue = { data: 'cached-data' };
      const fn = jest.fn().mockResolvedValue({ data: 'new-data' });

      mockNodeCache.get.mockReturnValue(cachedValue);

      const result = await cacheService.getOrSet(key, fn);

      expect(result).toBe(cachedValue);
      expect(mockNodeCache.get).toHaveBeenCalledWith(key);
      expect(fn).not.toHaveBeenCalled();
      expect(mockNodeCache.set).not.toHaveBeenCalled();
    });

    it('should call function and cache result on cache miss', async () => {
      const key = 'test-key';
      const ttl = 600;
      const newValue = { data: 'new-data' };
      const fn = jest.fn().mockResolvedValue(newValue);

      mockNodeCache.get.mockReturnValue(undefined);
      mockNodeCache.set.mockReturnValue(true);

      const result = await cacheService.getOrSet(key, fn, ttl);

      expect(result).toBe(newValue);
      expect(mockNodeCache.get).toHaveBeenCalledWith(key);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(mockNodeCache.set).toHaveBeenCalledWith(key, newValue, ttl);
    });

    it('should use default TTL when not provided', async () => {
      const key = 'test-key';
      const newValue = { data: 'new-data' };
      const fn = jest.fn().mockResolvedValue(newValue);

      mockNodeCache.get.mockReturnValue(undefined);

      await cacheService.getOrSet(key, fn);

      expect(mockNodeCache.set).toHaveBeenCalledWith(key, newValue, 300); // Default TTL is 300
    });

    it('should log error and rethrow when function throws', async () => {
      const key = 'test-key';
      const error = new Error('Test error');
      const fn = jest.fn().mockRejectedValue(error);

      mockNodeCache.get.mockReturnValue(undefined);

      await expect(cacheService.getOrSet(key, fn)).rejects.toThrow(error);
      expect(cliLogger.error).toHaveBeenCalledWith(`Cache miss and fetch error for key ${key}: ${error.message}`);
      expect(mockNodeCache.set).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should return cached value when it exists', () => {
      const key = 'test-key';
      const cachedValue = { data: 'cached-data' };

      mockNodeCache.get.mockReturnValue(cachedValue);

      const result = cacheService.get(key);

      expect(result).toBe(cachedValue);
      expect(mockNodeCache.get).toHaveBeenCalledWith(key);
    });

    it('should return undefined when value does not exist', () => {
      const key = 'test-key';

      mockNodeCache.get.mockReturnValue(undefined);

      const result = cacheService.get(key);

      expect(result).toBeUndefined();
      expect(mockNodeCache.get).toHaveBeenCalledWith(key);
    });
  });

  describe('set', () => {
    it('should set value with provided TTL', () => {
      const key = 'test-key';
      const value = { data: 'test-data' };
      const ttl = 600;

      mockNodeCache.set.mockReturnValue(true);

      const result = cacheService.set(key, value, ttl);

      expect(result).toBe(true);
      expect(mockNodeCache.set).toHaveBeenCalledWith(key, value, ttl);
    });

    it('should use default TTL when not provided', () => {
      const key = 'test-key';
      const value = { data: 'test-data' };

      mockNodeCache.set.mockReturnValue(true);

      cacheService.set(key, value);

      expect(mockNodeCache.set).toHaveBeenCalledWith(key, value, 300); // Default TTL is 300
    });
  });

  describe('invalidate', () => {
    it('should delete key from cache', () => {
      const key = 'test-key';

      mockNodeCache.del.mockReturnValue(1);

      const result = cacheService.invalidate(key);

      expect(result).toBe(1);
      expect(mockNodeCache.del).toHaveBeenCalledWith(key);
    });

    it('should return 0 when key does not exist', () => {
      const key = 'test-key';

      mockNodeCache.del.mockReturnValue(0);

      const result = cacheService.invalidate(key);

      expect(result).toBe(0);
      expect(mockNodeCache.del).toHaveBeenCalledWith(key);
    });
  });

  describe('invalidatePattern', () => {
    it('should delete all keys matching pattern', () => {
      const pattern = 'test-';
      const keys = ['test-1', 'test-2', 'other-key'];

      mockNodeCache.keys.mockReturnValue(keys);
      mockNodeCache.del.mockReturnValue(1);

      const result = cacheService.invalidatePattern(pattern);

      expect(result).toBe(2); // Only two keys match the pattern
      expect(mockNodeCache.keys).toHaveBeenCalled();
      expect(mockNodeCache.del).toHaveBeenCalledTimes(2);
      expect(mockNodeCache.del).toHaveBeenCalledWith('test-1');
      expect(mockNodeCache.del).toHaveBeenCalledWith('test-2');
    });

    it('should return 0 when no keys match pattern', () => {
      const pattern = 'test-';
      const keys = ['other-1', 'other-2'];

      mockNodeCache.keys.mockReturnValue(keys);

      const result = cacheService.invalidatePattern(pattern);

      expect(result).toBe(0);
      expect(mockNodeCache.keys).toHaveBeenCalled();
      expect(mockNodeCache.del).not.toHaveBeenCalled();
    });
  });

  describe('flushAll', () => {
    it('should flush the entire cache', () => {
      cacheService.flushAll();

      expect(mockNodeCache.flushAll).toHaveBeenCalled();
      expect(cliLogger.info).toHaveBeenCalledWith('Cache completely flushed');
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const mockStats = { keys: 10, hits: 50, misses: 20, ksize: 0, vsize: 0 };

      mockNodeCache.getStats.mockReturnValue(mockStats);

      const result = cacheService.getStats();

      expect(result).toBe(mockStats);
      expect(mockNodeCache.getStats).toHaveBeenCalled();
    });
  });

  describe('keys', () => {
    it('should return all cache keys', () => {
      const mockKeys = ['key1', 'key2', 'key3'];

      mockNodeCache.keys.mockReturnValue(mockKeys);

      const result = cacheService.keys();

      expect(result).toEqual(mockKeys);
      expect(mockNodeCache.keys).toHaveBeenCalled();
    });
  });

  describe('invalidateProfileStatistics', () => {
    it('should invalidate all profile statistics cache keys', () => {
      const profileId = '123';

      cacheService.invalidateProfileStatistics(profileId);

      expect(mockNodeCache.del).toHaveBeenCalledTimes(4);
      expect(mockNodeCache.del).toHaveBeenCalledWith(PROFILE_KEYS.statistics(profileId));
      expect(mockNodeCache.del).toHaveBeenCalledWith(PROFILE_KEYS.showStatistics(profileId));
      expect(mockNodeCache.del).toHaveBeenCalledWith(PROFILE_KEYS.movieStatistics(profileId));
      expect(mockNodeCache.del).toHaveBeenCalledWith(PROFILE_KEYS.watchProgress(profileId));
    });
  });

  describe('invalidateAccountStatistics', () => {
    it('should invalidate account statistics cache key', () => {
      const accountId = '123';

      cacheService.invalidateAccountStatistics(accountId);

      expect(mockNodeCache.del).toHaveBeenCalledTimes(1);
      expect(mockNodeCache.del).toHaveBeenCalledWith(ACCOUNT_KEYS.statistics(accountId));
    });
  });

  describe('invalidateProfile', () => {
    it('should invalidate all profile-related cache keys', () => {
      const profileId = '123';
      const pattern = INVALIDATION_PATTERNS.allProfileData(profileId);

      // Spy on the invalidatePattern method
      jest.spyOn(cacheService, 'invalidatePattern').mockReturnValue(0);

      cacheService.invalidateProfile(profileId);

      expect(cacheService.invalidatePattern).toHaveBeenCalledWith(pattern);
    });
  });

  describe('invalidateProfileShows', () => {
    it('should invalidate all profile show-related cache keys', () => {
      const profileId = '123';

      // Spy on methods that get called inside this function
      jest.spyOn(cacheService, 'invalidateProfileStatistics').mockImplementation(() => {});
      jest.spyOn(cacheService, 'invalidatePattern').mockReturnValue(0);

      cacheService.invalidateProfileShows(profileId);

      // Check direct invalidations
      expect(mockNodeCache.del).toHaveBeenCalledWith(PROFILE_KEYS.shows(profileId));
      expect(mockNodeCache.del).toHaveBeenCalledWith(PROFILE_KEYS.episodes(profileId));
      expect(mockNodeCache.del).toHaveBeenCalledWith(PROFILE_KEYS.nextUnwatchedEpisodes(profileId));
      expect(mockNodeCache.del).toHaveBeenCalledWith(PROFILE_KEYS.recentEpisodes(profileId));
      expect(mockNodeCache.del).toHaveBeenCalledWith(PROFILE_KEYS.upcomingEpisodes(profileId));

      // Check profile statistics invalidation
      expect(cacheService.invalidateProfileStatistics).toHaveBeenCalledWith(profileId);

      // Check pattern invalidation
      expect(cacheService.invalidatePattern).toHaveBeenCalledWith(INVALIDATION_PATTERNS.profileShowData(profileId));
    });
  });

  describe('invalidateProfileMovies', () => {
    it('should invalidate all profile movie-related cache keys', () => {
      const profileId = '123';

      // Spy on methods that get called inside this function
      jest.spyOn(cacheService, 'invalidateProfileStatistics').mockImplementation(() => {});
      jest.spyOn(cacheService, 'invalidatePattern').mockReturnValue(0);

      cacheService.invalidateProfileMovies(profileId);

      // Check direct invalidations
      expect(mockNodeCache.del).toHaveBeenCalledWith(PROFILE_KEYS.movies(profileId));
      expect(mockNodeCache.del).toHaveBeenCalledWith(PROFILE_KEYS.recentMovies(profileId));
      expect(mockNodeCache.del).toHaveBeenCalledWith(PROFILE_KEYS.upcomingMovies(profileId));

      // Check profile statistics invalidation
      expect(cacheService.invalidateProfileStatistics).toHaveBeenCalledWith(profileId);

      // Check pattern invalidation
      expect(cacheService.invalidatePattern).toHaveBeenCalledWith(INVALIDATION_PATTERNS.profileMovieData(profileId));
    });
  });

  describe('invalidateAccount', () => {
    it('should invalidate all account-related cache keys', () => {
      const accountId = '123';

      // Spy on methods that get called inside this function
      jest.spyOn(cacheService, 'invalidateAccountStatistics').mockImplementation(() => {});
      jest.spyOn(cacheService, 'invalidatePattern').mockReturnValue(0);

      cacheService.invalidateAccount(accountId);

      // Check direct invalidations
      expect(mockNodeCache.del).toHaveBeenCalledWith(ACCOUNT_KEYS.profiles(accountId));

      // Check account statistics invalidation
      expect(cacheService.invalidateAccountStatistics).toHaveBeenCalledWith(accountId);

      // Check pattern invalidation
      expect(cacheService.invalidatePattern).toHaveBeenCalledWith(INVALIDATION_PATTERNS.allAccountData(accountId));
    });
  });
});
