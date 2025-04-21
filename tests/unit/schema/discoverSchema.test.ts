import {
  discoverChangesQuerySchema,
  discoverSimilarContentSchema,
  discoverTopQuerySchema,
  discoverTrendingQuerySchema,
} from '@schema/discoverSchema';

describe('discoverSchema', () => {
  describe('discoverTopQuerySchema', () => {
    it('should validate valid showType and service', () => {
      const validParams = {
        showType: 'movie',
        service: 'netflix',
      };
      const result = discoverTopQuerySchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should reject non-valid parameters', () => {
      const validParams = {
        showType: 'episode',
        service: 'peacock',
      };
      const result = discoverTopQuerySchema.safeParse(validParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.showType?._errors).toContain(
          'Show type must be either "movie" or "series", received "episode"',
        );
        expect(formattedErrors.service?._errors).toContain('Invalid streaming service provided: "peacock"');
      }
    });
  });

  describe('discoverChangesQuerySchema', () => {
    it('should validate valid showType, service and changeType', () => {
      const validParams = {
        showType: 'movie',
        service: 'netflix',
        changeType: 'new',
      };
      const result = discoverChangesQuerySchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should reject non-valid parameters', () => {
      const validParams = {
        showType: 'episode',
        service: 'peacock',
        changeType: 'recent',
      };
      const result = discoverChangesQuerySchema.safeParse(validParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.showType?._errors).toContain(
          'Show type must be either "movie" or "series", received "episode"',
        );
        expect(formattedErrors.service?._errors).toContain('Invalid streaming service provided: "peacock"');
        expect(formattedErrors.changeType?._errors).toContain(
          'Change type must be either "new", "upcoming" or "expiring", received "recent"',
        );
      }
    });
  });

  describe('discoverTrendingQuerySchema', () => {
    it('should validate valid showType and page', () => {
      const validParams = {
        showType: 'movie',
        page: '1',
      };
      const result = discoverTrendingQuerySchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should validate valid showType but no page', () => {
      const validParams = {
        showType: 'series',
      };
      const result = discoverTrendingQuerySchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should reject non-valid parameters', () => {
      const validParams = {
        showType: 'episode',
        page: 'a',
      };
      const result = discoverTrendingQuerySchema.safeParse(validParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.showType?._errors).toContain(
          'Show type must be either "movie" or "series", received "episode"',
        );
        expect(formattedErrors.page?._errors).toContain('Page must be a positive number');
      }
    });
  });

  describe('discoverSimilarContentSchema', () => {
    it('should validate a valid show ID', () => {
      const validParams = {
        id: '123',
      };
      const result = discoverSimilarContentSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should reject a non-numeric show ID', () => {
      const validParams = {
        id: 'abc',
      };
      const result = discoverSimilarContentSchema.safeParse(validParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.id?._errors).toContain('ID must be numeric');
      }
    });
  });
});
