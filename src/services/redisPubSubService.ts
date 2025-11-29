import { getRedisConfig } from '../config/config';
import { appLogger, cliLogger } from '../logger/logger';
import { CompletedJobEvent } from '@ajgifford/keepwatching-types';
import Redis from 'ioredis';

/**
 * Redis pub/sub channels for content updates
 */
const CHANNELS = {
  SHOWS_UPDATE: 'content:shows:updated',
  MOVIES_UPDATE: 'content:movies:updated',
  PEOPLE_UPDATE: 'content:people:updated',
  EMAIL_DIGEST: 'content:email:sent',
  PERFORMANCE_ARCHIVE: 'content:performance:archived',
} as const;

/**
 * Type for event handlers
 */
type EventHandler = (event: CompletedJobEvent) => void | Promise<void>;

/**
 * Service for Redis pub/sub communication between admin-server and api-server
 * Used to notify api-server when scheduled jobs complete so it can broadcast to WebSocket clients
 */
export class RedisPubSubService {
  private static instance: RedisPubSubService | null = null;
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private handlers: Map<string, EventHandler[]> = new Map();
  private isInitialized = false;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Gets the singleton instance of RedisPubSubService
   */
  public static getInstance(): RedisPubSubService {
    if (!RedisPubSubService.instance) {
      RedisPubSubService.instance = new RedisPubSubService();
    }
    return RedisPubSubService.instance;
  }

  /**
   * Initialize Redis pub/sub connections
   * Creates separate Redis connections for publishing and subscribing (Redis requirement)
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      cliLogger.warn('RedisPubSubService already initialized');
      return;
    }

    try {
      const config = getRedisConfig();

      // Create publisher connection
      this.publisher = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        lazyConnect: true,
      });

      // Create subscriber connection (must be separate from publisher)
      this.subscriber = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        lazyConnect: true,
      });

      // Set up event handlers
      this.setupPublisherHandlers();
      this.setupSubscriberHandlers();

      // Connect both clients
      await this.publisher.connect();
      await this.subscriber.connect();

      this.isInitialized = true;
      cliLogger.info('RedisPubSubService initialized successfully');
    } catch (error) {
      cliLogger.error('Failed to initialize RedisPubSubService:', error);
      appLogger.error('RedisPubSubService initialization failed', { error });
      throw error;
    }
  }

  /**
   * Set up event handlers for publisher connection
   */
  private setupPublisherHandlers(): void {
    if (!this.publisher) return;

    this.publisher.on('connect', () => {
      cliLogger.info('Redis publisher connected');
    });

    this.publisher.on('error', (error) => {
      appLogger.error('Redis publisher error:', error);
    });

    this.publisher.on('close', () => {
      cliLogger.warn('Redis publisher connection closed');
    });
  }

  /**
   * Set up event handlers for subscriber connection
   */
  private setupSubscriberHandlers(): void {
    if (!this.subscriber) return;

    this.subscriber.on('connect', () => {
      cliLogger.info('Redis subscriber connected');
    });

    this.subscriber.on('error', (error) => {
      appLogger.error('Redis subscriber error:', error);
    });

    this.subscriber.on('close', () => {
      cliLogger.warn('Redis subscriber connection closed');
    });

    // Handle incoming messages
    this.subscriber.on('message', (channel: string, message: string) => {
      this.handleMessage(channel, message);
    });
  }

  /**
   * Handle incoming Redis pub/sub messages
   */
  private handleMessage(channel: string, message: string): void {
    try {
      const event: CompletedJobEvent = JSON.parse(message);
      const handlers = this.handlers.get(channel);

      if (handlers && handlers.length > 0) {
        handlers.forEach((handler) => {
          try {
            handler(event);
          } catch (error) {
            appLogger.error(`Error in handler for channel ${channel}:`, error);
          }
        });
      }
    } catch (error) {
      appLogger.error(`Failed to parse message from channel ${channel}:`, error);
    }
  }

  /**
   * Publish a shows update event
   */
  public async publishShowsUpdate(message: string = 'Shows updated successfully'): Promise<void> {
    await this.publish(CHANNELS.SHOWS_UPDATE, {
      type: 'shows',
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Publish a movies update event
   */
  public async publishMoviesUpdate(message: string = 'Movies updated successfully'): Promise<void> {
    await this.publish(CHANNELS.MOVIES_UPDATE, {
      type: 'movies',
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Publish a people update event
   */
  public async publishPeopleUpdate(message: string = 'People updated successfully'): Promise<void> {
    await this.publish(CHANNELS.PEOPLE_UPDATE, {
      type: 'people',
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Publish an email digest sent event
   */
  public async publishEmailDigest(message: string = 'Email digests sent successfully'): Promise<void> {
    await this.publish(CHANNELS.EMAIL_DIGEST, {
      type: 'email',
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Publish a performance archive event
   */
  public async publishPerformanceArchive(message: string = 'Performance data archived successfully'): Promise<void> {
    await this.publish(CHANNELS.PERFORMANCE_ARCHIVE, {
      type: 'performance-archive',
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Generic publish method
   */
  private async publish(channel: string, event: CompletedJobEvent): Promise<void> {
    if (!this.publisher || this.publisher.status !== 'ready') {
      cliLogger.warn(`Cannot publish to ${channel}: Redis publisher not ready`);
      return;
    }

    try {
      const message = JSON.stringify(event);
      await this.publisher.publish(channel, message);
      cliLogger.info(`Published event to ${channel}: ${event.message}`);
    } catch (error) {
      appLogger.error(`Failed to publish to ${channel}:`, error);
    }
  }

  /**
   * Subscribe to a specific channel
   * @param channel Channel to subscribe to
   * @param handler Function to call when events are received
   */
  public async subscribe(channel: string, handler: EventHandler): Promise<void> {
    if (!this.subscriber || this.subscriber.status !== 'ready') {
      throw new Error('Redis subscriber not ready');
    }

    // Add handler to the map
    const handlers = this.handlers.get(channel) || [];
    handlers.push(handler);
    this.handlers.set(channel, handlers);

    // Subscribe to the channel if this is the first handler
    if (handlers.length === 1) {
      await this.subscriber.subscribe(channel);
      cliLogger.info(`Subscribed to Redis channel: ${channel}`);
    }
  }

  /**
   * Subscribe to shows update events
   */
  public async subscribeToShowsUpdates(handler: EventHandler): Promise<void> {
    await this.subscribe(CHANNELS.SHOWS_UPDATE, handler);
  }

  /**
   * Subscribe to movies update events
   */
  public async subscribeToMoviesUpdates(handler: EventHandler): Promise<void> {
    await this.subscribe(CHANNELS.MOVIES_UPDATE, handler);
  }

  /**
   * Subscribe to people update events
   */
  public async subscribeToPeopleUpdates(handler: EventHandler): Promise<void> {
    await this.subscribe(CHANNELS.PEOPLE_UPDATE, handler);
  }

  /**
   * Subscribe to email digest events
   */
  public async subscribeToEmailDigests(handler: EventHandler): Promise<void> {
    await this.subscribe(CHANNELS.EMAIL_DIGEST, handler);
  }

  /**
   * Subscribe to performance archive events
   */
  public async subscribeToPerformanceArchive(handler: EventHandler): Promise<void> {
    await this.subscribe(CHANNELS.PERFORMANCE_ARCHIVE, handler);
  }

  /**
   * Unsubscribe from a channel
   */
  public async unsubscribe(channel: string): Promise<void> {
    if (!this.subscriber) return;

    this.handlers.delete(channel);
    await this.subscriber.unsubscribe(channel);
    cliLogger.info(`Unsubscribed from Redis channel: ${channel}`);
  }

  /**
   * Check if the service is initialized and ready
   */
  public isReady(): boolean {
    return this.isInitialized && this.publisher?.status === 'ready' && this.subscriber?.status === 'ready';
  }

  /**
   * Get connection status
   */
  public getStatus(): {
    initialized: boolean;
    publisherStatus: string;
    subscriberStatus: string;
  } {
    return {
      initialized: this.isInitialized,
      publisherStatus: this.publisher?.status || 'disconnected',
      subscriberStatus: this.subscriber?.status || 'disconnected',
    };
  }

  /**
   * Disconnect and cleanup
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.subscriber) {
        // Unsubscribe from all channels
        const channels = Array.from(this.handlers.keys());
        if (channels.length > 0) {
          await this.subscriber.unsubscribe(...channels);
        }
        await this.subscriber.quit();
        this.subscriber = null;
      }

      if (this.publisher) {
        await this.publisher.quit();
        this.publisher = null;
      }

      this.handlers.clear();
      this.isInitialized = false;
      cliLogger.info('RedisPubSubService disconnected');
    } catch (error) {
      cliLogger.error('Error during RedisPubSubService disconnect:', error);
    }
  }

  /**
   * Reset singleton instance (for testing)
   */
  public static resetInstance(): void {
    RedisPubSubService.instance = null;
  }
}

// Export singleton instance
export const redisPubSubService = RedisPubSubService.getInstance();
