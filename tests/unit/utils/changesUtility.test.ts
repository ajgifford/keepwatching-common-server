import { ChangeItem } from '../../../src/types/contentTypes';
import { filterUniqueSeasonIds, generateDateRange } from '@utils/changesUtility';

describe('changesUtility', () => {
  describe('filterUniqueSeasonIds', () => {
    it('should return empty array when changes array is empty', () => {
      const changes: ChangeItem[] = [];
      const result = filterUniqueSeasonIds(changes);
      expect(result).toEqual([]);
    });

    it('should extract unique season IDs from change items', () => {
      const changes: ChangeItem[] = [
        {
          id: '1',
          action: 'added',
          time: '2023-06-15',
          iso_639_1: 'en',
          iso_3166_1: 'US',
          value: { season_id: 123 },
          original_value: null,
        },
        {
          id: '2',
          action: 'updated',
          time: '2023-06-15',
          iso_639_1: 'en',
          iso_3166_1: 'US',
          value: { season_id: 456 },
          original_value: { season_id: 456 },
        },
        {
          id: '3',
          action: 'added',
          time: '2023-06-16',
          iso_639_1: 'en',
          iso_3166_1: 'US',
          value: { season_id: 123 },
          original_value: null,
        },
      ];

      const result = filterUniqueSeasonIds(changes);
      expect(result).toEqual([123, 456]);
      expect(result.length).toBe(2);
    });

    it('should ignore changes without season_id', () => {
      const changes: ChangeItem[] = [
        {
          id: '1',
          action: 'added',
          time: '2023-06-15',
          iso_639_1: 'en',
          iso_3166_1: 'US',
          value: { season_id: 123 },
          original_value: null,
        },
        {
          id: '2',
          action: 'updated',
          time: '2023-06-15',
          iso_639_1: 'en',
          iso_3166_1: 'US',
          value: { some_other_property: 'value' },
          original_value: null,
        },
        {
          id: '3',
          action: 'deleted',
          time: '2023-06-16',
          iso_639_1: 'en',
          iso_3166_1: 'US',
          value: null,
          original_value: { season_id: 789 },
        },
      ];

      const result = filterUniqueSeasonIds(changes);
      expect(result).toEqual([123]);
      expect(result.length).toBe(1);
    });

    it('should handle changes with undefined or null values', () => {
      const changes: ChangeItem[] = [
        {
          id: '1',
          action: 'added',
          time: '2023-06-15',
          iso_639_1: 'en',
          iso_3166_1: 'US',
          value: undefined,
          original_value: null,
        },
        {
          id: '2',
          action: 'updated',
          time: '2023-06-15',
          iso_639_1: 'en',
          iso_3166_1: 'US',
          value: null,
          original_value: null,
        },
      ];

      const result = filterUniqueSeasonIds(changes);
      expect(result).toEqual([]);
    });

    it('should handle mixed types of changes', () => {
      const changes: ChangeItem[] = [
        {
          id: '1',
          action: 'added',
          time: '2023-06-15',
          iso_639_1: 'en',
          iso_3166_1: 'US',
          value: { season_id: 123 },
          original_value: null,
        },
        {
          id: '2',
          action: 'updated',
          time: '2023-06-15',
          iso_639_1: 'en',
          iso_3166_1: 'US',
          value: null,
          original_value: null,
        },
        {
          id: '3',
          action: 'deleted',
          time: '2023-06-16',
          iso_639_1: 'en',
          iso_3166_1: 'US',
          value: { season_id: 456 },
          original_value: { season_id: 789 },
        },
      ];

      const result = filterUniqueSeasonIds(changes);
      expect(result).toEqual([123, 456]);
    });
  });

  describe('generateDateRange', () => {
    const RealDate = Date;

    beforeEach(() => {
      const mockNow = new RealDate(2023, 5, 15); // June 15, 2023

      jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
        if (args.length === 0) {
          return new RealDate(mockNow.getTime());
        }
        return new RealDate(...(args as [any]));
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should generate correct date range with lookback days', () => {
      const { currentDate, pastDate } = generateDateRange(10);

      expect(currentDate).toBe('2023-06-15');
      expect(pastDate).toBe('2023-06-05');
    });

    it('should generate correct date range with 1 day lookback', () => {
      const { currentDate, pastDate } = generateDateRange(1);

      expect(currentDate).toBe('2023-06-15');
      expect(pastDate).toBe('2023-06-14');
    });

    it('should generate correct date range with 30 days lookback', () => {
      const { currentDate, pastDate } = generateDateRange(30);

      expect(currentDate).toBe('2023-06-15');
      expect(pastDate).toBe('2023-05-16');
    });

    it('should handle date crossing month boundaries', () => {
      const mockNow = new RealDate(2023, 6, 1); // July 1, 2023

      jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
        if (args.length === 0) {
          return new RealDate(mockNow.getTime());
        }
        return new RealDate(...(args as [any]));
      });

      const { currentDate, pastDate } = generateDateRange(5);

      expect(currentDate).toBe('2023-07-01');
      expect(pastDate).toBe('2023-06-26');
    });

    it('should handle date crossing year boundaries', () => {
      const mockNow = new RealDate(2023, 0, 1); // January 1, 2023

      jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
        if (args.length === 0) {
          return new RealDate(mockNow.getTime());
        }
        return new RealDate(...(args as [any]));
      });

      const { currentDate, pastDate } = generateDateRange(5);

      expect(currentDate).toBe('2023-01-01');
      expect(pastDate).toBe('2022-12-27');
    });

    it('should format dates with leading zeros', () => {
      const mockNow = new RealDate(2023, 0, 9); // January 9, 2023

      jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
        if (args.length === 0) {
          return new RealDate(mockNow.getTime());
        }
        return new RealDate(...(args as [any]));
      });

      const { currentDate, pastDate } = generateDateRange(5);

      expect(currentDate).toBe('2023-01-09');
      expect(pastDate).toBe('2023-01-04');
    });
  });
});
