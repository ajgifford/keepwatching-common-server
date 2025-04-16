import * as accountsDb from '../db/accountsDb';
import { cliLogger } from '../logger/logger';
import { ProfileShow } from '../types/showTypes';
import { Server, Socket } from 'socket.io';

/**
 * Service for managing WebSocket connections and notifications
 * Provides methods for setup, connection handling, and sending notifications
 */
export class SocketService {
  private static instance: SocketService | null = null;
  private io: Server | null = null;

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
   * Initializes the Socket.IO server
   * @param io Socket.IO server instance
   */
  public initialize(io: Server): void {
    this.io = io;
    this.setupConnectionHandlers();
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

        // The actual authentication happens in the index.ts file using Firebase
        // We're just applying the structure here
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
    cliLogger.info(`Client connected: ${socket.data.email} - ${socket.data.userId}`);

    socket.on('disconnect', () => {
      cliLogger.info(`Client disconnected: ${socket.data.email} - ${socket.data.userId}`);
    });
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
   * @param showId ID of the show that was loaded
   * @param loadedShow Show data that was loaded
   */
  public async notifyShowDataLoaded(profileId: string, showId: number, loadedShow: ProfileShow): Promise<void> {
    try {
      if (!this.io) return;

      const account_id = await accountsDb.findAccountIdByProfileId(profileId);
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

        // Disconnect the socket
        socket.disconnect(true);
        disconnectCount++;

        cliLogger.info(`Disconnected socket for account ${accountId} due to logout`);
      }
    }

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
}

// Export singleton instance
export const socketService = SocketService.getInstance();
