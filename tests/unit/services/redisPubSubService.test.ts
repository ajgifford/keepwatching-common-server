import { CompletedJobEvent } from '@ajgifford/keepwatching-types';
import { RedisPubSubService } from '@services/redisPubSubService';
import { appLogger, cliLogger } from '@logger/logger';
import { getRedisConfig } from '@config/config';
import Redis from 'ioredis';

// Mock dependencies
jest.mock('@logger/logger', () => ({
  appLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@config/config');

// Mock Redis
jest.mock('ioredis');

describe('RedisPubSubService', () => {
  let service: RedisPubSubService;
  let mockPublisher: jest.Mocked<Redis>;
  let mockSubscriber: jest.Mocked<Redis>;
  let mockRedisConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton instance before each test
    RedisPubSubService.resetInstance();
    service = RedisPubSubService.getInstance();

    // Mock Redis config
    mockRedisConfig = {
      host: 'localhost',
      port: 6379,
      password: 'test-password',
      db: 0,
    };
    (getRedisConfig as jest.Mock).mockReturnValue(mockRedisConfig);

    // Create mock Redis instances
    mockPublisher = {
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockResolvedValue(1),
      on: jest.fn(),
      status: 'ready',
    } as any;

    mockSubscriber = {
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      status: 'ready',
    } as any;

    // Mock Redis constructor to return our mocks
    (Redis as unknown as jest.Mock)
      .mockReturnValueOnce(mockPublisher)
      .mockReturnValueOnce(mockSubscriber);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = RedisPubSubService.getInstance();
      const instance2 = RedisPubSubService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = RedisPubSubService.getInstance();
      RedisPubSubService.resetInstance();
      const instance2 = RedisPubSubService.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize Redis connections successfully', async () => {
      await service.initialize();

      expect(getRedisConfig).toHaveBeenCalled();
      expect(Redis).toHaveBeenCalledTimes(2);
      expect(mockPublisher.connect).toHaveBeenCalled();
      expect(mockSubscriber.connect).toHaveBeenCalled();
      expect(cliLogger.info).toHaveBeenCalledWith('RedisPubSubService initialized successfully');
    });

    it('should create Redis instances with correct configuration', async () => {
      await service.initialize();

      expect(Redis).toHaveBeenNthCalledWith(1, {
        host: 'localhost',
        port: 6379,
        password: 'test-password',
        db: 0,
        retryStrategy: expect.any(Function),
        lazyConnect: true,
      });

      expect(Redis).toHaveBeenNthCalledWith(2, {
        host: 'localhost',
        port: 6379,
        password: 'test-password',
        db: 0,
        retryStrategy: expect.any(Function),
        lazyConnect: true,
      });
    });

    it('should set up publisher event handlers', async () => {
      await service.initialize();

      expect(mockPublisher.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockPublisher.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockPublisher.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should set up subscriber event handlers', async () => {
      await service.initialize();

      expect(mockSubscriber.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSubscriber.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockSubscriber.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockSubscriber.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should warn if already initialized', async () => {
      await service.initialize();
      jest.clearAllMocks();

      await service.initialize();

      expect(cliLogger.warn).toHaveBeenCalledWith('RedisPubSubService already initialized');
      expect(getRedisConfig).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      const connectionError = new Error('Connection failed');
      mockPublisher.connect.mockRejectedValue(connectionError);

      await expect(service.initialize()).rejects.toThrow('Connection failed');

      expect(cliLogger.error).toHaveBeenCalledWith('Failed to initialize RedisPubSubService:', connectionError);
      expect(appLogger.error).toHaveBeenCalledWith('RedisPubSubService initialization failed', {
        error: connectionError,
      });
    });

    it('should use correct retry strategy', async () => {
      await service.initialize();

      const redisCall = (Redis as unknown as jest.Mock).mock.calls[0][0];
      const retryStrategy = redisCall.retryStrategy;

      expect(retryStrategy(1)).toBe(50);
      expect(retryStrategy(10)).toBe(500);
      expect(retryStrategy(50)).toBe(2000);
      expect(retryStrategy(100)).toBe(2000);
    });
  });

  describe('publish methods', () => {
    beforeEach(async () => {
      await service.initialize();
      jest.clearAllMocks();
    });

    describe('publishShowsUpdate', () => {
      it('should publish shows update with default message', async () => {
        const mockDate = new Date('2025-01-15T10:00:00Z');
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

        await service.publishShowsUpdate();

        expect(mockPublisher.publish).toHaveBeenCalledWith(
          'content:shows:updated',
          JSON.stringify({
            type: 'shows',
            message: 'Shows updated successfully',
            timestamp: mockDate.toISOString(),
          }),
        );
        expect(cliLogger.info).toHaveBeenCalledWith(
          'Published event to content:shows:updated: Shows updated successfully',
        );

        jest.restoreAllMocks();
      });

      it('should publish shows update with custom message', async () => {
        const mockDate = new Date('2025-01-15T10:00:00Z');
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

        await service.publishShowsUpdate('Custom shows message');

        expect(mockPublisher.publish).toHaveBeenCalledWith(
          'content:shows:updated',
          JSON.stringify({
            type: 'shows',
            message: 'Custom shows message',
            timestamp: mockDate.toISOString(),
          }),
        );

        jest.restoreAllMocks();
      });
    });

    describe('publishMoviesUpdate', () => {
      it('should publish movies update with default message', async () => {
        const mockDate = new Date('2025-01-15T10:00:00Z');
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

        await service.publishMoviesUpdate();

        expect(mockPublisher.publish).toHaveBeenCalledWith(
          'content:movies:updated',
          JSON.stringify({
            type: 'movies',
            message: 'Movies updated successfully',
            timestamp: mockDate.toISOString(),
          }),
        );

        jest.restoreAllMocks();
      });

      it('should publish movies update with custom message', async () => {
        await service.publishMoviesUpdate('Custom movies message');

        const call = (mockPublisher.publish as jest.Mock).mock.calls[0];
        const event = JSON.parse(call[1]);

        expect(event.type).toBe('movies');
        expect(event.message).toBe('Custom movies message');
      });
    });

    describe('publishPeopleUpdate', () => {
      it('should publish people update with default message', async () => {
        const mockDate = new Date('2025-01-15T10:00:00Z');
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

        await service.publishPeopleUpdate();

        expect(mockPublisher.publish).toHaveBeenCalledWith(
          'content:people:updated',
          JSON.stringify({
            type: 'people',
            message: 'People updated successfully',
            timestamp: mockDate.toISOString(),
          }),
        );

        jest.restoreAllMocks();
      });

      it('should publish people update with custom message', async () => {
        await service.publishPeopleUpdate('Custom people message');

        const call = (mockPublisher.publish as jest.Mock).mock.calls[0];
        const event = JSON.parse(call[1]);

        expect(event.type).toBe('people');
        expect(event.message).toBe('Custom people message');
      });
    });

    describe('publishEmailDigest', () => {
      it('should publish email digest with default message', async () => {
        const mockDate = new Date('2025-01-15T10:00:00Z');
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

        await service.publishEmailDigest();

        expect(mockPublisher.publish).toHaveBeenCalledWith(
          'content:email:sent',
          JSON.stringify({
            type: 'email',
            message: 'Email digests sent successfully',
            timestamp: mockDate.toISOString(),
          }),
        );

        jest.restoreAllMocks();
      });

      it('should publish email digest with custom message', async () => {
        await service.publishEmailDigest('Custom email message');

        const call = (mockPublisher.publish as jest.Mock).mock.calls[0];
        const event = JSON.parse(call[1]);

        expect(event.type).toBe('email');
        expect(event.message).toBe('Custom email message');
      });
    });

    describe('publishPerformanceArchive', () => {
      it('should publish performance archive with default message', async () => {
        const mockDate = new Date('2025-01-15T10:00:00Z');
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

        await service.publishPerformanceArchive();

        expect(mockPublisher.publish).toHaveBeenCalledWith(
          'content:performance:archived',
          JSON.stringify({
            type: 'performance-archive',
            message: 'Performance data archived successfully',
            timestamp: mockDate.toISOString(),
          }),
        );

        jest.restoreAllMocks();
      });

      it('should publish performance archive with custom message', async () => {
        await service.publishPerformanceArchive('Custom performance message');

        const call = (mockPublisher.publish as jest.Mock).mock.calls[0];
        const event = JSON.parse(call[1]);

        expect(event.type).toBe('performance-archive');
        expect(event.message).toBe('Custom performance message');
      });
    });

    it('should not publish if publisher is not ready', async () => {
      mockPublisher.status = 'connecting';

      await service.publishShowsUpdate();

      expect(mockPublisher.publish).not.toHaveBeenCalled();
      expect(cliLogger.warn).toHaveBeenCalledWith('Cannot publish to content:shows:updated: Redis publisher not ready');
    });

    it('should handle publish errors gracefully', async () => {
      const publishError = new Error('Publish failed');
      mockPublisher.publish.mockRejectedValue(publishError);

      await service.publishShowsUpdate();

      expect(appLogger.error).toHaveBeenCalledWith('Failed to publish to content:shows:updated:', publishError);
    });
  });

  describe('subscribe methods', () => {
    beforeEach(async () => {
      await service.initialize();
      jest.clearAllMocks();
    });

    describe('subscribe', () => {
      it('should subscribe to a channel and add handler', async () => {
        const handler = jest.fn();

        await service.subscribe('test-channel', handler);

        expect(mockSubscriber.subscribe).toHaveBeenCalledWith('test-channel');
        expect(cliLogger.info).toHaveBeenCalledWith('Subscribed to Redis channel: test-channel');
      });

      it('should not subscribe again if handlers already exist', async () => {
        const handler1 = jest.fn();
        const handler2 = jest.fn();

        await service.subscribe('test-channel', handler1);
        jest.clearAllMocks();

        await service.subscribe('test-channel', handler2);

        expect(mockSubscriber.subscribe).not.toHaveBeenCalled();
      });

      it('should throw error if subscriber is not ready', async () => {
        mockSubscriber.status = 'close' as any;
        const handler = jest.fn();

        await expect(service.subscribe('test-channel', handler)).rejects.toThrow('Redis subscriber not ready');
      });
    });

    describe('subscribeToShowsUpdates', () => {
      it('should subscribe to shows update channel', async () => {
        const handler = jest.fn();

        await service.subscribeToShowsUpdates(handler);

        expect(mockSubscriber.subscribe).toHaveBeenCalledWith('content:shows:updated');
      });
    });

    describe('subscribeToMoviesUpdates', () => {
      it('should subscribe to movies update channel', async () => {
        const handler = jest.fn();

        await service.subscribeToMoviesUpdates(handler);

        expect(mockSubscriber.subscribe).toHaveBeenCalledWith('content:movies:updated');
      });
    });

    describe('subscribeToPeopleUpdates', () => {
      it('should subscribe to people update channel', async () => {
        const handler = jest.fn();

        await service.subscribeToPeopleUpdates(handler);

        expect(mockSubscriber.subscribe).toHaveBeenCalledWith('content:people:updated');
      });
    });

    describe('subscribeToEmailDigests', () => {
      it('should subscribe to email digest channel', async () => {
        const handler = jest.fn();

        await service.subscribeToEmailDigests(handler);

        expect(mockSubscriber.subscribe).toHaveBeenCalledWith('content:email:sent');
      });
    });

    describe('subscribeToPerformanceArchive', () => {
      it('should subscribe to performance archive channel', async () => {
        const handler = jest.fn();

        await service.subscribeToPerformanceArchive(handler);

        expect(mockSubscriber.subscribe).toHaveBeenCalledWith('content:performance:archived');
      });
    });
  });

  describe('message handling', () => {
    let messageHandler: Function;

    beforeEach(async () => {
      await service.initialize();

      // Save the message handler before clearing mocks
      const onCalls = (mockSubscriber.on as jest.Mock).mock.calls;
      const messageHandlerCall = onCalls.find((call) => call[0] === 'message');
      messageHandler = messageHandlerCall![1];

      jest.clearAllMocks();
    });

    it('should call handlers when message is received', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      await service.subscribe('test-channel', handler1);
      await service.subscribe('test-channel', handler2);

      const event: CompletedJobEvent = {
        type: 'shows',
        message: 'Test message',
        timestamp: new Date().toISOString(),
      };

      messageHandler('test-channel', JSON.stringify(event));

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it('should handle messages with no registered handlers', async () => {
      const event: CompletedJobEvent = {
        type: 'shows',
        message: 'Test message',
        timestamp: new Date().toISOString(),
      };

      expect(() => {
        messageHandler('unknown-channel', JSON.stringify(event));
      }).not.toThrow();
    });

    it('should handle invalid JSON in message', async () => {
      const handler = jest.fn();
      await service.subscribe('test-channel', handler);

      messageHandler('test-channel', 'invalid json');

      expect(handler).not.toHaveBeenCalled();
      expect(appLogger.error).toHaveBeenCalledWith(
        'Failed to parse message from channel test-channel:',
        expect.any(Error),
      );
    });

    it('should handle errors in handler execution', async () => {
      const handler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });

      await service.subscribe('test-channel', handler);

      const event: CompletedJobEvent = {
        type: 'shows',
        message: 'Test message',
        timestamp: new Date().toISOString(),
      };

      messageHandler('test-channel', JSON.stringify(event));

      expect(appLogger.error).toHaveBeenCalledWith(
        'Error in handler for channel test-channel:',
        expect.any(Error),
      );
    });
  });

  describe('unsubscribe', () => {
    beforeEach(async () => {
      await service.initialize();
      jest.clearAllMocks();
    });

    it('should unsubscribe from channel', async () => {
      const handler = jest.fn();
      await service.subscribe('test-channel', handler);
      jest.clearAllMocks();

      await service.unsubscribe('test-channel');

      expect(mockSubscriber.unsubscribe).toHaveBeenCalledWith('test-channel');
      expect(cliLogger.info).toHaveBeenCalledWith('Unsubscribed from Redis channel: test-channel');
    });

    it('should handle unsubscribe when not subscribed', async () => {
      await service.unsubscribe('test-channel');

      expect(mockSubscriber.unsubscribe).toHaveBeenCalledWith('test-channel');
    });
  });

  describe('isReady', () => {
    it('should return false when not initialized', () => {
      expect(service.isReady()).toBe(false);
    });

    it('should return true when initialized and connections ready', async () => {
      await service.initialize();

      expect(service.isReady()).toBe(true);
    });

    it('should return false when publisher is not ready', async () => {
      await service.initialize();
      mockPublisher.status = 'connecting';

      expect(service.isReady()).toBe(false);
    });

    it('should return false when subscriber is not ready', async () => {
      await service.initialize();
      mockSubscriber.status = 'connecting';

      expect(service.isReady()).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return disconnected status when not initialized', () => {
      const status = service.getStatus();

      expect(status).toEqual({
        initialized: false,
        publisherStatus: 'disconnected',
        subscriberStatus: 'disconnected',
      });
    });

    it('should return ready status when initialized', async () => {
      await service.initialize();

      const status = service.getStatus();

      expect(status).toEqual({
        initialized: true,
        publisherStatus: 'ready',
        subscriberStatus: 'ready',
      });
    });

    it('should reflect current connection status', async () => {
      await service.initialize();
      mockPublisher.status = 'connecting';
      mockSubscriber.status = 'end';

      const status = service.getStatus();

      expect(status).toEqual({
        initialized: true,
        publisherStatus: 'connecting',
        subscriberStatus: 'end',
      });
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      await service.initialize();
      jest.clearAllMocks();
    });

    it('should disconnect and cleanup all resources', async () => {
      const handler = jest.fn();
      await service.subscribe('test-channel-1', handler);
      await service.subscribe('test-channel-2', handler);
      jest.clearAllMocks();

      await service.disconnect();

      expect(mockSubscriber.unsubscribe).toHaveBeenCalledWith('test-channel-1', 'test-channel-2');
      expect(mockSubscriber.quit).toHaveBeenCalled();
      expect(mockPublisher.quit).toHaveBeenCalled();
      expect(cliLogger.info).toHaveBeenCalledWith('RedisPubSubService disconnected');
      expect(service.isReady()).toBe(false);
    });

    it('should not unsubscribe if no channels are subscribed', async () => {
      await service.disconnect();

      expect(mockSubscriber.unsubscribe).not.toHaveBeenCalled();
      expect(mockSubscriber.quit).toHaveBeenCalled();
      expect(mockPublisher.quit).toHaveBeenCalled();
    });

    it('should handle disconnect errors', async () => {
      const disconnectError = new Error('Disconnect failed');
      mockSubscriber.quit.mockRejectedValue(disconnectError);

      await service.disconnect();

      expect(cliLogger.error).toHaveBeenCalledWith(
        'Error during RedisPubSubService disconnect:',
        disconnectError,
      );
    });

    it('should handle null connections gracefully', async () => {
      await service.disconnect();
      jest.clearAllMocks();

      await service.disconnect();

      expect(mockSubscriber.quit).not.toHaveBeenCalled();
      expect(mockPublisher.quit).not.toHaveBeenCalled();
    });
  });

  describe('Redis event handlers', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should log publisher connect event', () => {
      const connectHandler = (mockPublisher.on as jest.Mock).mock.calls.find((call) => call[0] === 'connect')?.[1];

      connectHandler();

      expect(cliLogger.info).toHaveBeenCalledWith('Redis publisher connected');
    });

    it('should log publisher error event', () => {
      const errorHandler = (mockPublisher.on as jest.Mock).mock.calls.find((call) => call[0] === 'error')?.[1];
      const testError = new Error('Publisher error');

      errorHandler(testError);

      expect(appLogger.error).toHaveBeenCalledWith('Redis publisher error:', testError);
    });

    it('should log publisher close event', () => {
      const closeHandler = (mockPublisher.on as jest.Mock).mock.calls.find((call) => call[0] === 'close')?.[1];

      closeHandler();

      expect(cliLogger.warn).toHaveBeenCalledWith('Redis publisher connection closed');
    });

    it('should log subscriber connect event', () => {
      const connectHandler = (mockSubscriber.on as jest.Mock).mock.calls.find((call) => call[0] === 'connect')?.[1];

      connectHandler();

      expect(cliLogger.info).toHaveBeenCalledWith('Redis subscriber connected');
    });

    it('should log subscriber error event', () => {
      const errorHandler = (mockSubscriber.on as jest.Mock).mock.calls.find((call) => call[0] === 'error')?.[1];
      const testError = new Error('Subscriber error');

      errorHandler(testError);

      expect(appLogger.error).toHaveBeenCalledWith('Redis subscriber error:', testError);
    });

    it('should log subscriber close event', () => {
      const closeHandler = (mockSubscriber.on as jest.Mock).mock.calls.find((call) => call[0] === 'close')?.[1];

      closeHandler();

      expect(cliLogger.warn).toHaveBeenCalledWith('Redis subscriber connection closed');
    });
  });

  describe('integration scenarios', () => {
    let messageHandler: Function;

    beforeEach(async () => {
      await service.initialize();

      // Save the message handler before clearing mocks
      const onCalls = (mockSubscriber.on as jest.Mock).mock.calls;
      const messageHandlerCall = onCalls.find((call) => call[0] === 'message');
      messageHandler = messageHandlerCall![1];

      jest.clearAllMocks();
    });

    it('should handle full publish-subscribe workflow', async () => {
      const receivedEvents: CompletedJobEvent[] = [];
      const handler = jest.fn((event: CompletedJobEvent) => {
        receivedEvents.push(event);
      });

      await service.subscribeToShowsUpdates(handler);

      await service.publishShowsUpdate('Test show update');

      const publishCall = (mockPublisher.publish as jest.Mock).mock.calls[0];
      const event = JSON.parse(publishCall[1]);

      messageHandler('content:shows:updated', JSON.stringify(event));

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].type).toBe('shows');
      expect(receivedEvents[0].message).toBe('Test show update');
    });

    it('should handle multiple subscriptions to different channels', async () => {
      const showsHandler = jest.fn();
      const moviesHandler = jest.fn();

      await service.subscribeToShowsUpdates(showsHandler);
      await service.subscribeToMoviesUpdates(moviesHandler);

      expect(mockSubscriber.subscribe).toHaveBeenCalledWith('content:shows:updated');
      expect(mockSubscriber.subscribe).toHaveBeenCalledWith('content:movies:updated');
    });

    it('should cleanup properly after disconnect', async () => {
      const handler = jest.fn();
      await service.subscribeToShowsUpdates(handler);

      await service.disconnect();

      expect(service.isReady()).toBe(false);
      expect(service.getStatus().initialized).toBe(false);
    });
  });
});
