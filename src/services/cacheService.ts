import { ACCOUNT_KEYS, INVALIDATION_PATTERNS, PROFILE_KEYS } from '../constants/cacheKeys';
import { cliLogger } from '../logger/logger';
import NodeCache from 'node-cache';

/**
 * Service for handling caching operations across the application
 * Provides consistent interface for cache operations with logging and error handling
 */
export class CacheService {
  private static instance: CacheService | null = null;
  private cache: NodeCache;

  /**
   * Creates a new CacheService instance
   * @param stdTTL - Standard TTL in seconds (default: 300 - 5 minutes)
   * @param checkperiod - Period in seconds for automatic delete check (default: 600 - 10 minutes)
   */
  private constructor(stdTTL = 300, checkperiod = 600) {
    this.cache = new NodeCache({
      stdTTL,
      checkperiod,
      useClones: false,
    });
  }

  /**
   * Gets the singleton instance of CacheService
   * @returns The singleton CacheService instance
   */
  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Gets a value from cache if it exists, or executes the provided function
   * and stores its result in the cache
   *
   * @param key - Cache key
   * @param fn - Function to execute if cache miss
   * @param ttl - TTL override for this specific item, defaults to 5 minutes
   * @returns The cached or newly computed value
   */
  async getOrSet<T>(key: string, fn: () => Promise<T>, ttl: number = 300): Promise<T> {
    const cachedValue = this.cache.get<T>(key);

    if (cachedValue !== undefined) {
      return cachedValue;
    }

    try {
      const value = await fn();
      this.cache.set(key, value, ttl);
      return value;
    } catch (error) {
      if (error instanceof Error) {
        cliLogger.error(`Cache miss and fetch error for key ${key}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Gets a value from cache
   *
   * @param key - Cache key
   * @returns The cached value or undefined if not found
   */
  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  /**
   * Sets a value in the cache
   *
   * @param key - Cache key
   * @param value - Value to store
   * @param ttl - TTL override for this specific item, defaults to 5 minutes
   * @returns True if successful, false otherwise
   */
  set<T>(key: string, value: T, ttl: number = 300): boolean {
    return this.cache.set(key, value, ttl);
  }

  /**
   * Removes a value from the cache
   *
   * @param key - Cache key to invalidate
   * @returns Number of items deleted (0 or 1)
   */
  public invalidate(key: string): number {
    return this.cache.del(key);
  }

  /**
   * Removes all values with keys matching a specific pattern
   *
   * @param pattern - String pattern to match against keys
   * @returns Number of items deleted
   */
  public invalidatePattern(pattern: string): number {
    const keys = this.cache.keys().filter((key) => key.includes(pattern));

    if (keys.length > 0) {
      keys.forEach((key) => this.cache.del(key));
    }

    return keys.length;
  }

  /**
   * Flushes the entire cache
   */
  flushAll(): void {
    this.cache.flushAll();
    cliLogger.info('Cache completely flushed');
  }

  /**
   * Gets statistics about the cache
   *
   * @returns Object with cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Gets all keys currently in the cache
   *
   * @returns Array of cache keys
   */
  keys(): string[] {
    return this.cache.keys();
  }

  /**
   * Invalidates profile statistics cache
   * @param profileId - ID of the profile to invalidate statistics for
   */
  public invalidateProfileStatistics(profileId: string | number): void {
    this.invalidate(PROFILE_KEYS.statistics(profileId));
    this.invalidate(PROFILE_KEYS.showStatistics(profileId));
    this.invalidate(PROFILE_KEYS.movieStatistics(profileId));
    this.invalidate(PROFILE_KEYS.watchProgress(profileId));
  }

  /**
   * Invalidates account statistics cache
   * @param accountId - ID of the account to invalidate statistics for
   */
  public invalidateAccountStatistics(accountId: string | number): void {
    this.invalidate(ACCOUNT_KEYS.statistics(accountId));
  }

  /**
   * Invalidates all cache data for a profile
   * This is useful when a profile's data changes in a way that affects multiple aspects
   * @param profileId - ID of the profile to invalidate
   * @returns Number of keys invalidated
   */
  public invalidateProfile(profileId: string | number): number {
    return this.invalidatePattern(INVALIDATION_PATTERNS.allProfileData(profileId));
  }

  /**
   * Invalidates all show-related cache data for a profile
   * @param profileId - ID of the profile to invalidate
   * @returns Number of keys invalidated
   */
  public invalidateProfileShows(profileId: string | number): number {
    // Invalidate shows list
    this.invalidate(PROFILE_KEYS.shows(profileId));

    // Invalidate episode-related data
    this.invalidate(PROFILE_KEYS.episodes(profileId));
    this.invalidate(PROFILE_KEYS.nextUnwatchedEpisodes(profileId));
    this.invalidate(PROFILE_KEYS.recentEpisodes(profileId));
    this.invalidate(PROFILE_KEYS.upcomingEpisodes(profileId));

    // Invalidate all profile statistics since they're affected by show changes
    this.invalidateProfileStatistics(profileId);

    // Invalidate all remaining show patterns (details, etc)
    return this.invalidatePattern(INVALIDATION_PATTERNS.profileShowData(profileId));
  }

  /**
   * Invalidates all movie-related cache data for a profile
   * @param profileId - ID of the profile to invalidate
   * @returns Number of keys invalidated
   */
  public invalidateProfileMovies(profileId: string | number): number {
    // Invalidate movies list
    this.invalidate(PROFILE_KEYS.movies(profileId));

    // Invalidate recent/upcoming movies
    this.invalidate(PROFILE_KEYS.recentMovies(profileId));
    this.invalidate(PROFILE_KEYS.upcomingMovies(profileId));

    // Invalidate all profile statistics since they're affected by movie changes
    this.invalidateProfileStatistics(profileId);

    // Invalidate all remaining movie patterns
    return this.invalidatePattern(INVALIDATION_PATTERNS.profileMovieData(profileId));
  }

  /**
   * Invalidates all account-related data
   * @param accountId - ID of the account to invalidate
   * @returns Number of keys invalidated
   */
  public invalidateAccount(accountId: string | number): number {
    // Invalidate account profiles
    this.invalidate(ACCOUNT_KEYS.profiles(accountId));

    // Invalidate account statistics
    this.invalidateAccountStatistics(accountId);

    // Invalidate all remaining account patterns
    return this.invalidatePattern(INVALIDATION_PATTERNS.allAccountData(accountId));
  }
}
