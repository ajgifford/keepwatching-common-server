import { searchParamsSchema } from '@schema/searchSchema';

describe('searchSchema', () => {
  describe('searchParamsSchema', () => {
    it('should validate valid search parameters with only searchString', () => {
      const validInput = {
        searchString: 'Breaking Bad',
      };

      const result = searchParamsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validInput);
      }
    });

    it('should validate valid search parameters with all fields', () => {
      const validInput = {
        searchString: 'Star Wars',
        year: '1977',
        page: '2',
      };

      const result = searchParamsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validInput);
      }
    });

    it('should trim whitespace from searchString', () => {
      const input = {
        searchString: '  Game of Thrones  ',
      };

      const result = searchParamsSchema.parse(input);
      expect(result.searchString).toBe('Game of Thrones');
    });

    it('should reject empty searchString', () => {
      const invalidInput = {
        searchString: '',
      };

      // This should definitely fail because an empty string doesn't satisfy min(1)
      const result = searchParamsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.searchString?._errors).toBeTruthy();
        // Check that the error message is specifically about the minimum length
        const errorMessages = formattedErrors.searchString?._errors || [];
        expect(errorMessages.some((msg) => msg.includes('at least'))).toBe(true);
      }
    });

    it('should ensure whitespace-only searchString results in valid error or empty string', () => {
      const input = {
        searchString: '   ',
      };

      const result = searchParamsSchema.safeParse(input);

      if (result.success) {
        expect(result.data.searchString).toBe('');
      } else {
        const formattedErrors = result.error.format();
        expect(formattedErrors.searchString?._errors).toBeTruthy();
      }
    });

    it('should reject too long searchString', () => {
      const tooLongString = 'a'.repeat(101);
      const invalidInput = {
        searchString: tooLongString,
      };

      const result = searchParamsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.searchString?._errors).toBeTruthy();
      }
    });

    it('should reject invalid year format', () => {
      const testCases = [
        { searchString: 'The Matrix', year: '19' },
        { searchString: 'The Matrix', year: '123' },
        { searchString: 'The Matrix', year: '12345' },
        { searchString: 'The Matrix', year: 'abcd' },
        { searchString: 'The Matrix', year: '20XX' },
        { searchString: 'The Matrix', year: '2000-01' },
      ];

      testCases.forEach((invalidInput) => {
        const result = searchParamsSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
        if (!result.success) {
          const formattedErrors = result.error.format();
          expect(formattedErrors.year?._errors).toBeTruthy();
        }
      });
    });

    it('should reject invalid page format', () => {
      const testCases = [
        { searchString: 'The Matrix', page: 'abc' },
        { searchString: 'The Matrix', page: '1.5' },
        { searchString: 'The Matrix', page: '-1' },
        { searchString: 'The Matrix', page: '0x1' },
      ];

      testCases.forEach((invalidInput) => {
        const result = searchParamsSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
        if (!result.success) {
          const formattedErrors = result.error.format();
          expect(formattedErrors.page?._errors).toBeTruthy();
        }
      });
    });

    it('should accept valid year format', () => {
      const validYears = ['1900', '2000', '2023', '2100'];

      validYears.forEach((year) => {
        const input = {
          searchString: 'Test Movie',
          year,
        };

        const result = searchParamsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    it('should accept valid page format', () => {
      const validPages = ['1', '2', '10', '100', '9999'];

      validPages.forEach((page) => {
        const input = {
          searchString: 'Test Movie',
          page,
        };

        const result = searchParamsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    it('should maintain type correctness for optional fields', () => {
      const validInput = {
        searchString: 'Inception',
        year: '2010',
        page: '3',
      };

      const result = searchParamsSchema.parse(validInput);

      // These should be strings due to schema definition
      expect(typeof result.searchString).toBe('string');
      expect(typeof result.year).toBe('string');
      expect(typeof result.page).toBe('string');
    });

    it('should reject missing searchString', () => {
      const invalidInput = {
        year: '2000',
        page: '1',
      };

      const result = searchParamsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('searchString');
      }
    });
  });
});
