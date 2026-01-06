import { ADMIN_KEYS } from '../constants/cacheKeys';
import * as summaryDb from '../db/summaryDb';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { SummaryCounts } from '@ajgifford/keepwatching-types';

/**
 * Service for handling summary operations
 * Provides caching and error handling on top of the repository layer
 */
export class SummaryService {
  private cache: CacheService;

  /**
   * Constructor accepts optional dependencies for testing
   */
  constructor(dependencies?: { cacheService?: CacheService }) {
    this.cache = dependencies?.cacheService ?? CacheService.getInstance();
  }

  public async getSummaryCounts(): Promise<SummaryCounts> {
    try {
      return await this.cache.getOrSet(ADMIN_KEYS.summaryCounts(), async () => {
        return await summaryDb.getSummaryCounts();
      });
    } catch (error) {
      throw errorService.handleError(error, `getSummaryCounts()`);
    }
  }
}

/**
 * Factory function for creating new instances
 * Use this in tests to create isolated instances with mocked dependencies
 */
export function createSummaryService(dependencies?: { cacheService?: CacheService }): SummaryService {
  return new SummaryService(dependencies);
}

/**
 * Singleton instance for production use
 */
let instance: SummaryService | null = null;

/**
 * Get or create singleton instance
 * Use this in production code
 */
export function getSummaryService(): SummaryService {
  if (!instance) {
    instance = createSummaryService();
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 * Call this in beforeEach/afterEach to ensure test isolation
 */
export function resetSummaryService(): void {
  instance = null;
}

/**
 * Backward-compatible default export
 * Existing code using `import { adminService }` continues to work
 */
export const summaryService = getSummaryService();
