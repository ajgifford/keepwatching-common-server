import { getDbPool } from '../utils/db';
import { DbMonitor } from '../utils/dbMonitoring';
import { errorService } from './errorService';
import { DatabaseHealthResponse } from '@ajgifford/keepwatching-types';

export class HealthService {
  /**
   * Constructor accepts optional dependencies for testing
   */
  constructor(dependencies?: object) {
    // No dependencies currently, but keeping pattern consistent
    void dependencies;
  }

  public async getDatabaseHealth(): Promise<DatabaseHealthResponse> {
    try {
      const pool = getDbPool();
      const connection = await pool.getConnection();

      await connection.ping();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalPool = pool.pool as any;
      const poolStats = {
        totalConnections: pool.pool.config.connectionLimit,
        activeConnections: internalPool._allConnections?.length ?? 0,
        freeConnections: internalPool._freeConnections?.length ?? 0,
      };

      connection.release();

      return {
        status: 'healthy',
        pool: poolStats,
        queryStats: (await DbMonitor.getInstance().getStats()).slice(0, 10), // Top 10 queries
      } as DatabaseHealthResponse;
    } catch (error) {
      throw errorService.handleError(error, `getDatabaseHealth()`);
    }
  }
}

/**
 * Factory function for creating new instances
 * Use this in tests to create isolated instances with mocked dependencies
 */
export function createHealthService(dependencies?: object): HealthService {
  return new HealthService(dependencies);
}

/**
 * Singleton instance for production use
 */
let instance: HealthService | null = null;

/**
 * Get or create singleton instance
 * Use this in production code
 */
export function getHealthService(): HealthService {
  if (!instance) {
    instance = createHealthService();
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 * Call this in beforeEach/afterEach to ensure test isolation
 */
export function resetHealthService(): void {
  instance = null;
}

/**
 * Backward-compatible default export
 * Existing code using `import { healthService }` continues to work
 */
export const healthService = getHealthService();
