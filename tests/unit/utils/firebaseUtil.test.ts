import { cliLogger } from '@logger/logger';
import { getFirebaseAdmin, initializeFirebase, shutdownFirebase } from '@utils/firebaseUtil';
import admin from 'firebase-admin';

// Mock the logger
jest.mock('@logger/logger', () => ({
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock firebase-admin
jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
  app: jest.fn(),
}));

describe('firebaseUtil', () => {
  const mockServiceAccount = {
    type: 'service_account',
    project_id: 'test-project',
    private_key_id: 'test-key-id',
    private_key: 'test-private-key',
    client_email: 'test@test-project.iam.gserviceaccount.com',
    client_id: 'test-client-id',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
  };

  const mockAppName = 'test-app';

  // Create mock app objects
  const createMockApp = (name: string): admin.app.App =>
    ({
      name,
      delete: jest.fn().mockResolvedValue(undefined),
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset admin.apps array
    (admin.apps as admin.app.App[]).length = 0;
  });

  describe('initializeFirebase', () => {
    it('should initialize Firebase Admin SDK successfully when not already initialized', () => {
      const mockCredential = { mock: 'credential' };
      (admin.credential.cert as jest.Mock).mockReturnValue(mockCredential);
      (admin.initializeApp as jest.Mock).mockReturnValue(createMockApp(mockAppName));

      const result = initializeFirebase(mockServiceAccount, mockAppName);

      expect(result).toBe(true);
      expect(admin.credential.cert).toHaveBeenCalledWith(mockServiceAccount);
      expect(admin.initializeApp).toHaveBeenCalledWith(
        {
          credential: mockCredential,
        },
        mockAppName,
      );
      expect(cliLogger.info).toHaveBeenCalledWith(`Firebase Admin SDK initialized for "${mockAppName}"`);
    });

    it('should return true and log info when Firebase Admin SDK is already initialized', () => {
      // Setup existing app
      const existingApp = createMockApp(mockAppName);
      (admin.apps as admin.app.App[]).push(existingApp);

      const result = initializeFirebase(mockServiceAccount, mockAppName);

      expect(result).toBe(true);
      expect(admin.credential.cert).not.toHaveBeenCalled();
      expect(admin.initializeApp).not.toHaveBeenCalled();
      expect(cliLogger.info).toHaveBeenCalledWith(`Firebase Admin SDK already initialized for "${mockAppName}"`);
    });

    it('should handle null apps in admin.apps array', () => {
      // Setup admin.apps with null values
      (admin.apps as any[]).push(null, createMockApp('other-app'), null);

      const mockCredential = { mock: 'credential' };
      (admin.credential.cert as jest.Mock).mockReturnValue(mockCredential);
      (admin.initializeApp as jest.Mock).mockReturnValue(createMockApp(mockAppName));

      const result = initializeFirebase(mockServiceAccount, mockAppName);

      expect(result).toBe(true);
      expect(admin.initializeApp).toHaveBeenCalled();
    });

    it('should not initialize when app with same name already exists among other apps', () => {
      // Setup multiple apps including the target one
      (admin.apps as admin.app.App[]).push(
        createMockApp('other-app-1'),
        createMockApp(mockAppName),
        createMockApp('other-app-2'),
      );

      const result = initializeFirebase(mockServiceAccount, mockAppName);

      expect(result).toBe(true);
      expect(admin.initializeApp).not.toHaveBeenCalled();
      expect(cliLogger.info).toHaveBeenCalledWith(`Firebase Admin SDK already initialized for "${mockAppName}"`);
    });

    it('should return false and log error when initialization fails', () => {
      const mockError = new Error('Initialization failed');
      (admin.credential.cert as jest.Mock).mockReturnValue({ mock: 'credential' });
      (admin.initializeApp as jest.Mock).mockImplementation(() => {
        throw mockError;
      });

      const result = initializeFirebase(mockServiceAccount, mockAppName);

      expect(result).toBe(false);
      expect(cliLogger.error).toHaveBeenCalledWith(
        `Failed to initialize Firebase Admin SDK "${mockAppName}`,
        mockError,
      );
    });

    it('should handle undefined admin.apps', () => {
      // Simulate undefined admin.apps
      Object.defineProperty(admin, 'apps', {
        value: undefined,
        writable: true,
      });

      const mockCredential = { mock: 'credential' };
      (admin.credential.cert as jest.Mock).mockReturnValue(mockCredential);
      (admin.initializeApp as jest.Mock).mockReturnValue(createMockApp(mockAppName));

      const result = initializeFirebase(mockServiceAccount, mockAppName);

      expect(result).toBe(true);
      expect(admin.initializeApp).toHaveBeenCalled();

      // Reset admin.apps for other tests
      Object.defineProperty(admin, 'apps', {
        value: [],
        writable: true,
      });
    });
  });

  describe('shutdownFirebase', () => {
    it('should shutdown Firebase app successfully when app exists', async () => {
      const mockApp = createMockApp(mockAppName);
      (admin.apps as admin.app.App[]).push(mockApp);
      (admin.app as jest.Mock).mockReturnValue(mockApp);

      await shutdownFirebase(mockAppName);

      expect(admin.app).toHaveBeenCalledWith(mockAppName);
      expect(mockApp.delete).toHaveBeenCalled();
      expect(cliLogger.info).toHaveBeenCalledWith(`Firebase Admin SDK app "${mockAppName}" deleted`);
    });

    it('should log info and return early when app is not initialized', async () => {
      await shutdownFirebase(mockAppName);

      expect(admin.app).not.toHaveBeenCalled();
      expect(cliLogger.info).toHaveBeenCalledWith(`Firebase Admin SDK app "${mockAppName}" is not initialized`);
    });

    it('should handle null apps in admin.apps array during shutdown', async () => {
      (admin.apps as any[]).push(null, createMockApp('other-app'), null);

      await shutdownFirebase(mockAppName);

      expect(cliLogger.info).toHaveBeenCalledWith(`Firebase Admin SDK app "${mockAppName}" is not initialized`);
    });

    it('should find and shutdown the correct app when multiple apps exist', async () => {
      const targetApp = createMockApp(mockAppName);
      const otherApp1 = createMockApp('other-app-1');
      const otherApp2 = createMockApp('other-app-2');

      (admin.apps as admin.app.App[]).push(otherApp1, targetApp, otherApp2);
      (admin.app as jest.Mock).mockReturnValue(targetApp);

      await shutdownFirebase(mockAppName);

      expect(admin.app).toHaveBeenCalledWith(mockAppName);
      expect(targetApp.delete).toHaveBeenCalled();
      expect(otherApp1.delete).not.toHaveBeenCalled();
      expect(otherApp2.delete).not.toHaveBeenCalled();
    });

    it('should log error and return when deletion fails', async () => {
      const mockError = new Error('Deletion failed');
      const mockApp = createMockApp(mockAppName);
      mockApp.delete = jest.fn().mockRejectedValue(mockError);

      (admin.apps as admin.app.App[]).push(mockApp);
      (admin.app as jest.Mock).mockReturnValue(mockApp);

      await shutdownFirebase(mockAppName);

      expect(mockApp.delete).toHaveBeenCalled();
      expect(cliLogger.error).toHaveBeenCalledWith(`Error shutting down Firebase app "${mockAppName}"`, mockError);
    });

    it('should handle undefined admin.apps during shutdown', async () => {
      Object.defineProperty(admin, 'apps', {
        value: undefined,
        writable: true,
      });

      await shutdownFirebase(mockAppName);

      expect(cliLogger.info).toHaveBeenCalledWith(`Firebase Admin SDK app "${mockAppName}" is not initialized`);

      // Reset admin.apps for other tests
      Object.defineProperty(admin, 'apps', {
        value: [],
        writable: true,
      });
    });
  });

  describe('getFirebaseAdmin', () => {
    it('should return the Firebase app when it exists', () => {
      const targetApp = createMockApp(mockAppName);
      (admin.apps as admin.app.App[]).push(targetApp);

      const result = getFirebaseAdmin(mockAppName);

      expect(result).toBe(targetApp);
    });

    it('should return null when app does not exist', () => {
      const result = getFirebaseAdmin(mockAppName);

      expect(result).toBeNull();
    });

    it('should filter out null apps and find the correct one', () => {
      const targetApp = createMockApp(mockAppName);
      const otherApp = createMockApp('other-app');

      (admin.apps as any[]).push(null, otherApp, null, targetApp, null);

      const result = getFirebaseAdmin(mockAppName);

      expect(result).toBe(targetApp);
    });

    it('should return the correct app when multiple apps exist', () => {
      const targetApp = createMockApp(mockAppName);
      const otherApp1 = createMockApp('other-app-1');
      const otherApp2 = createMockApp('other-app-2');

      (admin.apps as admin.app.App[]).push(otherApp1, targetApp, otherApp2);

      const result = getFirebaseAdmin(mockAppName);

      expect(result).toBe(targetApp);
    });

    it('should handle undefined admin.apps', () => {
      Object.defineProperty(admin, 'apps', {
        value: undefined,
        writable: true,
      });

      const result = getFirebaseAdmin(mockAppName);

      expect(result).toBeNull();

      // Reset admin.apps for other tests
      Object.defineProperty(admin, 'apps', {
        value: [],
        writable: true,
      });
    });

    it('should return null when app name does not match any existing apps', () => {
      (admin.apps as admin.app.App[]).push(createMockApp('app-1'), createMockApp('app-2'), createMockApp('app-3'));

      const result = getFirebaseAdmin('non-existent-app');

      expect(result).toBeNull();
    });
  });

  describe('Integration scenarios', () => {
    it('should initialize, get, and shutdown an app in sequence', async () => {
      const mockCredential = { mock: 'credential' };
      const mockApp = createMockApp(mockAppName);

      (admin.credential.cert as jest.Mock).mockReturnValue(mockCredential);
      (admin.initializeApp as jest.Mock).mockImplementation((config, name) => {
        const app = createMockApp(name);
        (admin.apps as admin.app.App[]).push(app);
        return app;
      });
      (admin.app as jest.Mock).mockReturnValue(mockApp);

      // Initialize
      const initResult = initializeFirebase(mockServiceAccount, mockAppName);
      expect(initResult).toBe(true);

      // Get
      const getResult = getFirebaseAdmin(mockAppName);
      expect(getResult).not.toBeNull();
      expect(getResult?.name).toBe(mockAppName);

      // Shutdown
      await shutdownFirebase(mockAppName);
      expect(cliLogger.info).toHaveBeenCalledWith(`Firebase Admin SDK app "${mockAppName}" deleted`);
    });
  });
});
