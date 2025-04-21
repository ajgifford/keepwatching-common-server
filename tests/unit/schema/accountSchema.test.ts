import {
  accountAndProfileIdsParamSchema,
  accountIdParamSchema,
  accountSchema,
  accountUpdateSchema,
  googleLoginSchema,
  loginSchema,
  profileNameSchema,
} from '@schema/accountSchema';

describe('accountSchema', () => {
  describe('accountSchema', () => {
    it('should validate a valid account', () => {
      const validAccount = {
        name: 'Test User',
        email: 'test@example.com',
        uid: 'test-uid-123',
      };

      const result = accountSchema.safeParse(validAccount);
      expect(result.success).toBe(true);
    });

    it('should require name to be at least 3 characters', () => {
      const invalidAccount = {
        name: 'Te',
        email: 'test@example.com',
        uid: 'test-uid-123',
      };

      const result = accountSchema.safeParse(invalidAccount);
      expect(result.success).toBe(false);

      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.name?._errors).toContain('Name must be at least 3 characters');
      }
    });

    it('should require name to be less than 50 characters', () => {
      const longName = 'A'.repeat(51);
      const invalidAccount = {
        name: longName,
        email: 'test@example.com',
        uid: 'test-uid-123',
      };

      const result = accountSchema.safeParse(invalidAccount);
      expect(result.success).toBe(false);

      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.name?._errors).toContain('Name must be less than 50 characters');
      }
    });

    it('should validate email format', () => {
      const invalidAccount = {
        name: 'Test User',
        email: 'not-an-email',
        uid: 'test-uid-123',
      };

      const result = accountSchema.safeParse(invalidAccount);
      expect(result.success).toBe(false);

      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.email?._errors).toContain('Invalid email format');
      }
    });

    it('should require uid to be non-empty', () => {
      const invalidAccount = {
        name: 'Test User',
        email: 'test@example.com',
        uid: '',
      };

      const result = accountSchema.safeParse(invalidAccount);
      expect(result.success).toBe(false);

      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.uid?._errors).toContain('UID cannot be empty');
      }
    });

    it('should trim whitespace from name', () => {
      const accountWithWhitespace = {
        name: '  Test User  ',
        email: 'test@example.com',
        uid: 'test-uid-123',
      };

      const result = accountSchema.parse(accountWithWhitespace);
      expect(result.name).toBe('Test User');
    });
  });

  describe('accountUpdateSchema', () => {
    it('should validate a valid account update', () => {
      const validUpdate = {
        name: 'Updated Name',
        defaultProfileId: 123,
      };

      const result = accountUpdateSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should require defaultProfileId to be a positive integer', () => {
      const invalidUpdate = {
        name: 'Updated Name',
        defaultProfileId: -1,
      };

      const result = accountUpdateSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);

      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.defaultProfileId?._errors).toContain('Default profile ID must be a positive integer');
      }
    });
  });

  describe('loginSchema', () => {
    it('should validate a valid login request', () => {
      const validLogin = {
        uid: 'test-uid-123',
      };

      const result = loginSchema.safeParse(validLogin);
      expect(result.success).toBe(true);
    });

    it('should reject an empty uid', () => {
      const invalidLogin = {
        uid: '',
      };

      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);

      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.uid?._errors).toContain('UID cannot be empty');
      }
    });
  });

  describe('googleLoginSchema', () => {
    it('should validate a valid Google login request', () => {
      const validGoogleLogin = {
        name: 'Google User',
        email: 'google@example.com',
        uid: 'google-uid-123',
        photoURL: 'https://example.com/photo.jpg',
      };

      const result = googleLoginSchema.safeParse(validGoogleLogin);
      expect(result.success).toBe(true);
    });

    it('should validate without optional photoURL', () => {
      const validGoogleLogin = {
        name: 'Google User',
        email: 'google@example.com',
        uid: 'google-uid-123',
      };

      const result = googleLoginSchema.safeParse(validGoogleLogin);
      expect(result.success).toBe(true);
    });

    it('should require a valid email', () => {
      const invalidGoogleLogin = {
        name: 'Google User',
        email: 'invalid-email',
        uid: 'google-uid-123',
      };

      const result = googleLoginSchema.safeParse(invalidGoogleLogin);
      expect(result.success).toBe(false);

      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.email?._errors).toContain('Invalid email format');
      }
    });
  });

  describe('accountIdParamSchema', () => {
    it('should validate a valid account ID', () => {
      const validParams = {
        accountId: '123',
      };

      const result = accountIdParamSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should reject non-numeric account IDs', () => {
      const invalidParams = {
        accountId: 'abc',
      };

      const result = accountIdParamSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.accountId?._errors).toContain('Account ID must be a number');
      }
    });
  });

  describe('accountAndProfileIdsParamSchema', () => {
    it('should validate valid account and profile IDs', () => {
      const validParams = {
        accountId: '123',
        profileId: '456',
      };

      const result = accountAndProfileIdsParamSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should reject non-numeric IDs', () => {
      const invalidParams = {
        accountId: 'xyz',
        profileId: 'abc',
      };

      const result = accountAndProfileIdsParamSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.profileId?._errors).toContain('Profile ID must be a number');
        expect(formattedErrors.accountId?._errors).toContain('Account ID must be a number');
      }
    });
  });

  describe('profileNameSchema', () => {
    it('should validate a valid profile name', () => {
      const validName = {
        name: 'Valid Profile Name',
      };

      const result = profileNameSchema.safeParse(validName);
      expect(result.success).toBe(true);
    });

    it('should reject a profile name that is too short', () => {
      const invalidName = {
        name: 'Ab',
      };

      const result = profileNameSchema.safeParse(invalidName);
      expect(result.success).toBe(false);

      if (!result.success) {
        const formattedErrors = result.error.format();
        expect(formattedErrors.name?._errors).toContain('Name must be at least 3 characters');
      }
    });

    it('should trim whitespace from profile name', () => {
      const nameWithWhitespace = {
        name: '  Profile Name  ',
      };

      const result = profileNameSchema.parse(nameWithWhitespace);
      expect(result.name).toBe('Profile Name');
    });
  });
});
