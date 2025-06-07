import path from 'path';

export type DBConfig = {
  host: string;
  user: string;
  password: string;
  database: string;
  waitForConnections: boolean;
  connectionLimit: number;
  queueLimit: number;
};

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export function getEnvironment() {
  return process.env.NODE_ENV || 'development';
}

export function getAppVersion() {
  return process.env.npm_package_version || '1.0.0';
}

export function getServiceName() {
  return process.env.SERVICE_NAME || 'keepwatching';
}

export function getPort() {
  return process.env.PORT || 3001;
}

export function getUploadDirectory() {
  const defaultUploadDir = path.join(process.cwd(), 'uploads');
  return process.env.UPLOADS_DIR || defaultUploadDir;
}

export function getLogDirectory() {
  const defaultLogDir = path.join(process.cwd(), 'logs');
  return path.resolve(process.env.LOG_DIR || defaultLogDir);
}

export function getExpressLogDir() {
  return path.resolve(process.env.EXPRESS_LOG_DIR || '/var/log');
}

export function getPM2LogDir() {
  return path.resolve(process.env.PM2_LOG_DIR || '/var/log/.pm2');
}

export function getCertsKeyPath() {
  return process.env.CERT_KEY_PATH || 'certs/server.key';
}

export function getCertsServerPath() {
  return process.env.CERT_PATH || 'certs/server.crt';
}

export function getServiceAccountPath() {
  return process.env.SERVICE_ACCOUNT_PATH || '/certs/keepwatching-service-account-dev.json';
}

export function getDBConfig(): DBConfig {
  return {
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'keepwatching',
    password: process.env.MYSQL_PWD || 'password',
    database: process.env.MYSQL_DB || 'keepwatching',
    waitForConnections: process.env.MYSQL_WAIT_CONNECTIONS?.toLowerCase() === 'true' || true,
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT) || 100,
    queueLimit: Number(process.env.MYSQL_QUEUE_LIMIT) || 0,
  };
}

export function getLogTimestampFormat() {
  return process.env.LOG_TIMESTAMP_FORMAT || 'MMM-DD-YYYY HH:mm:ss';
}

export function getShowsUpdateSchedule() {
  // Default: Daily at 2 AM
  return process.env.SHOWS_UPDATE_SCHEDULE || '0 2 * * *';
}

export function getMoviesUpdateSchedule() {
  // Default: Weekly on 7th, 14th, 21st, 28th at 1 AM
  return process.env.MOVIES_UPDATE_SCHEDULE || '0 1 7,14,21,28 * *';
}

export function getStreamingAPIKey() {
  return process.env.STREAMING_API_KEY;
}

export function getStreamingAPIHost() {
  return process.env.STREAMING_API_HOST;
}

export function getTMDBToken() {
  return process.env.TMDB_TOKEN;
}

export function getRateLimitTimeWindow() {
  // Default: 10 minutes
  return Number(process.env.RATE_LIMIT_TIME_WINDOW) || 10 * 60 * 1000;
}

export function getRateLimitMax() {
  // Default: 100
  return Number(process.env.RATE_LIMIT_MAX) || 100;
}

/**
 * Get email configuration from environment variables
 */
export function getEmailConfig(): EmailConfig {
  return {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE?.toLowerCase() === 'true' || false,
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASSWORD || '',
    },
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || '',
  };
}

/**
 * Get email schedule for weekly digests
 */
export function getEmailSchedule(): string {
  // Default: Every Sunday at 9 AM
  return process.env.EMAIL_SCHEDULE || '0 9 * * 0';
}

/**
 * Check if email service is enabled
 */
export function isEmailEnabled(): boolean {
  return process.env.EMAIL_ENABLED?.toLowerCase() === 'true' || false;
}

/**
 * Validate email configuration
 */
export function validateEmailConfig(): { isValid: boolean; errors: string[] } {
  const config = getEmailConfig();
  const errors: string[] = [];

  if (!config.host) {
    errors.push('EMAIL_HOST is required');
  }

  if (!config.auth.user) {
    errors.push('EMAIL_USER is required');
  }

  if (!config.auth.pass) {
    errors.push('EMAIL_PASSWORD is required');
  }

  if (!config.from) {
    errors.push('EMAIL_FROM is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
