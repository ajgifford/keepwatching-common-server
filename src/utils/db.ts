import mysql, { Pool } from 'mysql2/promise';

let poolInstance: Pool | null = null;

export const createDbPool = (config?: any): Pool => {
  const poolConfig = config || {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PWD,
    database: process.env.MYSQL_DB,
    waitForConnections: true,
    connectionLimit: 100,
    queueLimit: 0,
  };

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
