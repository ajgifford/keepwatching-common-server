// src/utils/transactionHelper.ts
import { getDbPool } from './db';
import { PoolConnection } from 'mysql2/promise';

/**
 * Helper class for managing database transactions
 * 
 * This utility simplifies transaction management by providing a clean way
 * to execute operations within a transaction context.
 */
export class TransactionHelper {
  /**
   * Executes a callback function within a database transaction
   * 
   * This method handles the boilerplate of getting a connection, starting a transaction,
   * committing or rolling back based on success/failure, and releasing the connection.
   * 
   * @param callback Function to execute within transaction context
   * @returns The result of the callback function
   * @throws Any error that occurs during the transaction will be propagated
   * 
   * @example
   * const helper = new TransactionHelper();
   * const result = await helper.executeInTransaction(async (connection) => {
   *   await connection.execute('INSERT INTO users (name) VALUES (?)', ['John']);
   *   await connection.execute('INSERT INTO logs (message) VALUES (?)', ['User created']);
   *   return true;
   * });
   */
  async executeInTransaction<T>(
    callback: (connection: PoolConnection) => Promise<T>
  ): Promise<T> {
    const pool = getDbPool();
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
