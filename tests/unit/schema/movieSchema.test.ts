import {
  addMovieFavoriteSchema,
  movieWatchStatusSchema,
  removeMovieFavoriteParamSchema
} from '@schema/movieSchema';

describe('movieSchema', () => {
  describe('addMovieFavoriteSchema', () => {
    it('should validate valid movie favorite object', () => {
      const validInput = {
        movieId: 123,
      };

      const result = addMovieFavoriteSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validInput);
      }
    });

    it('should reject non-positive movie ID', () => {
      const invalidInput = {
        movieId: 0,
      };

      const result = addMovieFavoriteSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Movie ID must be a positive integer');
      }
    });

    it('should reject non-integer movie ID', () => {
      const invalidInput = {
        movieId: 123.45,
      };

      const result = addMovieFavoriteSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Expected integer, received float');
      }
    });

    it('should reject missing movie ID', () => {
      const invalidInput = {};

      const result = addMovieFavoriteSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('movieId');
      }
    });
  });

  describe('removeMovieFavoriteParamSchema', () => {
    it('should validate valid remove favorite parameters', () => {
      const validInput = {
        accountId: '1',
        profileId: '42',
        movieId: '789',
      };

      const result = removeMovieFavoriteParamSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validInput);
      }
    });

    it('should reject non-numeric account ID', () => {
      const invalidInput = {
        accountId: 'abc',
        profileId: '42',
        movieId: '789',
      };

      const result = removeMovieFavoriteParamSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Account ID must be a number');
      }
    });

    it('should reject non-numeric profile ID', () => {
      const invalidInput = {
        accountId: '1',
        profileId: 'xyz',
        movieId: '789',
      };

      const result = removeMovieFavoriteParamSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Profile ID must be a number');
      }
    });

    it('should reject non-numeric movie ID', () => {
      const invalidInput = {
        accountId: '1',
        profileId: '42',
        movieId: 'invalid',
      };

      const result = removeMovieFavoriteParamSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Movie ID must be a number');
      }
    });

    it('should reject missing fields', () => {
      const testCases = [
        { accountId: '1', profileId: '42' },
        { accountId: '1', movieId: '789' },
        { profileId: '42', movieId: '789' },
      ];

      testCases.forEach(invalidInput => {
        const result = removeMovieFavoriteParamSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('movieWatchStatusSchema', () => {
    it('should validate valid movie watch status object', () => {
      const validInput = {
        movieId: 123,
        status: 'WATCHED',
      };

      const result = movieWatchStatusSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validInput);
      }
    });

    it('should validate all valid status values', () => {
      const statuses = ['WATCHED', 'WATCHING', 'NOT_WATCHED'];

      statuses.forEach(status => {
        const input = {
          movieId: 123,
          status,
        };

        const result = movieWatchStatusSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid status values', () => {
      const invalidInput = {
        movieId: 123,
        status: 'INVALID_STATUS',
      };

      const result = movieWatchStatusSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Status must be one of: WATCHED, WATCHING, or NOT_WATCHED');
      }
    });

    it('should reject non-positive movie ID', () => {
      const invalidInput = {
        movieId: 0,
        status: 'WATCHED',
      };

      const result = movieWatchStatusSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Movie ID must be a positive integer');
      }
    });

    it('should reject non-integer movie ID', () => {
      const invalidInput = {
        movieId: 123.45,
        status: 'WATCHED',
      };

      const result = movieWatchStatusSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Expected integer, received float');
      }
    });

    it('should reject missing fields', () => {
      const testCases = [
        { movieId: 123 },
        { status: 'WATCHED' },
        {},
      ];

      testCases.forEach(invalidInput => {
        const result = movieWatchStatusSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });
    });
  });
});