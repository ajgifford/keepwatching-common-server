import * as notificationsDb from '../db/notificationsDb';
import { NoAffectedRowsError } from '../middleware/errorMiddleware';
import { errorService } from './errorService';
import {
  AccountNotification,
  AdminNotification,
  CreateNotificationRequest,
  UpdateNotificationRequest,
} from '@ajgifford/keepwatching-types';

/**
 * Service class for managing notifications within the KeepWatching application.
 * Provides comprehensive notification management including reading, marking read, dismissing,
 * and administrative operations for both user-specific and system-wide notifications.
 *
 * @class NotificationsService
 */
export class NotificationsService {
  /**
   * Retrieves all notifications for a specific account.
   *
   * @async
   * @method getNotifications
   * @param {number} accountId - The unique identifier of the account
   * @param {boolean} [includeDismissed=false] - Whether to include dismissed notifications in the results
   * @returns {Promise<AccountNotification[]>} Promise that resolves to an array of account notifications
   * @throws {Error} Throws error if database operation fails or account ID is invalid
   *
   * @example
   * ```typescript
   * // Get active notifications for account 123
   * const notifications = await notificationsService.getNotifications(123);
   *
   * // Get all notifications including dismissed ones
   * const allNotifications = await notificationsService.getNotifications(123, true);
   * ```
   */
  public async getNotifications(accountId: number, includeDismissed: boolean = false): Promise<AccountNotification[]> {
    try {
      return await notificationsDb.getNotificationsForAccount(accountId, includeDismissed);
    } catch (error) {
      throw errorService.handleError(error, `getNotifications(${accountId}, ${includeDismissed})`);
    }
  }

  /**
   * Marks a specific notification as read or unread for an account and returns updated notifications.
   *
   * @async
   * @method markNotificationRead
   * @param {number} notificationId - The unique identifier of the notification to mark
   * @param {number} accountId - The unique identifier of the account that owns the notification
   * @param {boolean} [hasBeenRead=true] - Whether to mark the notification as read (true) or unread (false)
   * @param {boolean} [includeDismissed=false] - Whether to include dismissed notifications in the returned results
   * @returns {Promise<AccountNotification[]>} Promise that resolves to updated array of account notifications
   * @throws {NoAffectedRowsError} Throws when no notification was found to update
   * @throws {Error} Throws error if database operation fails
   *
   * @example
   * ```typescript
   * // Mark notification 456 as read for account 123
   * const updatedNotifications = await notificationsService.markNotificationRead(456, 123);
   *
   * // Mark notification as unread
   * const notifications = await notificationsService.markNotificationRead(456, 123, false);
   * ```
   */
  public async markNotificationRead(
    notificationId: number,
    accountId: number,
    hasBeenRead: boolean = true,
    includeDismissed: boolean = false,
  ): Promise<AccountNotification[]> {
    try {
      const updated = await notificationsDb.markNotificationRead(notificationId, accountId, hasBeenRead);
      if (!updated) {
        throw new NoAffectedRowsError(`No notification was marked ${hasBeenRead ? 'read' : 'unread'}`);
      }
      return await notificationsDb.getNotificationsForAccount(accountId, includeDismissed);
    } catch (error) {
      throw errorService.handleError(
        error,
        `markNotificationRead(${notificationId}, ${accountId}, ${hasBeenRead}, ${includeDismissed})`,
      );
    }
  }

  /**
   * Marks all notifications for an account as read or unread and returns the updated notification list.
   *
   * @async
   * @method markAllNotificationsRead
   * @param {number} accountId - The unique identifier of the account
   * @param {boolean} [hasBeenRead=true] - Whether to mark all notifications as read (true) or unread (false)
   * @param {boolean} [includeDismissed=false] - Whether to include dismissed notifications in the returned results
   * @returns {Promise<AccountNotification[]>} Promise that resolves to updated array of account notifications
   * @throws {NoAffectedRowsError} Throws when no notifications were found to update
   * @throws {Error} Throws error if database operation fails
   *
   * @example
   * ```typescript
   * // Mark all notifications as read for account 123
   * const notifications = await notificationsService.markAllNotificationsRead(123);
   *
   * // Mark all notifications as unread
   * const notifications = await notificationsService.markAllNotificationsRead(123, false);
   * ```
   */
  public async markAllNotificationsRead(
    accountId: number,
    hasBeenRead: boolean = true,
    includeDismissed: boolean = false,
  ): Promise<AccountNotification[]> {
    try {
      const updated = await notificationsDb.markAllNotificationsRead(accountId, hasBeenRead);
      if (!updated) {
        throw new NoAffectedRowsError(`No notifications were marked ${hasBeenRead ? 'read' : 'unread'}`);
      }
      return await notificationsDb.getNotificationsForAccount(accountId, includeDismissed);
    } catch (error) {
      throw errorService.handleError(
        error,
        `markAllNotificationsRead(${accountId}, ${hasBeenRead}, ${includeDismissed})`,
      );
    }
  }

  /**
   * Dismisses a specific notification for an account, effectively hiding it from future queries
   * unless explicitly requested. Returns the updated list of notifications.
   *
   * @async
   * @method dismissNotification
   * @param {number} notificationId - The unique identifier of the notification to dismiss
   * @param {number} accountId - The unique identifier of the account that owns the notification
   * @param {boolean} [includeDismissed=false] - Whether to include dismissed notifications in the returned results
   * @returns {Promise<AccountNotification[]>} Promise that resolves to updated array of account notifications
   * @throws {NoAffectedRowsError} Throws when no notification was found to dismiss
   * @throws {Error} Throws error if database operation fails
   *
   * @example
   * ```typescript
   * // Dismiss notification 456 for account 123
   * const remainingNotifications = await notificationsService.dismissNotification(456, 123);
   * ```
   */
  public async dismissNotification(
    notificationId: number,
    accountId: number,
    includeDismissed: boolean = false,
  ): Promise<AccountNotification[]> {
    try {
      const notificationDismissed = await notificationsDb.dismissNotification(notificationId, accountId);
      if (!notificationDismissed) {
        throw new NoAffectedRowsError('No notification was dismissed');
      }
      return await notificationsDb.getNotificationsForAccount(accountId, includeDismissed);
    } catch (error) {
      throw errorService.handleError(
        error,
        `dismissNotification(${notificationId}, ${accountId}, ${includeDismissed})`,
      );
    }
  }

  /**
   * Dismisses all notifications for an account and returns the updated notification list.
   *
   * @async
   * @method dismissAllNotifications
   * @param {number} accountId - The unique identifier of the account
   * @param {boolean} [includeDismissed=false] - Whether to include dismissed notifications in the returned results
   * @returns {Promise<AccountNotification[]>} Promise that resolves to updated array of account notifications
   * @throws {NoAffectedRowsError} Throws when no notifications were found to dismiss
   * @throws {Error} Throws error if database operation fails
   *
   * @example
   * ```typescript
   * // Dismiss all notifications for account 123
   * const notifications = await notificationsService.dismissAllNotifications(123);
   * ```
   */
  public async dismissAllNotifications(
    accountId: number,
    includeDismissed: boolean = false,
  ): Promise<AccountNotification[]> {
    try {
      const notificationsDismissed = await notificationsDb.dismissAllNotifications(accountId);
      if (!notificationsDismissed) {
        throw new NoAffectedRowsError('No notifications were dismissed');
      }
      return await notificationsDb.getNotificationsForAccount(accountId, includeDismissed);
    } catch (error) {
      throw errorService.handleError(error, `dismissAllNotifications(${accountId}, ${includeDismissed})`);
    }
  }

  /**
   * Retrieves all system notifications for administrative purposes.
   * This method is typically used by administrators to view and manage system-wide notifications.
   *
   * @async
   * @method getAllNotifications
   * @param {boolean} expired - Whether to include expired notifications in the results
   * @returns {Promise<AdminNotification[]>} Promise that resolves to an array of admin notifications
   * @throws {Error} Throws error if database operation fails
   *
   * @example
   * ```typescript
   * // Get all active notifications for admin panel
   * const activeNotifications = await notificationsService.getAllNotifications(false);
   *
   * // Get all notifications including expired ones
   * const allNotifications = await notificationsService.getAllNotifications(true);
   * ```
   */
  public async getAllNotifications(expired: boolean): Promise<AdminNotification[]> {
    try {
      return await notificationsDb.getAllNotifications(expired);
    } catch (error) {
      throw errorService.handleError(error, `getAllNotifications(${expired})`);
    }
  }

  /**
   * Creates a new notification in the system. The notification can be targeted to all users
   * or a specific account depending on the request configuration.
   *
   * @async
   * @method addNotification
   * @param {CreateNotificationRequest} createNotificationRequest - The notification creation request object
   * @param {string} createNotificationRequest.title - The title of the notification
   * @param {string} createNotificationRequest.message - The message content of the notification
   * @param {string} createNotificationRequest.startDate - The start date for the notification (ISO date string)
   * @param {string} createNotificationRequest.endDate - The end date for the notification (ISO date string)
   * @param {boolean} createNotificationRequest.sendToAll - Whether to send to all users or specific account
   * @param {number|null} createNotificationRequest.accountId - Target account ID (null if sendToAll is true)
   * @param {string} createNotificationRequest.type - The type/category of the notification
   * @returns {Promise<void>} Promise that resolves when the notification is successfully created
   * @throws {Error} Throws error if database operation fails or validation errors occur
   *
   * @example
   * ```typescript
   * // Create a system-wide notification
   * await notificationsService.addNotification({
   *   title: 'System Maintenance',
   *   message: 'Scheduled maintenance tonight from 2-4 AM',
   *   startDate: '2025-07-26',
   *   endDate: '2025-07-27',
   *   sendToAll: true,
   *   accountId: null,
   *   type: 'maintenance'
   * });
   *
   * // Create a user-specific notification
   * await notificationsService.addNotification({
   *   title: 'Welcome!',
   *   message: 'Welcome to KeepWatching!',
   *   startDate: '2025-07-26',
   *   endDate: '2025-08-26',
   *   sendToAll: false,
   *   accountId: 123,
   *   type: 'welcome'
   * });
   * ```
   */
  public async addNotification(createNotificationRequest: CreateNotificationRequest): Promise<void> {
    try {
      await notificationsDb.addNotification(createNotificationRequest);
    } catch (error) {
      throw errorService.handleError(error, `addNotification(${JSON.stringify(createNotificationRequest)})`);
    }
  }

  /**
   * Updates an existing notification with new information. All fields from the original
   * notification can be modified through this method.
   *
   * @async
   * @method updateNotification
   * @param {UpdateNotificationRequest} updateNotificationRequest - The notification update request object
   * @param {number} updateNotificationRequest.id - The unique identifier of the notification to update
   * @param {string} updateNotificationRequest.title - The updated title of the notification
   * @param {string} updateNotificationRequest.message - The updated message content
   * @param {string} updateNotificationRequest.startDate - The updated start date (ISO date string)
   * @param {string} updateNotificationRequest.endDate - The updated end date (ISO date string)
   * @param {boolean} updateNotificationRequest.sendToAll - Updated targeting configuration
   * @param {number|null} updateNotificationRequest.accountId - Updated target account ID
   * @param {string} updateNotificationRequest.type - The updated type/category
   * @returns {Promise<void>} Promise that resolves when the notification is successfully updated
   * @throws {Error} Throws error if database operation fails or notification doesn't exist
   *
   * @example
   * ```typescript
   * // Update an existing notification
   * await notificationsService.updateNotification({
   *   id: 456,
   *   title: 'Updated: System Maintenance',
   *   message: 'Maintenance rescheduled to 3-5 AM',
   *   startDate: '2025-07-26',
   *   endDate: '2025-07-27',
   *   sendToAll: true,
   *   accountId: null,
   *   type: 'maintenance'
   * });
   * ```
   */
  public async updateNotification(updateNotificationRequest: UpdateNotificationRequest): Promise<void> {
    try {
      await notificationsDb.updateNotification(updateNotificationRequest);
    } catch (error) {
      throw errorService.handleError(error, `updateNotification(${JSON.stringify(updateNotificationRequest)})`);
    }
  }

  /**
   * Permanently deletes a notification from the system. This action cannot be undone.
   *
   * @async
   * @method deleteNotification
   * @param {number} notificationId - The unique identifier of the notification to delete
   * @returns {Promise<void>} Promise that resolves when the notification is successfully deleted
   * @throws {Error} Throws error if database operation fails or notification doesn't exist
   *
   * @example
   * ```typescript
   * // Delete notification with ID 456
   * await notificationsService.deleteNotification(456);
   * ```
   */
  public async deleteNotification(notificationId: number): Promise<void> {
    try {
      await notificationsDb.deleteNotification(notificationId);
    } catch (error) {
      throw errorService.handleError(error, `deleteNotification(${notificationId})`);
    }
  }
}

/**
 * Singleton instance of the NotificationsService.
 * This is the primary export used throughout the application for notification management.
 *
 * @type {NotificationsService}
 * @example
 * ```typescript
 * import { notificationsService } from './services/notificationsService';
 *
 * // Use the service
 * const notifications = await notificationsService.getNotifications(123);
 * ```
 */
export const notificationsService = new NotificationsService();
