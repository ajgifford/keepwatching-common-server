import {
  addWatchlistItemBodySchema,
  updateWatchlistPrioritiesBodySchema,
  watchlistItemParamsSchema,
  watchlistParamsSchema,
} from '@schema/watchlistSchema';

describe('watchlistSchema', () => {
  describe('watchlistParamsSchema', () => {
    it('should parse valid string IDs to numbers', () => {
      const result = watchlistParamsSchema.safeParse({ accountId: '1', profileId: '2' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accountId).toBe(1);
        expect(result.data.profileId).toBe(2);
      }
    });

    it('should reject non-numeric accountId', () => {
      const result = watchlistParamsSchema.safeParse({ accountId: 'abc', profileId: '2' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.format().accountId?._errors).toContain('Account ID must be a number');
      }
    });

    it('should reject non-numeric profileId', () => {
      const result = watchlistParamsSchema.safeParse({ accountId: '1', profileId: 'xyz' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.format().profileId?._errors).toContain('Profile ID must be a number');
      }
    });

    it('should reject zero accountId', () => {
      const result = watchlistParamsSchema.safeParse({ accountId: '0', profileId: '2' });
      expect(result.success).toBe(false);
    });

    it('should reject negative profileId', () => {
      const result = watchlistParamsSchema.safeParse({ accountId: '1', profileId: '-5' });
      expect(result.success).toBe(false);
    });
  });

  describe('watchlistItemParamsSchema', () => {
    it('should parse valid accountId, profileId, and itemId', () => {
      const result = watchlistItemParamsSchema.safeParse({ accountId: '1', profileId: '2', itemId: '3' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accountId).toBe(1);
        expect(result.data.profileId).toBe(2);
        expect(result.data.itemId).toBe(3);
      }
    });

    it('should reject missing itemId', () => {
      const result = watchlistItemParamsSchema.safeParse({ accountId: '1', profileId: '2' });
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric itemId', () => {
      const result = watchlistItemParamsSchema.safeParse({ accountId: '1', profileId: '2', itemId: 'abc' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.format().itemId?._errors).toContain('Item ID must be a number');
      }
    });

    it('should reject zero or negative itemId', () => {
      expect(watchlistItemParamsSchema.safeParse({ accountId: '1', profileId: '2', itemId: '0' }).success).toBe(false);
      expect(watchlistItemParamsSchema.safeParse({ accountId: '1', profileId: '2', itemId: '-1' }).success).toBe(false);
    });
  });

  describe('addWatchlistItemBodySchema', () => {
    it('should accept show contentType with positive contentId', () => {
      const result = addWatchlistItemBodySchema.safeParse({ contentType: 'show', contentId: 42 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.contentType).toBe('show');
        expect(result.data.contentId).toBe(42);
      }
    });

    it('should accept movie contentType', () => {
      const result = addWatchlistItemBodySchema.safeParse({ contentType: 'movie', contentId: 10 });
      expect(result.success).toBe(true);
    });

    it('should reject invalid contentType', () => {
      const result = addWatchlistItemBodySchema.safeParse({ contentType: 'episode', contentId: 1 });
      expect(result.success).toBe(false);
    });

    it('should reject zero contentId', () => {
      const result = addWatchlistItemBodySchema.safeParse({ contentType: 'show', contentId: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative contentId', () => {
      const result = addWatchlistItemBodySchema.safeParse({ contentType: 'show', contentId: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject missing contentId', () => {
      const result = addWatchlistItemBodySchema.safeParse({ contentType: 'show' });
      expect(result.success).toBe(false);
    });

    it('should reject missing contentType', () => {
      const result = addWatchlistItemBodySchema.safeParse({ contentId: 42 });
      expect(result.success).toBe(false);
    });
  });

  describe('updateWatchlistPrioritiesBodySchema', () => {
    it('should accept a valid priorities array', () => {
      const result = updateWatchlistPrioritiesBodySchema.safeParse({
        priorities: [
          { id: 1, priority: 0 },
          { id: 2, priority: 1 },
        ],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priorities).toHaveLength(2);
      }
    });

    it('should accept a single-item priorities array', () => {
      const result = updateWatchlistPrioritiesBodySchema.safeParse({
        priorities: [{ id: 5, priority: 0 }],
      });
      expect(result.success).toBe(true);
    });

    it('should reject an empty priorities array', () => {
      const result = updateWatchlistPrioritiesBodySchema.safeParse({ priorities: [] });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer id', () => {
      const result = updateWatchlistPrioritiesBodySchema.safeParse({
        priorities: [{ id: 1.5, priority: 0 }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject zero or negative id', () => {
      expect(updateWatchlistPrioritiesBodySchema.safeParse({ priorities: [{ id: 0, priority: 0 }] }).success).toBe(
        false,
      );
      expect(updateWatchlistPrioritiesBodySchema.safeParse({ priorities: [{ id: -1, priority: 0 }] }).success).toBe(
        false,
      );
    });

    it('should accept priority of 0', () => {
      const result = updateWatchlistPrioritiesBodySchema.safeParse({
        priorities: [{ id: 1, priority: 0 }],
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative priority', () => {
      const result = updateWatchlistPrioritiesBodySchema.safeParse({
        priorities: [{ id: 1, priority: -1 }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer priority', () => {
      const result = updateWatchlistPrioritiesBodySchema.safeParse({
        priorities: [{ id: 1, priority: 0.5 }],
      });
      expect(result.success).toBe(false);
    });
  });
});
