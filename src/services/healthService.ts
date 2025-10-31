import { getDbPool } from '../utils/db';
import { DbMonitor } from '../utils/dbMonitoring';
import { errorService } from './errorService';
import { DatabaseHealthResponse } from '@ajgifford/keepwatching-types';

export class HealthService {
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

export const healthService = new HealthService();
