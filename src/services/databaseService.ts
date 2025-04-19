import { cliLogger } from '../logger/logger';
import { getDbPool, resetDbPool } from '../utils/db';
import { Pool } from 'mysql2/promise';

/**
 * Service for managing database connections
 * Provides centralized control over database connection lifecycle
 */
export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private isShuttingDown: boolean = false;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Gets the singleton instance of DatabaseService
   * @returns The singleton DatabaseService instance
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Gets the database connection pool
   * @returns The database connection pool
   */
  public getPool(): Pool {
    return getDbPool();
  }

  /**
   * Checks if the database service is in the process of shutting down
   * @returns True if shutting down, false otherwise
   */
  public isInShutdownMode(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Gracefully shuts down the database connection pool
   * @returns A promise that resolves when the pool is closed
   */
  public async shutdown(): Promise<void> {
    if (this.isInShutdownMode()) {
      cliLogger.info('Database shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;

    try {
      cliLogger.info('Closing database connections...');
      const pool = this.getPool();

      await pool.end();
      resetDbPool();
      cliLogger.info('Database connections closed successfully');
    } catch (error) {
      cliLogger.error('Error closing database connections', error);
      throw error;
    } finally {
      this.isShuttingDown = false;
    }
  }

  /**
   * Resets the database service instance (primarily for testing)
   */
  public static reset(): void {
    if (DatabaseService.instance) {
      DatabaseService.instance.isShuttingDown = false;
      resetDbPool();
      DatabaseService.instance = null;
    }
  }
}

// Export a singleton instance for global use
export const databaseService = DatabaseService.getInstance();
