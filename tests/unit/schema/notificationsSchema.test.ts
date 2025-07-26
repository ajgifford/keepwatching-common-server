import { notificationActionParamSchema, readStatusQuerySchema } from '@schema/notificationsSchema';

describe('notificationsSchema', () => {
  describe('notificationActionParamSchema', () => {
    it('should validate valid notification action parameters', () => {
      const validInput = {
        accountId: '123',
        notificationId: '456',
      };

      const expectedOutput = {
        accountId: 123,
        notificationId: 456,
      };

      const result = notificationActionParamSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(expectedOutput);
      }
    });

    it('should reject non-numeric account ID', () => {
      const invalidInput = {
        accountId: 'abc',
        notificationId: '456',
      };

      const result = notificationActionParamSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.accountId?._errors).toContain('Account ID must be a number');
      }
    });

    it('should reject non-numeric notification ID', () => {
      const invalidInput = {
        accountId: '123',
        notificationId: 'xyz',
      };

      const result = notificationActionParamSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.notificationId?._errors).toContain('Notification ID must be a number');
      }
    });

    it('should reject missing account ID', () => {
      const invalidInput = {
        notificationId: '456',
      };

      const result = notificationActionParamSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('accountId');
      }
    });

    it('should reject missing notification ID', () => {
      const invalidInput = {
        accountId: '123',
      };

      const result = notificationActionParamSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('notificationId');
      }
    });

    it('should reject empty string values', () => {
      const testCases = [
        { accountId: '', notificationId: '456' },
        { accountId: '123', notificationId: '' },
        { accountId: '', notificationId: '' },
      ];

      testCases.forEach((invalidInput) => {
        const result = notificationActionParamSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });
    });

    it('should accept numeric values that are not strings', () => {
      const invalidInput = {
        accountId: '123',
        notificationId: '456',
      };

      const result = notificationActionParamSchema.safeParse(invalidInput);
      expect(result.success).toBe(true);
      if (!result.success) {
        expect(result.error.issues.length).toBe(2);
        expect(result.error.issues[0].message).toContain('Expected string');
        expect(result.error.issues[1].message).toContain('Expected string');
      }
    });

    it('should reject decimal string values', () => {
      const testCases = [
        { accountId: '123.45', notificationId: '456' },
        { accountId: '123', notificationId: '456.78' },
      ];

      testCases.forEach((invalidInput) => {
        const result = notificationActionParamSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });
    });

    it('should reject values with non-numeric characters', () => {
      const testCases = [
        { accountId: '123abc', notificationId: '456' },
        { accountId: '123', notificationId: '456def' },
        { accountId: '123-456', notificationId: '789' },
        { accountId: '123', notificationId: '789+10' },
      ];

      testCases.forEach((invalidInput) => {
        const result = notificationActionParamSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('readStatusQuerySchema', () => {
    it('should validate with hasBeenRead=true', () => {
      const input = { hasBeenRead: 'true' };
      const result = readStatusQuerySchema.parse(input);

      expect(result.hasBeenRead).toBe(true);
      expect(result.includeDismissed).toBeUndefined();
    });

    it('should validate with hasBeenRead=false', () => {
      const input = { hasBeenRead: 'false' };
      const result = readStatusQuerySchema.parse(input);

      expect(result.hasBeenRead).toBe(false);
      expect(result.includeDismissed).toBeUndefined();
    });

    it('should default hasBeenRead to true when not provided', () => {
      const input = {};
      const result = readStatusQuerySchema.parse(input);

      expect(result.hasBeenRead).toBe(true);
    });

    it('should handle both hasBeenRead and includeDismissed', () => {
      const input = { hasBeenRead: 'false', includeDismissed: 'true' };
      const result = readStatusQuerySchema.parse(input);

      expect(result.hasBeenRead).toBe(false);
      expect(result.includeDismissed).toBe(true);
    });

    it('should handle string boolean values correctly', () => {
      const testCases = [
        { input: { hasBeenRead: 'true' }, expected: true },
        { input: { hasBeenRead: 'false' }, expected: false },
        { input: { hasBeenRead: '1' }, expected: true },
        { input: { hasBeenRead: '0' }, expected: false },
        { input: { hasBeenRead: 'yes' }, expected: true },
        { input: { hasBeenRead: 'no' }, expected: false },
        { input: { hasBeenRead: 'on' }, expected: true },
        { input: { hasBeenRead: 'off' }, expected: false },
        { input: { hasBeenRead: '' }, expected: false },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = readStatusQuerySchema.parse(input);
        expect(result.hasBeenRead).toBe(expected);
      });
    });
  });

  describe('Query parameter coercion', () => {
    it('should handle various truthy values for hasBeenRead', () => {
      const truthyValues = ['true', '1', 'yes', 'on'];

      truthyValues.forEach((value) => {
        const result = readStatusQuerySchema.parse({ hasBeenRead: value });
        expect(result.hasBeenRead).toBe(true);
      });
    });

    it('should handle various falsy values for hasBeenRead', () => {
      const falsyValues = ['false', '0', 'no', 'off', ''];

      falsyValues.forEach((value) => {
        const result = readStatusQuerySchema.parse({ hasBeenRead: value });
        expect(result.hasBeenRead).toBe(false);
      });
    });

    it('should handle boolean values directly', () => {
      const testCases = [
        { input: { hasBeenRead: true }, expected: true },
        { input: { hasBeenRead: false }, expected: false },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = readStatusQuerySchema.parse(input);
        expect(result.hasBeenRead).toBe(expected);
      });
    });
  });
});
