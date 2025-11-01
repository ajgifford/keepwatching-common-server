import {
  dismissedQuerySchema,
  getAllNotificationsQuerySchema,
  notificationActionParamSchema,
  notificationBodySchema,
  notificationIdParamSchema,
  readStatusQuerySchema,
  updateNotificationBodySchema,
} from '@schema/notificationsSchema';

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

  describe('dismissedQuerySchema', () => {
    it('should coerce string "true" to boolean true', () => {
      const input = { includeDismissed: 'true' };
      const result = dismissedQuerySchema.parse(input);

      expect(result.includeDismissed).toBe(true);
    });

    it('should coerce non-empty string to boolean true (z.coerce.boolean behavior)', () => {
      const input = { includeDismissed: 'false' };
      const result = dismissedQuerySchema.parse(input);

      // z.coerce.boolean converts any non-empty string to true
      expect(result.includeDismissed).toBe(true);
    });

    it('should coerce empty string to boolean false', () => {
      const input = { includeDismissed: '' };
      const result = dismissedQuerySchema.parse(input);

      expect(result.includeDismissed).toBe(false);
    });

    it('should allow includeDismissed to be undefined', () => {
      const input = {};
      const result = dismissedQuerySchema.parse(input);

      expect(result.includeDismissed).toBeUndefined();
    });

    it('should accept boolean values directly', () => {
      const testCases = [
        { input: { includeDismissed: true }, expected: true },
        { input: { includeDismissed: false }, expected: false },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = dismissedQuerySchema.parse(input);
        expect(result.includeDismissed).toBe(expected);
      });
    });

    it('should coerce number 0 to false and non-zero to true', () => {
      const testCases = [
        { input: { includeDismissed: 0 }, expected: false },
        { input: { includeDismissed: 1 }, expected: true },
        { input: { includeDismissed: -1 }, expected: true },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = dismissedQuerySchema.parse(input);
        expect(result.includeDismissed).toBe(expected);
      });
    });
  });

  describe('getAllNotificationsQuerySchema', () => {
    it('should validate with default values', () => {
      const input = {};
      const result = getAllNotificationsQuerySchema.parse(input);

      expect(result.expired).toBe(false);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
      expect(result.sortBy).toBe('startDate');
      expect(result.sortOrder).toBe('desc');
    });

    it('should validate with all optional parameters', () => {
      const input = {
        expired: 'true',
        page: '2',
        pageSize: '25',
        type: 'tv',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        sendToAll: 'true',
        sortBy: 'type',
        sortOrder: 'asc',
      };
      const result = getAllNotificationsQuerySchema.parse(input);

      expect(result.expired).toBe(true);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(25);
      expect(result.type).toBe('tv');
      expect(result.startDate).toBe('2025-01-01');
      expect(result.endDate).toBe('2025-12-31');
      expect(result.sendToAll).toBe(true);
      expect(result.sortBy).toBe('type');
      expect(result.sortOrder).toBe('asc');
    });

    it('should coerce page number from string', () => {
      const input = { page: '5' };
      const result = getAllNotificationsQuerySchema.parse(input);

      expect(result.page).toBe(5);
    });

    it('should coerce pageSize from string', () => {
      const input = { pageSize: '100' };
      const result = getAllNotificationsQuerySchema.parse(input);

      expect(result.pageSize).toBe(100);
    });

    it('should reject pageSize greater than 100', () => {
      const input = { pageSize: '101' };
      const result = getAllNotificationsQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it('should reject non-positive page numbers', () => {
      const testCases = [{ page: '0' }, { page: '-1' }];

      testCases.forEach((input) => {
        const result = getAllNotificationsQuerySchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    it('should validate all sortBy enum values', () => {
      const sortByValues = ['startDate', 'endDate', 'type', 'sendToAll'];

      sortByValues.forEach((sortBy) => {
        const result = getAllNotificationsQuerySchema.parse({ sortBy });
        expect(result.sortBy).toBe(sortBy);
      });
    });

    it('should validate all sortOrder enum values', () => {
      const sortOrderValues = ['asc', 'desc'];

      sortOrderValues.forEach((sortOrder) => {
        const result = getAllNotificationsQuerySchema.parse({ sortOrder });
        expect(result.sortOrder).toBe(sortOrder);
      });
    });

    it('should reject invalid sortBy values', () => {
      const input = { sortBy: 'invalid' };
      const result = getAllNotificationsQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it('should reject invalid sortOrder values', () => {
      const input = { sortOrder: 'invalid' };
      const result = getAllNotificationsQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe('notificationBodySchema', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
    const futureDatePlus2 = new Date(Date.now() + 172800000).toISOString(); // Day after tomorrow

    const validNotificationBase = {
      title: 'Test Notification',
      message: 'This is a test message',
      type: 'general' as const,
      startDate: futureDate,
      endDate: futureDatePlus2,
      sendToAll: true,
      accountId: null,
    };

    it('should validate a valid notification for all users', () => {
      const result = notificationBodySchema.safeParse(validNotificationBase);

      expect(result.success).toBe(true);
    });

    it('should validate a valid notification for a specific account', () => {
      const input = {
        ...validNotificationBase,
        sendToAll: false,
        accountId: 123,
      };
      const result = notificationBodySchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it('should reject title less than 5 characters', () => {
      const input = { ...validNotificationBase, title: 'Test' };
      const result = notificationBodySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('title');
        expect(result.error.issues[0].message).toContain('at least 5 characters');
      }
    });

    it('should reject message less than 5 characters', () => {
      const input = { ...validNotificationBase, message: 'Test' };
      const result = notificationBodySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('message');
        expect(result.error.issues[0].message).toContain('at least 5 characters');
      }
    });

    it('should validate all type enum values', () => {
      const types = ['tv', 'movie', 'issue', 'general', 'feature'];

      types.forEach((type) => {
        const input = { ...validNotificationBase, type };
        const result = notificationBodySchema.parse(input);
        expect(result.type).toBe(type);
      });
    });

    it('should reject invalid type', () => {
      const input = { ...validNotificationBase, type: 'invalid' };
      const result = notificationBodySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Type must be one of: tv, movie, issue, general, feature');
      }
    });

    it('should reject non-ISO datetime format for startDate', () => {
      const input = { ...validNotificationBase, startDate: '2025-01-01' };
      const result = notificationBodySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('startDate');
        expect(result.error.issues[0].message).toContain('ISO format');
      }
    });

    it('should reject non-ISO datetime format for endDate', () => {
      const input = { ...validNotificationBase, endDate: '2025-12-31' };
      const result = notificationBodySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('endDate');
        expect(result.error.issues[0].message).toContain('ISO format');
      }
    });

    it('should reject startDate in the past', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
      const input = { ...validNotificationBase, startDate: pastDate };
      const result = notificationBodySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'startDate');
        expect(issue?.message).toBe('Start date must be in the future');
      }
    });

    it('should reject endDate before or equal to startDate', () => {
      const input = { ...validNotificationBase, endDate: futureDate };
      const result = notificationBodySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'endDate');
        expect(issue?.message).toBe('End date must be after start date');
      }
    });

    it('should reject accountId not null when sendToAll is true', () => {
      const input = { ...validNotificationBase, sendToAll: true, accountId: 123 };
      const result = notificationBodySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'accountId');
        expect(issue?.message).toBe('Account ID must be null if sendToAll is true');
      }
    });

    it('should reject null accountId when sendToAll is false', () => {
      const input = { ...validNotificationBase, sendToAll: false, accountId: null };
      const result = notificationBodySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'accountId');
        expect(issue?.message).toBe('Account ID must be a number if sendToAll is false');
      }
    });
  });

  describe('updateNotificationBodySchema', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
    const futureDatePlus2 = new Date(Date.now() + 172800000).toISOString(); // Day after tomorrow

    const validUpdateBase = {
      title: 'Updated Notification',
      message: 'This is an updated message',
      type: 'general' as const,
      startDate: futureDate,
      endDate: futureDatePlus2,
      sendToAll: true,
      accountId: null,
    };

    it('should validate a valid update', () => {
      const result = updateNotificationBodySchema.safeParse(validUpdateBase);

      expect(result.success).toBe(true);
    });

    it('should allow startDate in the past (unlike notificationBodySchema)', () => {
      const input = { ...validUpdateBase, startDate: pastDate, endDate: futureDate };
      const result = updateNotificationBodySchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it('should still reject endDate before or equal to startDate', () => {
      const input = { ...validUpdateBase, endDate: futureDate, startDate: futureDate };
      const result = updateNotificationBodySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'endDate');
        expect(issue?.message).toBe('End date must be after start date');
      }
    });

    it('should still validate sendToAll/accountId rules', () => {
      const testCases = [
        { sendToAll: true, accountId: 123, shouldFail: true },
        { sendToAll: false, accountId: null, shouldFail: true },
        { sendToAll: true, accountId: null, shouldFail: false },
        { sendToAll: false, accountId: 456, shouldFail: false },
      ];

      testCases.forEach(({ sendToAll, accountId, shouldFail }) => {
        const input = { ...validUpdateBase, sendToAll, accountId };
        const result = updateNotificationBodySchema.safeParse(input);
        expect(result.success).toBe(!shouldFail);
      });
    });

    it('should apply the same title and message length validation', () => {
      const shortTitle = { ...validUpdateBase, title: 'Test' };
      const shortMessage = { ...validUpdateBase, message: 'Test' };

      expect(updateNotificationBodySchema.safeParse(shortTitle).success).toBe(false);
      expect(updateNotificationBodySchema.safeParse(shortMessage).success).toBe(false);
    });

    it('should apply the same type validation', () => {
      const types = ['tv', 'movie', 'issue', 'general', 'feature'];

      types.forEach((type) => {
        const input = { ...validUpdateBase, type };
        const result = updateNotificationBodySchema.parse(input);
        expect(result.type).toBe(type);
      });
    });
  });

  describe('notificationIdParamSchema', () => {
    it('should validate a valid numeric string notification ID', () => {
      const input = { notificationId: '123' };
      const result = notificationIdParamSchema.parse(input);

      expect(result.notificationId).toBe(123);
    });

    it('should validate larger notification IDs', () => {
      const input = { notificationId: '999999' };
      const result = notificationIdParamSchema.parse(input);

      expect(result.notificationId).toBe(999999);
    });

    it('should reject non-numeric strings', () => {
      const testCases = [{ notificationId: 'abc' }, { notificationId: '12abc' }, { notificationId: 'abc123' }];

      testCases.forEach((input) => {
        const result = notificationIdParamSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Notification ID must be numeric');
        }
      });
    });

    it('should reject decimal values', () => {
      const input = { notificationId: '123.45' };
      const result = notificationIdParamSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it('should reject negative numbers', () => {
      const input = { notificationId: '-123' };
      const result = notificationIdParamSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const input = { notificationId: '' };
      const result = notificationIdParamSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it('should reject missing notificationId', () => {
      const input = {};
      const result = notificationIdParamSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('notificationId');
      }
    });
  });
});
