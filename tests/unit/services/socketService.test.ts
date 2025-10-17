import { cliLogger } from '@logger/logger';
import { accountService } from '@services/accountService';
import { notificationsService } from '@services/notificationsService';
import { SocketService, socketService } from '@services/socketService';
import * as cron from 'node-cron';
import { Server, Socket } from 'socket.io';

jest.mock('@logger/logger', () => ({
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@services/accountService', () => ({
  accountService: {
    findAccountIdByProfileId: jest.fn(),
    login: jest.fn(),
    createGoogleAccount: jest.fn(),
    updateAccount: jest.fn(),
    deleteAccount: jest.fn(),
    invalidateAccountCache: jest.fn(),
  },
}));

jest.mock('@services/notificationsService', () => ({
  notificationsService: {
    getNotifications: jest.fn(),
    createNotification: jest.fn(),
    markAsRead: jest.fn(),
    deleteNotification: jest.fn(),
  },
}));
jest.mock('node-cron');
jest.mock('@config/config', () => ({
  getNotificationPollingInterval: jest.fn(() => '*/5 * * * *'), // Every 5 minutes
  getDBConfig: jest.fn(() => ({})),
  isEmailEnabled: jest.fn(() => false),
  getServiceName: jest.fn(() => 'test-service'),
}));

describe('SocketService', () => {
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;
  let mockSocketsMap: Map<string, any>;
  let mockCronJob: {
    start: jest.Mock;
    stop: jest.Mock;
    destroy: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockSocketsMap = new Map();

    mockCronJob = {
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn(),
    };
    (cron.schedule as jest.Mock).mockReturnValue(mockCronJob);

    mockSocket = {
      id: 'test-socket-id',
      data: {
        userId: 'test-user-id',
        email: 'test@example.com',
        accountId: '123',
      },
      handshake: {
        headers: {},
        time: new Date().toString(),
        address: '127.0.0.1',
        xdomain: false,
        secure: true,
        issued: Date.now(),
        url: '/socket.io/',
        query: {},
        auth: {
          token: 'test-token',
          account_id: '123',
        },
      },
      on: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    mockServer = {
      use: jest.fn().mockImplementation((fn) => {
        fn(mockSocket as Socket, jest.fn());
        return mockServer;
      }),
      on: jest.fn().mockReturnThis(),
      emit: jest.fn().mockReturnThis(),

      get sockets() {
        return {
          sockets: mockSocketsMap,
          adapter: {},
          server: {},
          name: '/',
          use: jest.fn(),
          emit: jest.fn(),
          to: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          allSockets: jest.fn(),
          fetchSockets: jest.fn(),
          addListener: jest.fn(),
          on: jest.fn(),
          once: jest.fn(),
          removeListener: jest.fn(),
          off: jest.fn(),
          removeAllListeners: jest.fn(),
          listeners: jest.fn(),
          eventNames: jest.fn(),
          setMaxListeners: jest.fn(),
          getMaxListeners: jest.fn(),
        } as any;
      },
    };

    Object.defineProperty(SocketService, 'instance', { value: null, writable: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getInstance', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = SocketService.getInstance();
      const instance2 = SocketService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize the Socket.IO server and start polling', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      expect(mockServer.use).toHaveBeenCalled();
      expect(mockServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(service.isInitialized()).toBe(true);
      expect(service.getServer()).toBe(mockServer);
      expect(cron.schedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function), {
        timezone: 'UTC',
      });
      expect(mockCronJob.start).toHaveBeenCalled();
      expect(cliLogger.info).toHaveBeenCalledWith('Socket service initialized with notification polling');
    });

    it('should handle polling job timeout with this.pollingJob.start()', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      expect(cron.schedule).toHaveBeenCalled();
      expect(mockCronJob.start).toHaveBeenCalled();

      const cronCallback = (cron.schedule as jest.Mock).mock.calls[0][1] as () => void;

      jest
        .spyOn(global, 'setTimeout')
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .mockImplementation((callback: (...args: any[]) => void, delay: number | undefined) => {
          if (typeof callback === 'function') {
            callback();
          }
          return {} as NodeJS.Timeout;
        });

      expect(() => cronCallback()).not.toThrow();
      expect(mockCronJob.start).toHaveBeenCalled();
    });
  });

  describe('notifyShowsUpdate', () => {
    it('should emit a showsUpdate event to all clients', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);
      service.notifyShowsUpdate('Test message');

      expect(mockServer.emit).toHaveBeenCalledWith('showsUpdate', { message: 'Test message' });
      expect(cliLogger.info).toHaveBeenCalledWith('Notified clients about show updates');
    });

    it('should use default message if none provided', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);
      service.notifyShowsUpdate();

      expect(mockServer.emit).toHaveBeenCalledWith('showsUpdate', { message: 'Show updates made!' });
    });

    it('should do nothing if server is not initialized', () => {
      const service = SocketService.getInstance();
      service.notifyShowsUpdate();

      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  describe('notifyMoviesUpdate', () => {
    it('should emit a moviesUpdate event to all clients', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);
      service.notifyMoviesUpdate('Test message');

      expect(mockServer.emit).toHaveBeenCalledWith('moviesUpdate', { message: 'Test message' });
      expect(cliLogger.info).toHaveBeenCalledWith('Notified clients about movie updates');
    });

    it('should use default message if none provided', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);
      service.notifyMoviesUpdate();

      expect(mockServer.emit).toHaveBeenCalledWith('moviesUpdate', { message: 'Movie updates made!' });
    });

    it('should do nothing if server is not initialized', () => {
      const service = SocketService.getInstance();
      service.notifyMoviesUpdate();

      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  describe('notifyShowDataLoaded', () => {
    beforeEach(() => {
      (accountService.findAccountIdByProfileId as jest.Mock).mockResolvedValue(123);
      mockSocketsMap.set('socket-id', { ...mockSocket, data: { accountId: 123 } });
    });

    it('should emit an updateShowFavorite event to the correct user', async () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      const mockShow = { show_id: 456, title: 'Test Show' };
      await service.notifyShowDataLoaded(123, mockShow as any);

      expect(accountService.findAccountIdByProfileId).toHaveBeenCalledWith(123);
      expect(mockSocket.emit).toHaveBeenCalledWith('updateShowFavorite', {
        message: 'Show data has been fully loaded',
        show: mockShow,
      });
    });

    it('should handle errors when finding account ID', async () => {
      const error = new Error('Database error');
      (accountService.findAccountIdByProfileId as jest.Mock).mockRejectedValue(error);

      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      await service.notifyShowDataLoaded(123, {} as any);

      expect(cliLogger.error).toHaveBeenCalledWith('Error notifying show data loaded:', error);
    });

    it('should do nothing if account ID is not found', async () => {
      (accountService.findAccountIdByProfileId as jest.Mock).mockResolvedValue(null);

      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      await service.notifyShowDataLoaded(123, {} as any);

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should do nothing if server is not initialized', async () => {
      const service = SocketService.getInstance();
      await service.notifyShowDataLoaded(123, {} as any);

      expect(accountService.findAccountIdByProfileId).not.toHaveBeenCalled();
    });
  });

  describe('clearNotificationCache', () => {
    it('should clear cache for specific account', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      (service as any).notificationCache = {
        123: { notifications: [], lastChecked: new Date() },
        456: { notifications: [], lastChecked: new Date() },
      };

      service.clearNotificationCache(123);

      expect((service as any).notificationCache[123]).toBeUndefined();
      expect((service as any).notificationCache[456]).toBeDefined();
    });

    it('should clear entire cache if no account ID provided', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      (service as any).notificationCache = {
        123: { notifications: [], lastChecked: new Date() },
        456: { notifications: [], lastChecked: new Date() },
      };

      service.clearNotificationCache();

      expect(Object.keys((service as any).notificationCache)).toHaveLength(0);
    });
  });

  describe('disconnectUserSockets', () => {
    beforeEach(() => {
      const socket1 = {
        ...mockSocket,
        id: 'socket-id-1',
        data: { accountId: 123 },
        emit: jest.fn(),
        disconnect: jest.fn(),
      };
      const socket2 = {
        ...mockSocket,
        id: 'socket-id-2',
        data: { accountId: 123 },
        emit: jest.fn(),
        disconnect: jest.fn(),
      };
      const socket3 = {
        ...mockSocket,
        id: 'socket-id-3',
        data: { accountId: 456 },
        emit: jest.fn(),
        disconnect: jest.fn(),
      };

      mockSocketsMap.set('socket-id-1', socket1);
      mockSocketsMap.set('socket-id-2', socket2);
      mockSocketsMap.set('socket-id-3', socket3);
    });

    it('should disconnect all sockets for the specified account', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      const disconnectedCount = service.disconnectUserSockets('123');

      expect(disconnectedCount).toBe(2);

      const socket1 = mockSocketsMap.get('socket-id-1');
      const socket2 = mockSocketsMap.get('socket-id-2');
      const socket3 = mockSocketsMap.get('socket-id-3');

      expect(socket1?.emit).toHaveBeenCalledWith('forceLogout', {
        message: 'You have been logged out from this device',
      });
      expect(socket1?.disconnect).toHaveBeenCalledWith(true);
      expect(socket2?.emit).toHaveBeenCalledWith('forceLogout', {
        message: 'You have been logged out from this device',
      });
      expect(socket2?.disconnect).toHaveBeenCalledWith(true);

      expect(socket3?.emit).not.toHaveBeenCalled();
      expect(socket3?.disconnect).not.toHaveBeenCalled();

      expect(cliLogger.info).toHaveBeenCalledTimes(4);
      expect(cliLogger.info).toHaveBeenCalledWith('Disconnected socket for account 123 due to logout');
    });

    it('should work with numeric account IDs', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      const disconnectedCount = service.disconnectUserSockets(123);

      expect(disconnectedCount).toBe(2);

      const socket1 = mockSocketsMap.get('socket-id-1');
      const socket2 = mockSocketsMap.get('socket-id-2');

      expect(socket1?.disconnect).toHaveBeenCalledWith(true);
      expect(socket2?.disconnect).toHaveBeenCalledWith(true);
    });

    it('should return 0 if no sockets found for the account', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      const disconnectedCount = service.disconnectUserSockets('999');

      expect(disconnectedCount).toBe(0);
      expect(cliLogger.info).toHaveBeenCalledTimes(2);
    });

    it('should return 0 if server is not initialized', () => {
      const service = SocketService.getInstance();

      const disconnectedCount = service.disconnectUserSockets('123');

      expect(disconnectedCount).toBe(0);
    });
  });

  describe('isInitialized', () => {
    it('should return false when server is not initialized', () => {
      const service = SocketService.getInstance();
      expect(service.isInitialized()).toBe(false);
    });

    it('should return true when server is initialized', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);
      expect(service.isInitialized()).toBe(true);
    });
  });

  describe('getServer', () => {
    it('should return null when server is not initialized', () => {
      const service = SocketService.getInstance();
      expect(service.getServer()).toBeNull();
    });

    it('should return the server when initialized', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);
      expect(service.getServer()).toBe(mockServer);
    });
  });

  describe('shutdown', () => {
    it('should stop polling, clear connections, and cache', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      (service as any).connectedUsers.set('test-socket', { accountId: 123 });
      (service as any).notificationCache = { 123: { notifications: [], lastChecked: new Date() } };

      service.shutdown();

      expect(mockCronJob.stop).toHaveBeenCalled();
      expect((service as any).connectedUsers.size).toBe(0);
      expect(Object.keys((service as any).notificationCache)).toHaveLength(0);
      expect(cliLogger.info).toHaveBeenCalledWith('Socket service shutdown complete');
    });

    it('should handle shutdown when polling job is null', () => {
      const service = SocketService.getInstance();

      expect(() => service.shutdown()).not.toThrow();
      expect(cliLogger.info).toHaveBeenCalledWith('Socket service shutdown complete');
    });
  });

  describe('notification polling', () => {
    beforeEach(() => {
      (notificationsService.getNotifications as jest.Mock).mockResolvedValue([
        { id: 1, message: 'Test notification', created_at: new Date() },
      ]);
    });

    it('should poll notifications for connected users', async () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      (service as any).connectedUsers.set('socket-1', { accountId: 123, socketId: 'socket-1' });
      (service as any).connectedUsers.set('socket-2', { accountId: 456, socketId: 'socket-2' });

      const pollingFunction = (cron.schedule as jest.Mock).mock.calls[0][1];

      await pollingFunction();

      expect(notificationsService.getNotifications).toHaveBeenCalledWith(123);
      expect(notificationsService.getNotifications).toHaveBeenCalledWith(456);
      expect(cliLogger.info).toHaveBeenCalledWith('Polling notifications for 2 connected users');
    });

    it('should skip polling when no users are connected', async () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      const pollingFunction = (cron.schedule as jest.Mock).mock.calls[0][1];

      await pollingFunction();

      expect(notificationsService.getNotifications).not.toHaveBeenCalled();
    });

    it('should handle errors during polling gracefully', async () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      (service as any).connectedUsers.set('socket-1', { accountId: 123, socketId: 'socket-1' });

      const error = new Error('Database connection failed');
      (notificationsService.getNotifications as jest.Mock).mockRejectedValue(error);

      const pollingFunction = (cron.schedule as jest.Mock).mock.calls[0][1];

      await pollingFunction();

      expect(cliLogger.error).toHaveBeenCalledWith(`Failed to check notifications for account 123:`, error);
    });

    it('should handle timeout scenarios during polling with graceful recovery', async () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      (service as any).connectedUsers.set('socket-1', { accountId: 123, socketId: 'socket-1' });

      const originalSetTimeout = global.setTimeout;

      jest
        .spyOn(global, 'setTimeout')
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .mockImplementation((callback: (...args: any[]) => void, delay: number | undefined) => {
          if (callback) {
            callback();
          }
          return {} as NodeJS.Timeout;
        });

      const originalPromiseAllSettled = Promise.allSettled;
      jest.spyOn(Promise, 'allSettled').mockImplementation(async (promises) => {
        await new Promise((resolve) => {
          const timer = originalSetTimeout(resolve, 100);
          return timer;
        });
        return originalPromiseAllSettled(promises);
      });

      const pollingFunction = (cron.schedule as jest.Mock).mock.calls[0][1] as () => Promise<void>;

      const pollingPromise = pollingFunction();

      jest.advanceTimersByTime(5000);

      await pollingPromise;

      expect(mockCronJob.start).toHaveBeenCalled();
      expect(() => service.initialize(mockServer as Server)).not.toThrow();
    });
  });

  describe('exported singleton instance', () => {
    it('should export the same instance as getInstance', () => {
      const instance = SocketService.getInstance();
      expect(socketService).toStrictEqual(instance);
    });
  });
});
