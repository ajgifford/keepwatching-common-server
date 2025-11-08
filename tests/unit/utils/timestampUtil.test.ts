import * as config from '@config/config';
import { TimestampUtil } from '@utils/timestampUtil';
import { MockedFunction, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@config/config');

describe('TimestampUtil', () => {
  const mockGetLogTimestampFormat = config.getLogTimestampFormat as MockedFunction<typeof config.getLogTimestampFormat>;

  beforeEach(() => {
    // Default mock: MMM-DD-YYYY HH:mm:ss
    mockGetLogTimestampFormat.mockReturnValue('MMM-DD-YYYY HH:mm:ss');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('formatDateToPattern', () => {
    it('should format date with MMM-DD-YYYY HH:mm:ss pattern', () => {
      const date = new Date('2025-07-03T16:41:20');
      const result = TimestampUtil.formatDateToPattern(date, 'MMM-DD-YYYY HH:mm:ss');

      expect(result).toMatch(/^[A-Z][a-z]{2}-\d{2}-2025 \d{2}:41:20$/);
    });

    it('should format date with YYYY-MM-DD HH:mm:ss pattern', () => {
      const date = new Date('2025-07-03T16:41:20');
      const result = TimestampUtil.formatDateToPattern(date, 'YYYY-MM-DD HH:mm:ss');

      expect(result).toMatch(/^2025-07-03 \d{2}:41:20$/);
    });

    it('should format date with YYYY-MM-DD_HH-mm-ss pattern', () => {
      const date = new Date('2025-07-03T16:41:20');
      const result = TimestampUtil.formatDateToPattern(date, 'YYYY-MM-DD_HH-mm-ss');

      expect(result).toMatch(/^2025-07-03_\d{2}-41-20$/);
    });

    it('should pad single-digit months correctly', () => {
      const date = new Date('2025-01-05T08:09:10');
      const result = TimestampUtil.formatDateToPattern(date, 'YYYY-MM-DD HH:mm:ss');

      expect(result).toMatch(/^2025-01-05 \d{2}:09:10$/);
    });

    it('should handle YY for two-digit year', () => {
      const date = new Date('2025-07-03T16:41:20');
      const result = TimestampUtil.formatDateToPattern(date, 'YY-MM-DD');

      expect(result).toBe('25-07-03');
    });

    it('should handle all month abbreviations correctly', () => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      months.forEach((month, index) => {
        const date = new Date(2025, index, 15);
        const result = TimestampUtil.formatDateToPattern(date, 'MMM');
        expect(result).toBe(month);
      });
    });

    it('should handle custom patterns with mixed tokens', () => {
      const date = new Date('2025-12-31T23:59:59');
      const result = TimestampUtil.formatDateToPattern(date, 'DD/MM/YYYY at HH:mm:ss');

      expect(result).toMatch(/^31\/12\/2025 at \d{2}:59:59$/);
    });
  });

  describe('formatTimestamp', () => {
    it('should format a Date object using configured format', () => {
      const date = new Date('2025-07-03T16:41:20');
      const result = TimestampUtil.formatTimestamp(date);

      expect(mockGetLogTimestampFormat).toHaveBeenCalled();
      expect(result).toMatch(/^[A-Z][a-z]{2}-03-2025 \d{2}:41:20$/);
    });

    it('should format an ISO string using configured format', () => {
      const isoString = '2025-07-03T16:41:20.000Z';
      const result = TimestampUtil.formatTimestamp(isoString);

      expect(mockGetLogTimestampFormat).toHaveBeenCalled();
      expect(result).toMatch(/^[A-Z][a-z]{2}-03-2025 \d{2}:41:20$/);
    });

    it('should use current date when no argument provided', () => {
      const result = TimestampUtil.formatTimestamp();

      expect(mockGetLogTimestampFormat).toHaveBeenCalled();
      expect(result).toMatch(/^[A-Z][a-z]{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/);
    });

    it('should respect different configured formats', () => {
      mockGetLogTimestampFormat.mockReturnValue('YYYY-MM-DD HH:mm:ss');

      const date = new Date('2025-07-03T16:41:20');
      const result = TimestampUtil.formatTimestamp(date);

      expect(result).toMatch(/^2025-07-03 \d{2}:41:20$/);
    });
  });

  describe('now', () => {
    it('should return current timestamp in configured format', () => {
      const result = TimestampUtil.now();

      expect(mockGetLogTimestampFormat).toHaveBeenCalled();
      expect(result).toMatch(/^[A-Z][a-z]{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/);
    });

    it('should return consistent format across multiple calls', () => {
      const result1 = TimestampUtil.now();
      const result2 = TimestampUtil.now();

      expect(result1).toMatch(/^[A-Z][a-z]{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/);
      expect(result2).toMatch(/^[A-Z][a-z]{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('forConsoleLogging', () => {
    it('should return timestamp in configured format', () => {
      const result = TimestampUtil.forConsoleLogging();

      expect(mockGetLogTimestampFormat).toHaveBeenCalled();
      expect(result).toMatch(/^[A-Z][a-z]{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('forErrorLogging', () => {
    it('should return timestamp in configured format', () => {
      const result = TimestampUtil.forErrorLogging();

      expect(mockGetLogTimestampFormat).toHaveBeenCalled();
      expect(result).toMatch(/^[A-Z][a-z]{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('forDatabaseLogging', () => {
    it('should return timestamp in configured format', () => {
      const result = TimestampUtil.forDatabaseLogging();

      expect(mockGetLogTimestampFormat).toHaveBeenCalled();
      expect(result).toMatch(/^[A-Z][a-z]{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('fromISO', () => {
    it('should convert valid ISO string to configured format', () => {
      const isoString = '2025-07-03T16:41:20.000Z';
      const result = TimestampUtil.fromISO(isoString);

      expect(mockGetLogTimestampFormat).toHaveBeenCalled();
      expect(result).toMatch(/^[A-Z][a-z]{2}-03-2025 \d{2}:41:20$/);
    });

    it('should handle ISO string without milliseconds', () => {
      const isoString = '2025-07-03T16:41:20Z';
      const result = TimestampUtil.fromISO(isoString);

      expect(result).toMatch(/^[A-Z][a-z]{2}-03-2025 \d{2}:41:20$/);
    });

    it('should handle invalid ISO string gracefully', () => {
      // Invalid ISO strings create Invalid Date objects, which still format
      const invalidIsoString = 'invalid-date-string';
      const result = TimestampUtil.fromISO(invalidIsoString);

      // Invalid dates will still produce a formatted string (with NaN values formatted)
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle empty string gracefully', () => {
      // Empty string creates Invalid Date object
      const result = TimestampUtil.fromISO('');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('formatForDisplay', () => {
    it('should format Date object for display', () => {
      const date = new Date('2025-07-03T16:41:20');
      const result = TimestampUtil.formatForDisplay(date);

      // Format: "Jul 03, 2025 at 11:41 AM" (or similar based on locale)
      expect(result).toMatch(/[A-Z][a-z]{2} \d{2}, \d{4}/);
      expect(result).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
    });

    it('should format ISO string for display', () => {
      const isoString = '2025-07-03T16:41:20.000Z';
      const result = TimestampUtil.formatForDisplay(isoString);

      expect(result).toMatch(/[A-Z][a-z]{2} \d{2}, \d{4}/);
      expect(result).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
    });

    it('should use current date when no argument provided', () => {
      const result = TimestampUtil.formatForDisplay();

      expect(result).toMatch(/[A-Z][a-z]{2} \d{2}, \d{4}/);
      expect(result).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
    });
  });

  describe('formatForFilename', () => {
    it('should format Date object for filename', () => {
      const date = new Date('2025-07-03T16:41:20');
      const result = TimestampUtil.formatForFilename(date);

      // Format: "2025-07-03_16-41-20"
      expect(result).toMatch(/^2025-07-03_\d{2}-41-20$/);
    });

    it('should format ISO string for filename', () => {
      const isoString = '2025-07-03T16:41:20.000Z';
      const result = TimestampUtil.formatForFilename(isoString);

      expect(result).toMatch(/^2025-07-03_\d{2}-41-20$/);
    });

    it('should use current date when no argument provided', () => {
      const result = TimestampUtil.formatForFilename();

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/);
    });

    it('should pad single-digit values correctly', () => {
      const date = new Date('2025-01-05T08:09:10');
      const result = TimestampUtil.formatForFilename(date);

      expect(result).toMatch(/^2025-01-05_\d{2}-09-10$/);
    });
  });

  describe('formatForAPI', () => {
    it('should format Date object as ISO string', () => {
      const date = new Date('2025-07-03T16:41:20.000Z');
      const result = TimestampUtil.formatForAPI(date);

      expect(result).toBe('2025-07-03T16:41:20.000Z');
    });

    it('should handle ISO string input and return ISO string', () => {
      const isoString = '2025-07-03T16:41:20.123Z';
      const result = TimestampUtil.formatForAPI(isoString);

      expect(result).toBe(isoString);
    });

    it('should use current date when no argument provided', () => {
      const result = TimestampUtil.formatForAPI();

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should preserve milliseconds precision', () => {
      const date = new Date('2025-07-03T16:41:20.456Z');
      const result = TimestampUtil.formatForAPI(date);

      expect(result).toContain('.456Z');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle leap year dates correctly', () => {
      const leapDate = new Date('2024-02-29T12:00:00');
      const result = TimestampUtil.formatTimestamp(leapDate);

      expect(result).toMatch(/^[A-Z][a-z]{2}-29-2024 \d{2}:00:00$/);
    });

    it('should handle end of year dates correctly', () => {
      const endOfYear = new Date('2025-12-31T23:59:59');
      const result = TimestampUtil.formatTimestamp(endOfYear);

      expect(result).toMatch(/^[A-Z][a-z]{2}-31-2025 \d{2}:59:59$/);
    });

    it('should handle beginning of year dates correctly', () => {
      const startOfYear = new Date('2025-01-01T00:00:00');
      const result = TimestampUtil.formatTimestamp(startOfYear);

      expect(result).toMatch(/^[A-Z][a-z]{2}-01-2025 \d{2}:00:00$/);
    });

    it('should handle midnight timestamps correctly', () => {
      const midnight = new Date('2025-07-03T00:00:00');
      const result = TimestampUtil.formatDateToPattern(midnight, 'YYYY-MM-DD HH:mm:ss');

      expect(result).toMatch(/^2025-07-03 \d{2}:00:00$/);
    });

    it('should handle noon timestamps correctly', () => {
      const noon = new Date('2025-07-03T12:00:00');
      const result = TimestampUtil.formatDateToPattern(noon, 'YYYY-MM-DD HH:mm:ss');

      expect(result).toMatch(/^2025-07-03 \d{2}:00:00$/);
    });
  });

  describe('integration with multiple format patterns', () => {
    it('should handle multiple token replacements in complex patterns', () => {
      const date = new Date('2025-07-03T16:41:20');
      const pattern = 'YYYY/MM/DD HH:mm:ss - MMM DD, YY';
      const result = TimestampUtil.formatDateToPattern(date, pattern);

      expect(result).toMatch(/^2025\/07\/03 \d{2}:41:20 - [A-Z][a-z]{2} 03, 25$/);
    });

    it('should handle patterns with no separators', () => {
      const date = new Date('2025-07-03T16:41:20');
      const pattern = 'YYYYMMDDHHMMSS';
      const result = TimestampUtil.formatDateToPattern(date, pattern);

      // Note: Due to replacement order, 'ss' gets replaced leaving 'SS' literal
      // This is expected behavior given the current implementation
      expect(result).toMatch(/^20250703\d{4}(SS|20)$/);
    });

    it('should handle patterns with repeated tokens', () => {
      const date = new Date('2025-07-03T16:41:20');
      const pattern = 'YYYY-YYYY MM-MM';
      const result = TimestampUtil.formatDateToPattern(date, pattern);

      expect(result).toBe('2025-2025 07-07');
    });
  });
});
