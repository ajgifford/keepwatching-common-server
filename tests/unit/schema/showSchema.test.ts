import { addShowFavoriteSchema, showParamsSchema, showWatchStatusSchema } from '@schema/showSchema';

describe('showSchema', () => {
  describe('addShowFavoriteSchema', () => {
    it('should validate valid show favorite object', () => {
      const validInput = {
        showId: 456,
      };

      const result = addShowFavoriteSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validInput);
      }
    });

    it('should reject non-positive show ID', () => {
      const invalidInput = {
        showId: 0,
      };

      const result = addShowFavoriteSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Show ID must be a positive integer');
      }
    });

    it('should reject non-integer show ID', () => {
      const invalidInput = {
        showId: 456.7,
      };

      const result = addShowFavoriteSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.showId?._errors).toContain('Expected integer, received float');
      }
    });

    it('should reject missing show ID', () => {
      const result = addShowFavoriteSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('showId');
      }
    });
  });

  describe('showParamsSchema', () => {
    it('should validate valid show params object', () => {
      const validInput = {
        accountId: '1',
        profileId: '123',
        showId: '456',
      };

      const result = showParamsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validInput);
      }
    });

    it('should reject non-numeric IDs', () => {
      const testCases = [
        { field: 'accountId', value: 'abc' },
        { field: 'profileId', value: 'xyz' },
        { field: 'showId', value: 'notanumber' },
      ];

      testCases.forEach(({ field, value }) => {
        const input = {
          accountId: '1',
          profileId: '123',
          showId: '456',
          [field]: value,
        };

        const result = showParamsSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          const errorMessage = result.error.issues[0].message;
          expect(errorMessage).toContain('must be a number');
        }
      });
    });

    it('should accept string number values', () => {
      const validInput = {
        accountId: '1',
        profileId: '123',
        showId: '456',
      };

      const result = showParamsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject missing fields', () => {
      const requiredFields = ['accountId', 'profileId', 'showId'];

      requiredFields.forEach((field) => {
        const validInput = {
          accountId: '1',
          profileId: '123',
          showId: '456',
        };

        const incompleteInput: Record<string, any> = { ...validInput };
        delete incompleteInput[field];

        const result = showParamsSchema.safeParse(incompleteInput);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('showWatchStatusSchema', () => {
    it('should validate valid show watch status object', () => {
      const validInput = {
        showId: 456,
        status: 'WATCHED',
      };

      const result = showWatchStatusSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate all valid status values', () => {
      const statuses = ['WATCHED', 'WATCHING', 'NOT_WATCHED'];

      statuses.forEach((status) => {
        const input = {
          showId: 456,
          status,
        };

        const result = showWatchStatusSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    it('should handle optional recursive flag', () => {
      let result = showWatchStatusSchema.safeParse({
        showId: 456,
        status: 'WATCHED',
      });
      expect(result.success).toBe(true);

      result = showWatchStatusSchema.safeParse({
        showId: 456,
        status: 'WATCHED',
        recursive: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recursive).toBe(true);
      }
    });

    it('should reject invalid status values', () => {
      const invalidInput = {
        showId: 456,
        status: 'FINISHED',
      };

      const result = showWatchStatusSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.status?._errors).toContain('Status must be one of: WATCHED, WATCHING, or NOT_WATCHED');
      }
    });

    it('should reject non-positive show ID', () => {
      const invalidInput = {
        showId: 0,
        status: 'WATCHED',
      };

      const result = showWatchStatusSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.showId?._errors).toContain('Show ID must be a positive integer');
      }
    });

    it('should reject non-integer show ID', () => {
      const invalidInput = {
        showId: 456.7,
        status: 'WATCHED',
      };

      const result = showWatchStatusSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.showId?._errors).toContain('Expected integer, received float');
      }
    });

    it('should reject non-boolean recursive flag', () => {
      const invalidInput = {
        showId: 456,
        status: 'WATCHED',
        recursive: 'true',
      };

      const result = showWatchStatusSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('recursive');
      }
    });

    it('should reject missing required fields', () => {
      let result = showWatchStatusSchema.safeParse({
        status: 'WATCHED',
      });
      expect(result.success).toBe(false);

      result = showWatchStatusSchema.safeParse({
        showId: 456,
      });
      expect(result.success).toBe(false);
    });
  });
});
