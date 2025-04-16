import * as accountsDb from '@db/accountsDb';
import { cliLogger } from '@logger/logger';
import { SocketService, socketService } from '@services/socketService';
import { Server, Socket } from 'socket.io';

jest.mock('@logger/logger', () => ({
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@db/accountsDb');

describe('SocketService', () => {
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;
  let mockSocketsMap: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketsMap = new Map();

    // Create mock socket with properly typed handshake
    mockSocket = {
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

    // Create mock server with proper structure for Socket.IO Server
    mockServer = {
      use: jest.fn().mockImplementation((fn) => {
        fn(mockSocket as Socket, jest.fn());
        return mockServer;
      }),
      on: jest.fn().mockReturnThis(),
      emit: jest.fn().mockReturnThis(),
      // Use a getter for sockets to allow modification of the underlying Map
      get sockets() {
        return {
          // Use the mockSocketsMap variable we can modify
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

    // Reset the singleton for each test
    Object.defineProperty(SocketService, 'instance', { value: null, writable: true });
  });

  describe('getInstance', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = SocketService.getInstance();
      const instance2 = SocketService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize the Socket.IO server', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      expect(mockServer.use).toHaveBeenCalled();
      expect(mockServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(service.isInitialized()).toBe(true);
      expect(service.getServer()).toBe(mockServer);
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
  });

  describe('notifyShowDataLoaded', () => {
    beforeEach(() => {
      (accountsDb.findAccountIdByProfileId as jest.Mock).mockResolvedValue(123);

      // Set up a mock socket in the server's socket map
      mockSocketsMap.set('socket-id', { ...mockSocket, data: { accountId: 123 } });
    });

    it('should emit an updateShowFavorite event to the correct user', async () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      const mockShow = { show_id: 456, title: 'Test Show' };
      await service.notifyShowDataLoaded('profile-123', 456, mockShow as any);

      expect(accountsDb.findAccountIdByProfileId).toHaveBeenCalledWith('profile-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('updateShowFavorite', {
        message: 'Show data has been fully loaded',
        show: mockShow,
      });
    });

    it('should handle errors when finding account ID', async () => {
      const error = new Error('Database error');
      (accountsDb.findAccountIdByProfileId as jest.Mock).mockRejectedValue(error);

      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      await service.notifyShowDataLoaded('profile-123', 456, {} as any);

      expect(cliLogger.error).toHaveBeenCalledWith('Error notifying show data loaded:', error);
    });

    it('should do nothing if account ID is not found', async () => {
      (accountsDb.findAccountIdByProfileId as jest.Mock).mockResolvedValue(null);

      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      await service.notifyShowDataLoaded('profile-123', 456, {} as any);

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('disconnectUserSockets', () => {
    beforeEach(() => {
      // Set up multiple mock sockets in the server's socket map
      const mockSocket1 = {
        ...mockSocket,
        data: { accountId: '123' },
        emit: jest.fn(),
        disconnect: jest.fn(),
      };
      const mockSocket2 = {
        ...mockSocket,
        data: { accountId: '123' },
        emit: jest.fn(),
        disconnect: jest.fn(),
      };
      const mockSocket3 = {
        ...mockSocket,
        data: { accountId: '456' },
        emit: jest.fn(),
        disconnect: jest.fn(),
      };

      mockSocketsMap.set('socket-id-1', mockSocket1);
      mockSocketsMap.set('socket-id-2', mockSocket2);
      mockSocketsMap.set('socket-id-3', mockSocket3);
    });

    it('should disconnect all sockets for the specified account', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      const disconnectedCount = service.disconnectUserSockets('123');

      expect(disconnectedCount).toBe(2);

      // Get the sockets from the Map
      const socket1 = mockSocketsMap.get('socket-id-1');
      const socket2 = mockSocketsMap.get('socket-id-2');
      const socket3 = mockSocketsMap.get('socket-id-3');

      // Verify the right sockets were disconnected
      expect(socket1?.emit).toHaveBeenCalledWith('forceLogout', {
        message: 'You have been logged out from this device',
      });
      expect(socket1?.disconnect).toHaveBeenCalledWith(true);

      expect(socket2?.emit).toHaveBeenCalledWith('forceLogout', {
        message: 'You have been logged out from this device',
      });
      expect(socket2?.disconnect).toHaveBeenCalledWith(true);

      // This socket should not have been disconnected
      expect(socket3?.emit).not.toHaveBeenCalled();
      expect(socket3?.disconnect).not.toHaveBeenCalled();

      expect(cliLogger.info).toHaveBeenCalledTimes(2);
      expect(cliLogger.info).toHaveBeenCalledWith('Disconnected socket for account 123 due to logout');
    });

    it('should work with numeric account IDs', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      const disconnectedCount = service.disconnectUserSockets(123);

      expect(disconnectedCount).toBe(2);

      // Get the sockets from the Map
      const socket1 = mockSocketsMap.get('socket-id-1');
      const socket2 = mockSocketsMap.get('socket-id-2');

      // Verify the right sockets were disconnected
      expect(socket1?.disconnect).toHaveBeenCalledWith(true);
      expect(socket2?.disconnect).toHaveBeenCalledWith(true);
    });

    it('should return 0 if no sockets found for the account', () => {
      const service = SocketService.getInstance();
      service.initialize(mockServer as Server);

      const disconnectedCount = service.disconnectUserSockets('999');

      expect(disconnectedCount).toBe(0);
      expect(cliLogger.info).not.toHaveBeenCalled();
    });

    it('should return 0 if server is not initialized', () => {
      const service = SocketService.getInstance();

      const disconnectedCount = service.disconnectUserSockets('123');

      expect(disconnectedCount).toBe(0);
    });
  });

  describe('exported singleton instance', () => {
    it('should export the same instance as getInstance', () => {
      const instance = SocketService.getInstance();
      expect(socketService).toStrictEqual(instance);
    });
  });
});
