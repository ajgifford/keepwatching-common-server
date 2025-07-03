import { getLogTimestampFormat } from '../config/config';

/**
 * Utility class for consistent timestamp formatting across the application
 * Uses the same format as your existing logger configuration
 */
export class TimestampUtil {
  /**
   * Format timestamp using the application's configured format
   * Converts from ISO string to your preferred format (Jul-03-2025 11:41:20)
   */
  static formatTimestamp(date: Date | string = new Date()): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Get the configured format from your config
    const format = getLogTimestampFormat(); // Returns "MMM-DD-YYYY HH:mm:ss"

    return TimestampUtil.formatDateToPattern(dateObj, format);
  }

  /**
   * Format date according to a specific pattern
   * Supports patterns like: MMM-DD-YYYY HH:mm:ss, YYYY-MM-DD HH:mm:ss, etc.
   */
  static formatDateToPattern(date: Date, pattern: string): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const pad = (num: number): string => num.toString().padStart(2, '0');

    // Handle timezone offset to get local time
    const localDate = new Date(date.getTime());

    const replacements: Record<string, string> = {
      YYYY: localDate.getFullYear().toString(),
      YY: localDate.getFullYear().toString().slice(-2),
      MMM: months[localDate.getMonth()],
      MM: pad(localDate.getMonth() + 1),
      DD: pad(localDate.getDate()),
      HH: pad(localDate.getHours()),
      mm: pad(localDate.getMinutes()),
      ss: pad(localDate.getSeconds()),
    };

    let formatted = pattern;
    Object.entries(replacements).forEach(([token, value]) => {
      formatted = formatted.replace(new RegExp(token, 'g'), value);
    });

    return formatted;
  }

  /**
   * Get current timestamp in your application's format
   * This replaces: const timestamp = new Date().toISOString();
   */
  static now(): string {
    return TimestampUtil.formatTimestamp();
  }

  /**
   * Format timestamp for specific use cases
   */
  static forConsoleLogging(): string {
    return TimestampUtil.formatTimestamp();
  }

  static forErrorLogging(): string {
    return TimestampUtil.formatTimestamp();
  }

  static forDatabaseLogging(): string {
    return TimestampUtil.formatTimestamp();
  }

  /**
   * Convert ISO timestamp to your format
   * Useful for converting API timestamps or existing ISO strings
   */
  static fromISO(isoString: string): string {
    try {
      const date = new Date(isoString);
      return TimestampUtil.formatTimestamp(date);
    } catch (error) {
      console.error('Invalid ISO string:', isoString, error);
      return TimestampUtil.now(); // Fallback to current time
    }
  }

  /**
   * Alternative formatters for different contexts
   */
  static formatForDisplay(date: Date | string = new Date()): string {
    // Format: "Jul 03, 2025 at 11:41 AM"
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  static formatForFilename(date: Date | string = new Date()): string {
    // Format: "2025-07-03_11-41-20"
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return TimestampUtil.formatDateToPattern(dateObj, 'YYYY-MM-DD_HH-mm-ss');
  }

  static formatForAPI(date: Date | string = new Date()): string {
    // Keep ISO format for APIs
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toISOString();
  }
}
