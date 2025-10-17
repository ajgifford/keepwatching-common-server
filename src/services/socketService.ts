import { getNotificationPollingInterval } from '../config/config';
import { cliLogger } from '../logger/logger';
import { accountService } from './accountService';
import { notificationsService } from './notificationsService';
import { AccountNotification, ProfileShow } from '@ajgifford/keepwatching-types';
import * as cron from 'node-cron';
import { Server, Socket } from 'socket.io';

interface CachedNotifications {
  [accountId: number]: {
    notifications: AccountNotification[];
    lastChecked: Date;
  };
}

interface ConnectedUser {
  accountId: number;
  socketId: string;
  userId: string;
  email?: string;
}

/**
 * Service for managing WebSocket connections and notifications
 * Provides methods for setup, connection handling, sending notifications, and notification polling
 */
export class SocketService {
  private static instance: SocketService | null = null;
  private io: Server | null = null;

  // Notification polling properties
  private pollingJob: cron.ScheduledTask | null = null;
  private notificationCache: CachedNotifications = {};
  private connectedUsers: Map<string, ConnectedUser> = new Map();
  private readonly POLLING_INTERVAL = getNotificationPollingInterval(); // Every 5 minutes
  private isPollingActive = false;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Gets the singleton instance of SocketService
   * @returns The singleton SocketService instance
   */
  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Initializes the Socket.IO server and starts notification polling
   * @param io Socket.IO server instance
   */
  public initialize(io: Server): void {
    this.io = io;
    this.setupConnectionHandlers();
    this.startNotificationPolling();
    cliLogger.info('Socket service initialized with notification polling');
  }

  /**
   * Sets up connection handlers for Socket.IO
   */
  private setupConnectionHandlers(): void {
    if (!this.io) return;

    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }
        const account_id = socket.handshake.auth?.account_id;
        if (!account_id) {
          return next(new Error('Authentication error: No account id provided'));
        }

        next();
      } catch (error) {
        cliLogger.error('WebSocket Auth Failed:', error);
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handles a new socket connection
   * @param socket The connected socket
   */
  private handleConnection(socket: Socket): void {
    const accountId = socket.data.accountId;
    const userId = socket.data.userId;
    const email = socket.data.email;

    cliLogger.info(`Client connected: ${email} - ${userId}`);

    if (accountId && userId) {
      // Track connected user for notification polling
      this.connectedUsers.set(socket.id, {
        accountId: parseInt(accountId),
        socketId: socket.id,
        userId,
        email,
      });

      // Send any cached notifications immediately on connection
      this.sendCachedNotifications(parseInt(accountId), socket.id);
    }

    socket.on('disconnect', () => {
      cliLogger.info(`Client disconnected: ${email} - ${userId}`);
      this.connectedUsers.delete(socket.id);
    });
  }

  /**
   * Start notification polling
   */
  private startNotificationPolling(): void {
    if (this.pollingJob) {
      this.pollingJob.stop();
    }

    this.pollingJob = cron.schedule(
      this.POLLING_INTERVAL,
      () => {
        this.pollNotifications();
      },
      {
        timezone: 'UTC',
      },
    );

    this.pollingJob.start();
    this.isPollingActive = true;
    cliLogger.info('Notification polling started with 5-minute interval');
  }

  /**
   * Stop notification polling
   */
  private stopNotificationPolling(): void {
    if (this.pollingJob) {
      this.pollingJob.stop();
      this.pollingJob = null;
    }
    this.isPollingActive = false;
    cliLogger.info('Notification polling stopped');
  }

  /**
   * Main polling function that checks notifications for all connected users
   */
  private async pollNotifications(): Promise<void> {
    if (this.connectedUsers.size === 0) {
      return;
    }

    cliLogger.info(`Polling notifications for ${this.connectedUsers.size} connected users`);

    // Get unique account IDs from connected users
    const accountIds = new Set<number>();
    this.connectedUsers.forEach((user) => accountIds.add(user.accountId));

    // Check notifications for each account
    const promises = Array.from(accountIds).map((accountId) => this.checkNotificationsForAccount(accountId));

    try {
      await Promise.allSettled(promises);
    } catch (error) {
      cliLogger.error('Error during notification polling cycle:', error);
    }
  }

  /**
   * Check notifications for a specific account
   */
  private async checkNotificationsForAccount(accountId: number): Promise<void> {
    try {
      // Skip if we've checked recently (less than 4 minutes ago)
      const cached = this.notificationCache[accountId];
      const now = new Date();

      if (cached && now.getTime() - cached.lastChecked.getTime() < 4 * 60 * 1000) {
        return;
      }

      const notifications = await notificationsService.getNotifications(accountId);

      // Check if there are new notifications
      const hasNewNotifications = this.hasNewNotifications(accountId, notifications);

      // Update cache
      this.notificationCache[accountId] = {
        notifications,
        lastChecked: now,
      };

      // Send notifications to connected users
      if (hasNewNotifications) {
        this.sendNotificationsToAccount(accountId, notifications, true);
      }
    } catch (error) {
      cliLogger.error(`Failed to check notifications for account ${accountId}:`, error);
    }
  }

  /**
   * Check if there are new notifications compared to cache
   */
  private hasNewNotifications(accountId: number, newNotifications: AccountNotification[]): boolean {
    const cached = this.notificationCache[accountId];

    if (!cached) {
      return newNotifications.length > 0;
    }

    // Compare notification IDs
    const cachedIds = new Set(cached.notifications.map((n) => n.id));
    const newIds = new Set(newNotifications.map((n) => n.id));

    // Check if there are any new notification IDs
    for (const id of newIds) {
      if (!cachedIds.has(id)) {
        return true;
      }
    }

    // Check if notification count changed
    return newNotifications.length !== cached.notifications.length;
  }

  /**
   * Send notifications to all connected sockets for an account
   */
  private sendNotificationsToAccount(
    accountId: number,
    notifications: AccountNotification[],
    isNew: boolean = false,
  ): void {
    const accountSockets = Array.from(this.connectedUsers.values()).filter((user) => user.accountId === accountId);

    if (accountSockets.length === 0 || !this.io) {
      return;
    }

    const eventName = isNew ? 'newNotifications' : 'updateNotifications';
    const eventData = {
      notifications,
      timestamp: new Date().toISOString(),
    };

    accountSockets.forEach((user) => {
      const socket = this.io!.sockets.sockets.get(user.socketId);
      if (socket) {
        socket.emit(eventName, eventData);
      }
    });

    cliLogger.info(`Sent ${eventName} to ${accountSockets.length} sockets for account ${accountId}`);
  }

  /**
   * Send cached notifications immediately when user connects
   */
  private sendCachedNotifications(accountId: number, socketId: string): void {
    const cached = this.notificationCache[accountId];

    if (!cached || cached.notifications.length === 0 || !this.io) {
      return;
    }

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('update_notifications', {
        notifications: cached.notifications,
        timestamp: cached.lastChecked.toISOString(),
      });

      cliLogger.info(`Sent cached notifications to newly connected user for account ${accountId}`);
    }
  }

  /**
   * Notifies all connected clients about show updates
   * @param message Optional message to send with the notification
   */
  public notifyShowsUpdate(message: string = 'Show updates made!'): void {
    if (!this.io) return;

    this.io.emit('showsUpdate', { message });
    cliLogger.info('Notified clients about show updates');
  }

  /**
   * Notifies all connected clients about movie updates
   * @param message Optional message to send with the notification
   */
  public notifyMoviesUpdate(message: string = 'Movie updates made!'): void {
    if (!this.io) return;

    this.io.emit('moviesUpdate', { message });
    cliLogger.info('Notified clients about movie updates');
  }

  /**
   * Notifies a specific account that show data has been fully loaded
   * @param profileId ID of the profile that favorited the show
   * @param loadedShow Show data that was loaded
   */
  public async notifyShowDataLoaded(profileId: number, loadedShow: ProfileShow): Promise<void> {
    try {
      if (!this.io) return;

      const account_id = await accountService.findAccountIdByProfileId(profileId);
      if (!account_id) return;

      const sockets = Array.from(this.io.sockets.sockets.values());
      const userSocket = sockets.find((socket) => socket.data.accountId === account_id);

      if (userSocket) {
        userSocket.emit('updateShowFavorite', {
          message: 'Show data has been fully loaded',
          show: loadedShow,
        });
      }
    } catch (error) {
      cliLogger.error('Error notifying show data loaded:', error);
    }
  }

  /**
   * Clear notification cache for an account
   * @param accountId Account ID to clear cache for
   */
  public clearNotificationCache(accountId?: number): void {
    if (accountId) {
      delete this.notificationCache[accountId];
    } else {
      this.notificationCache = {};
    }
  }

  /**
   * Disconnects all sockets associated with a specific account
   * This should be called when a user logs out of the application
   * @param accountId ID of the account to disconnect
   * @returns The number of sockets that were disconnected
   */
  public disconnectUserSockets(accountId: string | number): number {
    if (!this.io) return 0;

    let disconnectCount = 0;
    const sockets = Array.from(this.io.sockets.sockets.values());

    for (const socket of sockets) {
      if (socket.data.accountId == accountId) {
        // Send a logout event to the client before disconnecting
        socket.emit('forceLogout', {
          message: 'You have been logged out from this device',
        });

        this.connectedUsers.delete(socket.id);

        // Disconnect the socket
        socket.disconnect(true);
        disconnectCount++;

        cliLogger.info(`Disconnected socket for account ${accountId} due to logout`);
      }
    }

    // Clear notification cache for this account
    this.clearNotificationCache(parseInt(accountId.toString()));

    return disconnectCount;
  }

  /**
   * Checks if the Socket.IO server is initialized
   * @returns True if the server is initialized, false otherwise
   */
  public isInitialized(): boolean {
    return !!this.io;
  }

  /**
   * Gets the Socket.IO server instance
   * @returns The Socket.IO server instance or null if not initialized
   */
  public getServer(): Server | null {
    return this.io;
  }

  /**
   * Shutdown the service and cleanup resources
   */
  public shutdown(): void {
    this.stopNotificationPolling();
    this.connectedUsers.clear();
    this.clearNotificationCache();
    cliLogger.info('Socket service shutdown complete');
  }
}

// Export singleton instance
export const socketService = SocketService.getInstance();
