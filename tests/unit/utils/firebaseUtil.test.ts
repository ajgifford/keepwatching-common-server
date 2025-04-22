import { cliLogger } from '@logger/logger';
import { getFirebaseAdmin, initializeFirebase, isFirebaseInitialized } from '@utils/firebaseUtil';
import admin from 'firebase-admin';

jest.mock('firebase-admin', () => ({
  credential: {
    cert: jest.fn().mockReturnValue('mocked-credential'),
  },
  initializeApp: jest.fn(),
}));

jest.mock('@logger/logger', () => ({
  cliLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('firebaseUtil', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();

    (global as any).firebaseInitialized = false;

    process.env = { ...originalEnv };

    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('initializeFirebase', () => {
    it('should return false when Firebase credentials are not provided', () => {
      delete process.env.FIREBASE_SERVICE_ACCOUNT;

      const result = initializeFirebase();

      expect(result).toBe(false);
      expect(cliLogger.warn).toHaveBeenCalledWith(
        'Firebase service account not provided, Firebase features will be disabled',
      );
      expect(admin.initializeApp).not.toHaveBeenCalled();
    });

    it('should initialize Firebase when valid credentials are provided', () => {
      process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
        projectId: 'test-project',
        privateKey: 'test-key',
        clientEmail: 'test@example.com',
      });

      const result = initializeFirebase();

      expect(result).toBe(true);
      expect(admin.credential.cert).toHaveBeenCalled();
      expect(admin.initializeApp).toHaveBeenCalledWith({
        credential: 'mocked-credential',
      });
      expect(cliLogger.info).toHaveBeenCalledWith('Firebase Admin SDK initialized successfully');
    });

    it('should return true and not reinitialize if already initialized', () => {
      (global as any).firebaseInitialized = true;

      const result = initializeFirebase();

      expect(result).toBe(true);
      expect(admin.initializeApp).not.toHaveBeenCalled();
      expect(cliLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('isFirebaseInitialized', () => {
    it('should return true when Firebase is initialized', () => {
      (global as any).firebaseInitialized = true;

      expect(isFirebaseInitialized()).toBe(true);
    });
  });

  describe('getFirebaseAdmin', () => {
    it('should return the admin instance when Firebase is initialized', () => {
      (global as any).firebaseInitialized = true;

      const result = getFirebaseAdmin();

      expect(result).toBe(admin);
    });
  });
});
