import { dismissParamSchema } from '@schema/notificationsSchema';

describe('notificationsSchema', () => {
  describe('dismissParamSchema', () => {
    it('should validate valid dismiss parameters', () => {
      const validInput = {
        accountId: '123',
        notificationId: '456',
      };

      const expectedOutput = {
        accountId: 123,
        notificationId: 456,
      };

      const result = dismissParamSchema.safeParse(validInput);
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

      const result = dismissParamSchema.safeParse(invalidInput);
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

      const result = dismissParamSchema.safeParse(invalidInput);
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

      const result = dismissParamSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('accountId');
      }
    });

    it('should reject missing notification ID', () => {
      const invalidInput = {
        accountId: '123',
      };

      const result = dismissParamSchema.safeParse(invalidInput);
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
        const result = dismissParamSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });
    });

    it('should accept numeric values that are not strings', () => {
      const invalidInput = {
        accountId: '123',
        notificationId: '456',
      };

      const result = dismissParamSchema.safeParse(invalidInput);
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
        const result = dismissParamSchema.safeParse(invalidInput);
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
        const result = dismissParamSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });
    });
  });
});
