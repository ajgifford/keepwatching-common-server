import {
  communityRecommendationsQuerySchema,
  ratingParamsSchema,
  sendRecommendationBodySchema,
  upsertRatingBodySchema,
} from '@schema/ratingsSchema';

describe('ratingsSchema', () => {
  describe('upsertRatingBodySchema', () => {
    const validBase = {
      contentType: 'show' as const,
      contentId: 42,
      rating: 4,
      contentTitle: 'Breaking Bad',
      posterImage: '/poster.jpg',
    };

    it('should validate valid input with all fields', () => {
      const input = { ...validBase, note: 'Great show!' };
      const result = upsertRatingBodySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rating).toBe(4);
        expect(result.data.note).toBe('Great show!');
      }
    });

    it('should validate input without optional note', () => {
      const result = upsertRatingBodySchema.safeParse(validBase);
      expect(result.success).toBe(true);
    });

    it('should validate with null note', () => {
      const result = upsertRatingBodySchema.safeParse({ ...validBase, note: null });
      expect(result.success).toBe(true);
    });

    it('should accept both content types', () => {
      expect(upsertRatingBodySchema.safeParse({ ...validBase, contentType: 'show' }).success).toBe(true);
      expect(upsertRatingBodySchema.safeParse({ ...validBase, contentType: 'movie' }).success).toBe(true);
    });

    it('should reject invalid contentType', () => {
      const result = upsertRatingBodySchema.safeParse({ ...validBase, contentType: 'episode' });
      expect(result.success).toBe(false);
    });

    it('should reject rating below 1', () => {
      const result = upsertRatingBodySchema.safeParse({ ...validBase, rating: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject rating above 5', () => {
      const result = upsertRatingBodySchema.safeParse({ ...validBase, rating: 6 });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer rating', () => {
      const result = upsertRatingBodySchema.safeParse({ ...validBase, rating: 3.5 });
      expect(result.success).toBe(false);
    });

    it('should reject note over 1000 characters', () => {
      const longNote = 'a'.repeat(1001);
      const result = upsertRatingBodySchema.safeParse({ ...validBase, note: longNote });
      expect(result.success).toBe(false);
    });

    it('should accept note of exactly 1000 characters', () => {
      const maxNote = 'a'.repeat(1000);
      const result = upsertRatingBodySchema.safeParse({ ...validBase, note: maxNote });
      expect(result.success).toBe(true);
    });
  });

  describe('sendRecommendationBodySchema', () => {
    const validBase = {
      contentType: 'movie' as const,
      contentId: 10,
    };

    it('should validate valid input with all optional fields', () => {
      const input = { ...validBase, rating: 5, message: 'Must watch!' };
      const result = sendRecommendationBodySchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate input without optional fields', () => {
      const result = sendRecommendationBodySchema.safeParse(validBase);
      expect(result.success).toBe(true);
    });

    it('should validate with null rating and message', () => {
      const result = sendRecommendationBodySchema.safeParse({ ...validBase, rating: null, message: null });
      expect(result.success).toBe(true);
    });

    it('should reject rating out of range', () => {
      expect(sendRecommendationBodySchema.safeParse({ ...validBase, rating: 0 }).success).toBe(false);
      expect(sendRecommendationBodySchema.safeParse({ ...validBase, rating: 6 }).success).toBe(false);
    });

    it('should reject message over 500 characters', () => {
      const longMessage = 'b'.repeat(501);
      const result = sendRecommendationBodySchema.safeParse({ ...validBase, message: longMessage });
      expect(result.success).toBe(false);
    });

    it('should accept message of exactly 500 characters', () => {
      const maxMessage = 'b'.repeat(500);
      const result = sendRecommendationBodySchema.safeParse({ ...validBase, message: maxMessage });
      expect(result.success).toBe(true);
    });

    it('should reject invalid contentType', () => {
      const result = sendRecommendationBodySchema.safeParse({ ...validBase, contentType: 'season' });
      expect(result.success).toBe(false);
    });
  });

  describe('communityRecommendationsQuerySchema', () => {
    it('should accept contentType=show', () => {
      const result = communityRecommendationsQuerySchema.safeParse({ contentType: 'show' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.contentType).toBe('show');
    });

    it('should accept contentType=movie', () => {
      const result = communityRecommendationsQuerySchema.safeParse({ contentType: 'movie' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.contentType).toBe('movie');
    });

    it('should accept missing contentType (undefined)', () => {
      const result = communityRecommendationsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.contentType).toBeUndefined();
    });

    it('should reject invalid contentType string', () => {
      const result = communityRecommendationsQuerySchema.safeParse({ contentType: 'episode' });
      expect(result.success).toBe(false);
    });
  });

  describe('ratingParamsSchema', () => {
    it('should parse valid string IDs to numbers', () => {
      const input = { accountId: '1', profileId: '2', ratingId: '3' };
      const result = ratingParamsSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accountId).toBe(1);
        expect(result.data.profileId).toBe(2);
        expect(result.data.ratingId).toBe(3);
      }
    });

    it('should reject non-numeric accountId', () => {
      const result = ratingParamsSchema.safeParse({ accountId: 'abc', profileId: '2', ratingId: '3' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.format();
        expect(errors.accountId?._errors).toContain('Account ID must be a number');
      }
    });

    it('should reject non-numeric profileId', () => {
      const result = ratingParamsSchema.safeParse({ accountId: '1', profileId: 'xyz', ratingId: '3' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.format();
        expect(errors.profileId?._errors).toContain('Profile ID must be a number');
      }
    });

    it('should reject non-numeric ratingId', () => {
      const result = ratingParamsSchema.safeParse({ accountId: '1', profileId: '2', ratingId: 'xyz' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.format();
        expect(errors.ratingId?._errors).toContain('Rating ID must be a number');
      }
    });

    it('should reject zero or negative IDs', () => {
      expect(ratingParamsSchema.safeParse({ accountId: '0', profileId: '2', ratingId: '3' }).success).toBe(false);
      expect(ratingParamsSchema.safeParse({ accountId: '1', profileId: '-1', ratingId: '3' }).success).toBe(false);
    });
  });
});
