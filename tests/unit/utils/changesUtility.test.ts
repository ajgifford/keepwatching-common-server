import { TMDBChange } from '../../../src/types/tmdbTypes';
import { filterUniqueSeasonIds, generateDateRange } from '@utils/changesUtility';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

describe('changesUtility', () => {
  describe('filterUniqueSeasonIds', () => {
    it('should return empty array when changes array is empty', () => {
      const change: TMDBChange = {
        key: '',
        items: [],
      };
      const result = filterUniqueSeasonIds(change);
      expect(result).toEqual([]);
    });

    it('should extract unique season IDs from change items', () => {
      const changes: TMDBChange = {
        key: 'season',
        items: [
          {
            id: '1',
            action: 'added',
            time: '2023-06-15',
            iso_639_1: 'en',
            iso_3166_1: 'US',
            value: { season_id: 123, season_number: 1 },
            original_value: undefined,
          },
          {
            id: '2',
            action: 'updated',
            time: '2023-06-15',
            iso_639_1: 'en',
            iso_3166_1: 'US',
            value: { season_id: 456, season_number: 2 },
            original_value: undefined,
          },
          {
            id: '3',
            action: 'added',
            time: '2023-06-16',
            iso_639_1: 'en',
            iso_3166_1: 'US',
            value: { season_id: 789, season_number: 3 },
            original_value: undefined,
          },
        ],
      };

      const result = filterUniqueSeasonIds(changes);
      expect(result.length).toBe(3);
      expect(result).toEqual([123, 456, 789]);
    });

    it('should handle changes with undefined values', () => {
      const changes: TMDBChange = {
        key: 'season',
        items: [
          {
            id: '1',
            action: 'added',
            time: '2023-06-15',
            iso_639_1: 'en',
            iso_3166_1: 'US',
            value: undefined,
            original_value: undefined,
          },
          {
            id: '2',
            action: 'updated',
            time: '2023-06-15',
            iso_639_1: 'en',
            iso_3166_1: 'US',
            value: undefined,
            original_value: undefined,
          },
        ],
      };

      const result = filterUniqueSeasonIds(changes);
      expect(result).toEqual([]);
    });
  });

  describe('generateDateRange', () => {
    const fixedDate = new Date('2023-06-15T12:00:00Z');

    beforeAll(() => {
      vi.useFakeTimers();
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it('should generate correct date range with lookback days', () => {
      vi.setSystemTime(fixedDate);
      const { currentDate, pastDate } = generateDateRange(10);

      expect(currentDate).toBe('2023-06-15');
      expect(pastDate).toBe('2023-06-05');
    });

    it('should generate correct date range with 1 day lookback', () => {
      vi.setSystemTime(fixedDate);
      const { currentDate, pastDate } = generateDateRange(1);

      expect(currentDate).toBe('2023-06-15');
      expect(pastDate).toBe('2023-06-14');
    });

    it('should generate correct date range with 30 days lookback', () => {
      vi.setSystemTime(fixedDate);
      const { currentDate, pastDate } = generateDateRange(30);

      expect(currentDate).toBe('2023-06-15');
      expect(pastDate).toBe('2023-05-16');
    });

    it('should handle date crossing month boundaries', () => {
      vi.setSystemTime(new Date('2023-07-01T12:00:00Z'));
      const { currentDate, pastDate } = generateDateRange(5);

      expect(currentDate).toBe('2023-07-01');
      expect(pastDate).toBe('2023-06-26');
    });

    it('should handle date crossing year boundaries', () => {
      vi.setSystemTime(new Date('2023-01-01T12:00:00Z'));
      const { currentDate, pastDate } = generateDateRange(5);

      expect(currentDate).toBe('2023-01-01');
      expect(pastDate).toBe('2022-12-27');
    });

    it('should format dates with leading zeros', () => {
      vi.setSystemTime(new Date('2023-01-09T12:00:00Z'));
      const { currentDate, pastDate } = generateDateRange(5);

      expect(currentDate).toBe('2023-01-09');
      expect(pastDate).toBe('2023-01-04');
    });
  });
});
