import { PersonIdParams, personIdParamSchema } from '@schema/personSchema';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

describe('personSchema', () => {
  describe('personIdParamSchema', () => {
    describe('valid inputs', () => {
      it('should validate when all fields are positive integer strings', () => {
        const validInput = {
          accountId: '123',
          profileId: '456',
          personId: '789',
        };

        const result = personIdParamSchema.parse(validInput);

        expect(result).toEqual({
          accountId: 123,
          profileId: 456,
          personId: 789,
        });
        expect(typeof result.accountId).toBe('number');
        expect(typeof result.profileId).toBe('number');
        expect(typeof result.personId).toBe('number');
      });

      it('should handle string numbers with leading/trailing spaces', () => {
        const validInput = {
          accountId: ' 123 ',
          profileId: ' 456 ',
          personId: ' 789 ',
        };

        const result = personIdParamSchema.parse(validInput);

        expect(result).toEqual({
          accountId: 123,
          profileId: 456,
          personId: 789,
        });
      });

      it('should handle large positive integers', () => {
        const validInput = {
          accountId: '999999999',
          profileId: '888888888',
          personId: '777777777',
        };

        const result = personIdParamSchema.parse(validInput);

        expect(result).toEqual({
          accountId: 999999999,
          profileId: 888888888,
          personId: 777777777,
        });
      });
    });

    describe('invalid inputs', () => {
      it('should reject when accountId is not a number', () => {
        const invalidInput = {
          accountId: 'not-a-number',
          profileId: '456',
          personId: '789',
        };

        expect(() => personIdParamSchema.parse(invalidInput)).toThrow(ZodError);

        try {
          personIdParamSchema.parse(invalidInput);
        } catch (error) {
          expect(error).toBeInstanceOf(ZodError);
          const zodError = error as ZodError;
          expect(zodError.errors[0].message).toBe('Account ID must be a number');
          expect(zodError.errors[0].path).toEqual(['accountId']);
        }
      });

      it('should reject when profileId is not a number', () => {
        const invalidInput = {
          accountId: '123',
          profileId: 'invalid',
          personId: '789',
        };

        expect(() => personIdParamSchema.parse(invalidInput)).toThrow(ZodError);

        try {
          personIdParamSchema.parse(invalidInput);
        } catch (error) {
          expect(error).toBeInstanceOf(ZodError);
          const zodError = error as ZodError;
          expect(zodError.errors[0].message).toBe('Profile ID must be a number');
          expect(zodError.errors[0].path).toEqual(['profileId']);
        }
      });

      it('should reject when personId is not a number', () => {
        const invalidInput = {
          accountId: '123',
          profileId: '456',
          personId: 'abc',
        };

        expect(() => personIdParamSchema.parse(invalidInput)).toThrow(ZodError);

        try {
          personIdParamSchema.parse(invalidInput);
        } catch (error) {
          expect(error).toBeInstanceOf(ZodError);
          const zodError = error as ZodError;
          expect(zodError.errors[0].message).toBe('Person ID must be a number');
          expect(zodError.errors[0].path).toEqual(['personId']);
        }
      });

      it('should reject when accountId is zero', () => {
        const invalidInput = {
          accountId: '0',
          profileId: '456',
          personId: '789',
        };

        expect(() => personIdParamSchema.parse(invalidInput)).toThrow(ZodError);

        try {
          personIdParamSchema.parse(invalidInput);
        } catch (error) {
          expect(error).toBeInstanceOf(ZodError);
          const zodError = error as ZodError;
          expect(zodError.errors[0].message).toBe('Account ID must be a positive integer');
        }
      });

      it('should reject when any field is negative', () => {
        const invalidInput = {
          accountId: '-1',
          profileId: '456',
          personId: '789',
        };

        expect(() => personIdParamSchema.parse(invalidInput)).toThrow(ZodError);

        try {
          personIdParamSchema.parse(invalidInput);
        } catch (error) {
          expect(error).toBeInstanceOf(ZodError);
          const zodError = error as ZodError;
          expect(zodError.errors[0].message).toBe('Account ID must be a positive integer');
        }
      });

      it('should reject when any field is a decimal', () => {
        const invalidInput = {
          accountId: '123.5',
          profileId: '456',
          personId: '789',
        };

        expect(() => personIdParamSchema.parse(invalidInput)).toThrow(ZodError);

        try {
          personIdParamSchema.parse(invalidInput);
        } catch (error) {
          expect(error).toBeInstanceOf(ZodError);
          const zodError = error as ZodError;
          expect(zodError.errors[0].message).toBe('Account ID must be an integer');
        }
      });

      it('should reject when required fields are missing', () => {
        const invalidInput = {
          accountId: '123',
          // missing profileId and personId
        };

        expect(() => personIdParamSchema.parse(invalidInput)).toThrow(ZodError);

        try {
          personIdParamSchema.parse(invalidInput);
        } catch (error) {
          expect(error).toBeInstanceOf(ZodError);
          const zodError = error as ZodError;
          expect(zodError.errors).toHaveLength(2);
          expect(zodError.errors.map((e) => e.path[0])).toContain('profileId');
          expect(zodError.errors.map((e) => e.path[0])).toContain('personId');
        }
      });

      it('should reject empty strings', () => {
        const invalidInput = {
          accountId: '',
          profileId: '456',
          personId: '789',
        };

        expect(() => personIdParamSchema.parse(invalidInput)).toThrow(ZodError);

        try {
          personIdParamSchema.parse(invalidInput);
        } catch (error) {
          expect(error).toBeInstanceOf(ZodError);
          const zodError = error as ZodError;
          expect(zodError.errors[0].message).toBe('Account ID must be a positive integer');
        }
      });

      it('should handle multiple validation errors', () => {
        const invalidInput = {
          accountId: 'invalid',
          profileId: '-5',
          personId: '0',
        };

        expect(() => personIdParamSchema.parse(invalidInput)).toThrow(ZodError);

        try {
          personIdParamSchema.parse(invalidInput);
        } catch (error) {
          expect(error).toBeInstanceOf(ZodError);
          const zodError = error as ZodError;
          expect(zodError.errors).toHaveLength(3);

          const errorMessages = zodError.errors.map((e) => e.message);
          expect(errorMessages).toContain('Account ID must be a number');
          expect(errorMessages).toContain('Profile ID must be a positive integer');
          expect(errorMessages).toContain('Person ID must be a positive integer');
        }
      });
    });

    describe('type inference', () => {
      it('should correctly infer PersonIdParams type', () => {
        const validInput = {
          accountId: '123',
          profileId: '456',
          personId: '789',
        };

        const result: PersonIdParams = personIdParamSchema.parse(validInput);

        // TypeScript compilation test - these should not cause type errors
        const accountId: number = result.accountId;
        const profileId: number = result.profileId;
        const personId: number = result.personId;

        expect(accountId).toBe(123);
        expect(profileId).toBe(456);
        expect(personId).toBe(789);
      });
    });

    describe('safeParse method', () => {
      it('should return success object for valid input', () => {
        const validInput = {
          accountId: '123',
          profileId: '456',
          personId: '789',
        };

        const result = personIdParamSchema.safeParse(validInput);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({
            accountId: 123,
            profileId: 456,
            personId: 789,
          });
        }
      });

      it('should return error object for invalid input', () => {
        const invalidInput = {
          accountId: 'invalid',
          profileId: '456',
          personId: '789',
        };

        const result = personIdParamSchema.safeParse(invalidInput);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ZodError);
          expect(result.error.errors[0].message).toBe('Account ID must be a number');
        }
      });
    });
  });
});
