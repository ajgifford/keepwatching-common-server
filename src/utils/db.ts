import { getDBConfig } from '../config/config';
import mysql, { Pool, PoolOptions } from 'mysql2/promise';

let poolInstance: Pool | null = null;

export const createDbPool = (config?: PoolOptions): Pool => {
  const poolConfig = config || getDBConfig();
  return mysql.createPool(poolConfig);
};

export const getDbPool = (): Pool => {
  if (!poolInstance) {
    poolInstance = createDbPool();
  }
  return poolInstance;
};

// For testing, allow resetting the pool
export const resetDbPool = (): void => {
  poolInstance = null;
};

// The default export for backward compatibility
export default getDbPool();
