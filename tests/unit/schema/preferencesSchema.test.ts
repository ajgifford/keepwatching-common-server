import {
  DisplayPreferences,
  EmailPreferences,
  MultiplePreferencesUpdate,
  NotificationPreferences,
  PreferenceRouteParams,
  PreferenceType,
  PrivacyPreferences,
  displayPreferencesSchema,
  emailPreferencesSchema,
  getPreferenceBodySchema,
  multiplePreferencesUpdateSchema,
  notificationPreferencesSchema,
  preferenceRouteParamsSchema,
  privacyPreferencesSchema,
} from '@schema/preferencesSchema';
import { ZodError } from 'zod';

describe('preferencesSchema', () => {
  describe('emailPreferencesSchema', () => {
    it('should validate valid email preferences', () => {
      const validInput = {
        weeklyDigest: true,
        marketingEmails: false,
      };

      const result = emailPreferencesSchema.parse(validInput);

      expect(result).toEqual({
        weeklyDigest: true,
        marketingEmails: false,
      });
    });

    it('should allow partial objects since fields are optional', () => {
      const partialInput = {
        weeklyDigest: true,
      };

      const result = emailPreferencesSchema.parse(partialInput);

      expect(result).toEqual({
        weeklyDigest: true,
      });
    });

    it('should allow empty objects since all fields are optional', () => {
      const emptyInput = {};

      const result = emailPreferencesSchema.parse(emptyInput);

      expect(result).toEqual({});
    });

    it('should reject non-boolean values', () => {
      const invalidInput = {
        weeklyDigest: 'true',
        marketingEmails: false,
      };

      expect(() => emailPreferencesSchema.parse(invalidInput)).toThrow(ZodError);
    });
  });

  describe('notificationPreferencesSchema', () => {
    it('should validate valid notification preferences', () => {
      const validInput = {
        newSeasonAlerts: true,
        newEpisodeAlerts: false,
      };

      const result = notificationPreferencesSchema.parse(validInput);

      expect(result).toEqual({
        newSeasonAlerts: true,
        newEpisodeAlerts: false,
      });
    });

    it('should allow partial objects', () => {
      const partialInput = {
        newSeasonAlerts: false,
      };

      const result = notificationPreferencesSchema.parse(partialInput);

      expect(result).toEqual({
        newSeasonAlerts: false,
      });
    });

    it('should reject non-boolean values', () => {
      const invalidInput = {
        newSeasonAlerts: 1,
        newEpisodeAlerts: true,
      };

      expect(() => notificationPreferencesSchema.parse(invalidInput)).toThrow(ZodError);
    });
  });

  describe('displayPreferencesSchema', () => {
    it('should validate valid display preferences', () => {
      const validInput = {
        theme: 'dark' as const,
        dateFormat: 'MM/DD/YYYY' as const,
      };

      const result = displayPreferencesSchema.parse(validInput);

      expect(result).toEqual({
        theme: 'dark',
        dateFormat: 'MM/DD/YYYY',
      });
    });

    it('should validate all theme options', () => {
      const themes = ['light', 'dark', 'auto'] as const;

      themes.forEach((theme) => {
        const input = { theme };
        const result = displayPreferencesSchema.parse(input);
        expect(result.theme).toBe(theme);
      });
    });

    it('should validate all date format options', () => {
      const dateFormats = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as const;

      dateFormats.forEach((dateFormat) => {
        const input = { dateFormat };
        const result = displayPreferencesSchema.parse(input);
        expect(result.dateFormat).toBe(dateFormat);
      });
    });

    it('should reject invalid theme values', () => {
      const invalidInput = {
        theme: 'invalid-theme',
      };

      expect(() => displayPreferencesSchema.parse(invalidInput)).toThrow(ZodError);
    });

    it('should reject invalid date format values', () => {
      const invalidInput = {
        dateFormat: 'invalid-format',
      };

      expect(() => displayPreferencesSchema.parse(invalidInput)).toThrow(ZodError);
    });
  });

  describe('privacyPreferencesSchema', () => {
    it('should validate valid privacy preferences', () => {
      const validInput = {
        allowRecommendations: true,
        dataCollection: false,
      };

      const result = privacyPreferencesSchema.parse(validInput);

      expect(result).toEqual({
        allowRecommendations: true,
        dataCollection: false,
      });
    });

    it('should allow partial objects', () => {
      const partialInput = {
        allowRecommendations: false,
      };

      const result = privacyPreferencesSchema.parse(partialInput);

      expect(result).toEqual({
        allowRecommendations: false,
      });
    });

    it('should reject non-boolean values', () => {
      const invalidInput = {
        allowRecommendations: 'yes',
        dataCollection: true,
      };

      expect(() => privacyPreferencesSchema.parse(invalidInput)).toThrow(ZodError);
    });
  });

  describe('preferenceRouteParamsSchema', () => {
    it('should validate valid route parameters', () => {
      const validInput = {
        accountId: '123',
        preferenceType: 'email',
      };

      const result = preferenceRouteParamsSchema.parse(validInput);

      expect(result).toEqual({
        accountId: 123,
        preferenceType: 'email',
      });
    });

    it('should validate all preference types', () => {
      const preferenceTypes = ['email', 'notification', 'display', 'privacy'] as const;

      preferenceTypes.forEach((preferenceType) => {
        const input = {
          accountId: '123',
          preferenceType,
        };

        const result = preferenceRouteParamsSchema.parse(input);
        expect(result.preferenceType).toBe(preferenceType);
      });
    });

    it('should reject invalid preference types', () => {
      const invalidInput = {
        accountId: '123',
        preferenceType: 'invalid-type',
      };

      expect(() => preferenceRouteParamsSchema.parse(invalidInput)).toThrow(ZodError);
    });

    it('should reject invalid accountId', () => {
      const invalidInput = {
        accountId: 'not-a-number',
        preferenceType: 'email',
      };

      expect(() => preferenceRouteParamsSchema.parse(invalidInput)).toThrow(ZodError);
    });
  });

  describe('getPreferenceBodySchema function', () => {
    it('should return correct schema for email preference type', () => {
      const schema = getPreferenceBodySchema('email');

      const validInput = {
        weeklyDigest: true,
        marketingEmails: false,
      };

      const result = schema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it('should return correct schema for notification preference type', () => {
      const schema = getPreferenceBodySchema('notification');

      const validInput = {
        newSeasonAlerts: true,
        newEpisodeAlerts: false,
      };

      const result = schema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it('should return correct schema for display preference type', () => {
      const schema = getPreferenceBodySchema('display');

      const validInput = {
        theme: 'dark' as const,
        dateFormat: 'MM/DD/YYYY' as const,
      };

      const result = schema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it('should return correct schema for privacy preference type', () => {
      const schema = getPreferenceBodySchema('privacy');

      const validInput = {
        allowRecommendations: true,
        dataCollection: false,
      };

      const result = schema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it('should return passthrough schema for unknown preference type', () => {
      const schema = getPreferenceBodySchema('unknown');

      const anyInput = {
        anyField: 'anyValue',
        anotherField: 123,
      };

      const result = schema.parse(anyInput);
      expect(result).toEqual(anyInput);
    });

    it('should handle partial objects for all known preference types', () => {
      const testCases = [
        { type: 'email', input: { weeklyDigest: true } },
        { type: 'notification', input: { newSeasonAlerts: false } },
        { type: 'display', input: { theme: 'light' as const } },
        { type: 'privacy', input: { allowRecommendations: true } },
      ];

      testCases.forEach(({ type, input }) => {
        const schema = getPreferenceBodySchema(type);
        const result = schema.parse(input);
        expect(result).toEqual(input);
      });
    });
  });

  describe('multiplePreferencesUpdateSchema', () => {
    it('should validate when all preference types are provided', () => {
      const validInput = {
        email: {
          weeklyDigest: true,
          marketingEmails: false,
        },
        notification: {
          newSeasonAlerts: true,
          newEpisodeAlerts: false,
        },
        display: {
          theme: 'dark' as const,
          dateFormat: 'MM/DD/YYYY' as const,
        },
        privacy: {
          allowRecommendations: true,
          dataCollection: false,
        },
      };

      const result = multiplePreferencesUpdateSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it('should validate when only one preference type is provided', () => {
      const validInput = {
        email: {
          weeklyDigest: true,
        },
      };

      const result = multiplePreferencesUpdateSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it('should validate when multiple but not all preference types are provided', () => {
      const validInput = {
        email: {
          weeklyDigest: true,
        },
        display: {
          theme: 'light' as const,
        },
      };

      const result = multiplePreferencesUpdateSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it('should allow undefined values for optional preference types', () => {
      const validInput = {
        email: {
          weeklyDigest: true,
        },
        notification: undefined,
        display: undefined,
        privacy: undefined,
      };

      const result = multiplePreferencesUpdateSchema.parse(validInput);
      expect(result).toEqual({
        email: {
          weeklyDigest: true,
        },
        notification: undefined,
        display: undefined,
        privacy: undefined,
      });
    });

    it('should reject when no preference types are provided', () => {
      const invalidInput = {};

      expect(() => multiplePreferencesUpdateSchema.parse(invalidInput)).toThrow(ZodError);

      try {
        multiplePreferencesUpdateSchema.parse(invalidInput);
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const zodError = error as ZodError;
        expect(zodError.errors[0].message).toBe('At least one preference type must be provided');
      }
    });

    it('should reject when all preference types are undefined', () => {
      const invalidInput = {
        email: undefined,
        notification: undefined,
        display: undefined,
        privacy: undefined,
      };

      expect(() => multiplePreferencesUpdateSchema.parse(invalidInput)).toThrow(ZodError);

      try {
        multiplePreferencesUpdateSchema.parse(invalidInput);
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const zodError = error as ZodError;
        expect(zodError.errors[0].message).toBe('At least one preference type must be provided');
      }
    });

    it('should validate nested preference schemas', () => {
      const invalidInput = {
        email: {
          weeklyDigest: 'not-a-boolean',
        },
      };

      expect(() => multiplePreferencesUpdateSchema.parse(invalidInput)).toThrow(ZodError);
    });

    it('should handle partial nested objects', () => {
      const validInput = {
        email: {
          weeklyDigest: true,
          // marketingEmails is optional, so it can be omitted
        },
        display: {
          theme: 'auto' as const,
          // dateFormat is optional, so it can be omitted
        },
      };

      const result = multiplePreferencesUpdateSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });
  });

  describe('type inference', () => {
    it('should correctly infer all exported types', () => {
      // PreferenceRouteParams
      const routeParams: PreferenceRouteParams = {
        accountId: 123,
        preferenceType: 'email',
      };

      // PreferenceType
      const prefType: PreferenceType = 'notification';

      // EmailPreferences
      const emailPrefs: EmailPreferences = {
        weeklyDigest: true,
        marketingEmails: false,
      };

      // NotificationPreferences
      const notificationPrefs: NotificationPreferences = {
        newSeasonAlerts: true,
        newEpisodeAlerts: false,
      };

      // DisplayPreferences
      const displayPrefs: DisplayPreferences = {
        theme: 'dark',
        dateFormat: 'YYYY-MM-DD',
      };

      // PrivacyPreferences
      const privacyPrefs: PrivacyPreferences = {
        allowRecommendations: true,
        dataCollection: false,
      };

      // MultiplePreferencesUpdate
      const multipleUpdate: MultiplePreferencesUpdate = {
        email: emailPrefs,
        notification: notificationPrefs,
        display: displayPrefs,
        privacy: privacyPrefs,
      };

      // These should compile without TypeScript errors
      expect(routeParams.accountId).toBe(123);
      expect(prefType).toBe('notification');
      expect(emailPrefs.weeklyDigest).toBe(true);
      expect(notificationPrefs.newSeasonAlerts).toBe(true);
      expect(displayPrefs.theme).toBe('dark');
      expect(privacyPrefs.allowRecommendations).toBe(true);
      expect(multipleUpdate.email).toEqual(emailPrefs);
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle very large account IDs', () => {
      const validInput = {
        accountId: '999999999999',
        preferenceType: 'email' as const,
      };

      const result = preferenceRouteParamsSchema.parse(validInput);
      expect(result.accountId).toBe(999999999999);
    });

    it('should properly validate enum boundaries', () => {
      // Test all valid theme values
      const validThemes = ['light', 'dark', 'auto'] as const;
      validThemes.forEach((theme) => {
        const input = { theme };
        expect(() => displayPreferencesSchema.parse(input)).not.toThrow();
      });

      // Test all valid date format values
      const validFormats = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as const;
      validFormats.forEach((dateFormat) => {
        const input = { dateFormat };
        expect(() => displayPreferencesSchema.parse(input)).not.toThrow();
      });

      // Test all valid preference types
      const validPrefTypes = ['email', 'notification', 'display', 'privacy'] as const;
      validPrefTypes.forEach((preferenceType) => {
        const input = { accountId: '123', preferenceType };
        expect(() => preferenceRouteParamsSchema.parse(input)).not.toThrow();
      });
    });

    it('should handle empty and whitespace-only strings for accountId', () => {
      const testCases = ['', ' ', '\t', '\n'];

      testCases.forEach((accountId) => {
        const input = { accountId, preferenceType: 'email' as const };
        expect(() => preferenceRouteParamsSchema.parse(input)).toThrow(ZodError);
      });
    });
  });
});
