import { cliLogger } from '@logger/logger';
import { getFirebaseAdmin, initializeFirebase, shutdownFirebase } from '@utils/firebaseUtil';
import { App, cert, deleteApp, getApp, getApps, initializeApp } from 'firebase-admin/app';

jest.mock('@logger/logger', () => ({
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(),
  initializeApp: jest.fn(),
  cert: jest.fn(),
  getApp: jest.fn(),
  deleteApp: jest.fn(),
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

  const createMockApp = (name: string): App =>
    ({
      name,
      delete: jest.fn().mockResolvedValue(undefined),
    }) as unknown as App;

  beforeEach(() => {
    jest.clearAllMocks();
    (getApps as jest.Mock).mockReturnValue([]);
  });

  describe('initializeFirebase', () => {
    it('should initialize Firebase Admin SDK successfully when not already initialized', () => {
      const mockCredential = { mock: 'credential' };
      (getApps as jest.Mock).mockReturnValue([]);
      (cert as jest.Mock).mockReturnValue(mockCredential);
      (initializeApp as jest.Mock).mockReturnValue(createMockApp(mockAppName));

      const result = initializeFirebase(mockServiceAccount, mockAppName);

      expect(result).toBe(true);
      expect(cert).toHaveBeenCalledWith(mockServiceAccount);
      expect(initializeApp).toHaveBeenCalledWith({ credential: mockCredential }, mockAppName);
      expect(cliLogger.info).toHaveBeenCalledWith(`Firebase Admin SDK initialized for "${mockAppName}"`);
    });

    it('should return true and log info when Firebase Admin SDK is already initialized', () => {
      const existingApp = createMockApp(mockAppName);
      (getApps as jest.Mock).mockReturnValue([existingApp]);

      const result = initializeFirebase(mockServiceAccount, mockAppName);

      expect(result).toBe(true);
      expect(cert).not.toHaveBeenCalled();
      expect(initializeApp).not.toHaveBeenCalled();
      expect(cliLogger.info).toHaveBeenCalledWith(`Firebase Admin SDK already initialized for "${mockAppName}"`);
    });

    it('should handle null apps in getApps() array', () => {
      (getApps as jest.Mock).mockReturnValue([null, createMockApp('other-app'), null]);
      const mockCredential = { mock: 'credential' };
      (cert as jest.Mock).mockReturnValue(mockCredential);
      (initializeApp as jest.Mock).mockReturnValue(createMockApp(mockAppName));

      const result = initializeFirebase(mockServiceAccount, mockAppName);

      expect(result).toBe(true);
      expect(initializeApp).toHaveBeenCalled();
    });

    it('should not initialize when app with same name already exists among other apps', () => {
      (getApps as jest.Mock).mockReturnValue([
        createMockApp('other-app-1'),
        createMockApp(mockAppName),
        createMockApp('other-app-2'),
      ]);

      const result = initializeFirebase(mockServiceAccount, mockAppName);

      expect(result).toBe(true);
      expect(initializeApp).not.toHaveBeenCalled();
      expect(cliLogger.info).toHaveBeenCalledWith(`Firebase Admin SDK already initialized for "${mockAppName}"`);
    });

    it('should return false and log error when initialization fails', () => {
      const mockError = new Error('Initialization failed');
      (getApps as jest.Mock).mockReturnValue([]);
      (cert as jest.Mock).mockReturnValue({ mock: 'credential' });
      (initializeApp as jest.Mock).mockImplementation(() => {
        throw mockError;
      });

      const result = initializeFirebase(mockServiceAccount, mockAppName);

      expect(result).toBe(false);
      expect(cliLogger.error).toHaveBeenCalledWith(
        `Failed to initialize Firebase Admin SDK "${mockAppName}`,
        mockError,
      );
    });

    it('should handle undefined/null return from getApps()', () => {
      (getApps as jest.Mock).mockReturnValue(null);
      const mockCredential = { mock: 'credential' };
      (cert as jest.Mock).mockReturnValue(mockCredential);
      (initializeApp as jest.Mock).mockReturnValue(createMockApp(mockAppName));

      const result = initializeFirebase(mockServiceAccount, mockAppName);

      expect(result).toBe(true);
      expect(initializeApp).toHaveBeenCalled();
    });
  });

  describe('shutdownFirebase', () => {
    it('should shutdown Firebase app successfully when app exists', async () => {
      const mockApp = createMockApp(mockAppName);
      (getApps as jest.Mock).mockReturnValue([mockApp]);
      (getApp as jest.Mock).mockReturnValue(mockApp);
      (deleteApp as jest.Mock).mockResolvedValue(undefined);

      await shutdownFirebase(mockAppName);

      expect(getApp).toHaveBeenCalledWith(mockAppName);
      expect(deleteApp).toHaveBeenCalledWith(mockApp);
      expect(cliLogger.info).toHaveBeenCalledWith(`Firebase Admin SDK app "${mockAppName}" deleted`);
    });

    it('should log info and return early when app is not initialized', async () => {
      (getApps as jest.Mock).mockReturnValue([]);

      await shutdownFirebase(mockAppName);

      expect(getApp).not.toHaveBeenCalled();
      expect(deleteApp).not.toHaveBeenCalled();
      expect(cliLogger.info).toHaveBeenCalledWith(`Firebase Admin SDK app "${mockAppName}" is not initialized`);
    });

    it('should handle null apps in getApps() array during shutdown', async () => {
      (getApps as jest.Mock).mockReturnValue([null, createMockApp('other-app'), null]);

      await shutdownFirebase(mockAppName);

      expect(cliLogger.info).toHaveBeenCalledWith(`Firebase Admin SDK app "${mockAppName}" is not initialized`);
    });

    it('should find and shutdown the correct app when multiple apps exist', async () => {
      const targetApp = createMockApp(mockAppName);
      const otherApp1 = createMockApp('other-app-1');
      const otherApp2 = createMockApp('other-app-2');

      (getApps as jest.Mock).mockReturnValue([otherApp1, targetApp, otherApp2]);
      (getApp as jest.Mock).mockReturnValue(targetApp);
      (deleteApp as jest.Mock).mockResolvedValue(undefined);

      await shutdownFirebase(mockAppName);

      expect(getApp).toHaveBeenCalledWith(mockAppName);
      expect(deleteApp).toHaveBeenCalledWith(targetApp);
      expect(deleteApp).toHaveBeenCalledTimes(1);
    });

    it('should log error and return when deletion fails', async () => {
      const mockError = new Error('Deletion failed');
      const mockApp = createMockApp(mockAppName);
      (getApps as jest.Mock).mockReturnValue([mockApp]);
      (getApp as jest.Mock).mockReturnValue(mockApp);
      (deleteApp as jest.Mock).mockRejectedValue(mockError);

      await shutdownFirebase(mockAppName);

      expect(deleteApp).toHaveBeenCalled();
      expect(cliLogger.error).toHaveBeenCalledWith(`Error shutting down Firebase app "${mockAppName}"`, mockError);
    });

    it('should handle null return from getApps() during shutdown', async () => {
      (getApps as jest.Mock).mockReturnValue(null);

      await shutdownFirebase(mockAppName);

      expect(cliLogger.info).toHaveBeenCalledWith(`Firebase Admin SDK app "${mockAppName}" is not initialized`);
    });
  });

  describe('getFirebaseAdmin', () => {
    it('should return the Firebase app when it exists', () => {
      const targetApp = createMockApp(mockAppName);
      (getApps as jest.Mock).mockReturnValue([targetApp]);

      const result = getFirebaseAdmin(mockAppName);

      expect(result).toBe(targetApp);
    });

    it('should return null when app does not exist', () => {
      (getApps as jest.Mock).mockReturnValue([]);

      const result = getFirebaseAdmin(mockAppName);

      expect(result).toBeNull();
    });

    it('should filter out null apps and find the correct one', () => {
      const targetApp = createMockApp(mockAppName);
      const otherApp = createMockApp('other-app');

      (getApps as jest.Mock).mockReturnValue([null, otherApp, null, targetApp, null]);

      const result = getFirebaseAdmin(mockAppName);

      expect(result).toBe(targetApp);
    });

    it('should return the correct app when multiple apps exist', () => {
      const targetApp = createMockApp(mockAppName);
      const otherApp1 = createMockApp('other-app-1');
      const otherApp2 = createMockApp('other-app-2');

      (getApps as jest.Mock).mockReturnValue([otherApp1, targetApp, otherApp2]);

      const result = getFirebaseAdmin(mockAppName);

      expect(result).toBe(targetApp);
    });

    it('should handle null return from getApps()', () => {
      (getApps as jest.Mock).mockReturnValue(null);

      const result = getFirebaseAdmin(mockAppName);

      expect(result).toBeNull();
    });

    it('should return null when app name does not match any existing apps', () => {
      (getApps as jest.Mock).mockReturnValue([createMockApp('app-1'), createMockApp('app-2'), createMockApp('app-3')]);

      const result = getFirebaseAdmin('non-existent-app');

      expect(result).toBeNull();
    });
  });

  describe('Integration scenarios', () => {
    it('should initialize, get, and shutdown an app in sequence', async () => {
      const mockCredential = { mock: 'credential' };
      const mockApp = createMockApp(mockAppName);

      (getApps as jest.Mock).mockReturnValueOnce([]).mockReturnValue([mockApp]);
      (cert as jest.Mock).mockReturnValue(mockCredential);
      (initializeApp as jest.Mock).mockReturnValue(mockApp);
      (getApp as jest.Mock).mockReturnValue(mockApp);
      (deleteApp as jest.Mock).mockResolvedValue(undefined);

      const initResult = initializeFirebase(mockServiceAccount, mockAppName);
      expect(initResult).toBe(true);

      const getResult = getFirebaseAdmin(mockAppName);
      expect(getResult).not.toBeNull();
      expect(getResult?.name).toBe(mockAppName);

      await shutdownFirebase(mockAppName);
      expect(cliLogger.info).toHaveBeenCalledWith(`Firebase Admin SDK app "${mockAppName}" deleted`);
    });
  });
});
