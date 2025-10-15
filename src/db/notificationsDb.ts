import { NoAffectedRowsError, NotFoundError } from '../middleware/errorMiddleware';
import { AccountReferenceRow } from '../types/accountTypes';
import { ContentCountRow } from '../types/contentTypes';
import {
  CurrentNotificationRow,
  NotificationRow,
  transformAccountNotificationRow,
  transformAdminNotificationRow,
} from '../types/notificationTypes';
import { getDbPool } from '../utils/db';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { TransactionHelper } from '../utils/transactionHelper';
import {
  AccountNotification,
  AdminNotification,
  CreateNotificationRequest,
  GetAllNotificationsOptions,
  UpdateNotificationRequest,
} from '@ajgifford/keepwatching-types';
import { ResultSetHeader } from 'mysql2';

/**
 * @fileoverview Database access layer for notification management in KeepWatching application.
 * This module provides direct database operations for creating, reading, updating, and deleting
 * notifications, as well as managing notification states for user accounts.
 *
 * @module notificationsDb
 */

/**
 * Retrieves all active notifications for a specific account.
 *
 * This function fetches notifications from the `current_notifications` view, which provides
 * a pre-filtered view of notifications that are currently active (within their date range).
 * The function can optionally include dismissed notifications based on the `includeDismissed` parameter.
 *
 * @async
 * @function getNotificationsForAccount
 * @param {number} accountId - The unique identifier of the account to fetch notifications for
 * @param {boolean} [includeDismissed=false] - Whether to include previously dismissed notifications
 * @returns {Promise<AccountNotification[]>} Promise that resolves to an array of account notifications
 * @throws {Error} Throws database error if the query fails or connection issues occur
 *
 * @example
 * ```typescript
 * // Get active notifications for account 123
 * try {
 *   const notifications = await getNotificationsForAccount(123);
 *   console.log(`Found ${notifications.length} active notifications`);
 *
 *   notifications.forEach(notification => {
 *     console.log(`ID: ${notification.id}, Message: ${notification.message}`);
 *     console.log(`Read: ${notification.read}, Dismissed: ${notification.dismissed}`);
 *   });
 * } catch (error) {
 *   console.error('Failed to fetch notifications:', error);
 * }
 *
 * // Get all notifications including dismissed ones
 * const allNotifications = await getNotificationsForAccount(123, true);
 * ```
 *
 */
export async function getNotificationsForAccount(
  accountId: number,
  includeDismissed: boolean = false,
): Promise<AccountNotification[]> {
  try {
    if (includeDismissed) {
      const query = `SELECT * FROM current_notifications WHERE account_id = ?`;
      const [notifications] = await getDbPool().execute<CurrentNotificationRow[]>(query, [accountId]);
      return notifications.map(transformAccountNotificationRow);
    } else {
      const query = `SELECT * FROM current_notifications WHERE account_id = ? AND dismissed = 0`;
      const [notifications] = await getDbPool().execute<CurrentNotificationRow[]>(query, [accountId]);
      return notifications.map(transformAccountNotificationRow);
    }
  } catch (error) {
    handleDatabaseError(error, 'getting notifications for an account');
  }
}

/**
 * Updates the read status of a specific notification for an account.
 *
 * This function modifies the `account_notifications` junction table to track whether a user
 * has read a particular notification. This is used for UI state management and analytics.
 *
 * @async
 * @function markNotificationRead
 * @param {number} notificationId - The unique identifier of the notification to update
 * @param {number} accountId - The unique identifier of the account
 * @param {boolean} [hasBeenRead=true] - The read status to set (true = read, false = unread)
 * @returns {Promise<boolean>} Promise that resolves to true if the update was successful, false if no rows were affected
 * @throws {Error} Throws database error if the query fails or connection issues occur
 *
 * @example
 * ```typescript
 * // Mark notification 456 as read for account 123
 * try {
 *   const wasUpdated = await markNotificationRead(456, 123, true);
 *   if (wasUpdated) {
 *     console.log('Notification marked as read successfully');
 *   } else {
 *     console.log('Notification not found or already in the requested state');
 *   }
 * } catch (error) {
 *   console.error('Failed to update notification read status:', error);
 * }
 *
 * // Mark notification as unread
 * await markNotificationRead(456, 123, false);
 * ```
 */
export async function markNotificationRead(
  notificationId: number,
  accountId: number,
  hasBeenRead: boolean = true,
): Promise<boolean> {
  try {
    const readValue = hasBeenRead ? 1 : 0;
    const query = `UPDATE account_notifications SET has_been_read = ? WHERE notification_id = ? AND account_id = ?;`;
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [readValue, notificationId, accountId]);

    // Return true if at least one row was affected (notification status was updated)
    return result.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, `marking a notification ${hasBeenRead ? 'read' : 'unread'}`);
  }
}

/**
 * Updates the read status of all notifications for a specific account.
 *
 * This function provides a bulk operation to mark all notifications as read or unread
 * for a particular account. This is useful for "mark all as read" functionality.
 *
 * @async
 * @function markAllNotificationsRead
 * @param {number} accountId - The unique identifier of the account
 * @param {boolean} [hasBeenRead=true] - The read status to set for all notifications
 * @returns {Promise<boolean>} Promise that resolves to true if any notifications were updated, false otherwise
 * @throws {Error} Throws database error if the query fails or connection issues occur
 *
 * @example
 * ```typescript
 * // Mark all notifications as read for account 123
 * try {
 *   const wereUpdated = await markAllNotificationsRead(123, true);
 *   if (wereUpdated) {
 *     console.log('All notifications marked as read');
 *   } else {
 *     console.log('No notifications to update or all already read');
 *   }
 * } catch (error) {
 *   console.error('Failed to mark all notifications as read:', error);
 * }
 *
 * // Mark all notifications as unread (less common use case)
 * await markAllNotificationsRead(123, false);
 * ```
 */
export async function markAllNotificationsRead(accountId: number, hasBeenRead: boolean = true): Promise<boolean> {
  try {
    const readValue = hasBeenRead ? 1 : 0;
    const query = `UPDATE account_notifications SET has_been_read = ? WHERE account_id = ?;`;
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [readValue, accountId]);

    // Return true if at least one row was affected (notifications were updated)
    return result.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, `marking all notifications ${hasBeenRead ? 'read' : 'unread'}`);
  }
}

/**
 * Dismisses a specific notification for an account.
 *
 * Dismissing a notification hides it from the user's notification list in future queries
 * (unless specifically requested). This is different from marking as read - dismissed
 * notifications are typically removed from the UI entirely.
 *
 * @async
 * @function dismissNotification
 * @param {number} notificationId - The unique identifier of the notification to dismiss
 * @param {number} accountId - The unique identifier of the account dismissing the notification
 * @returns {Promise<boolean>} Promise that resolves to true if the notification was dismissed, false if not found
 * @throws {Error} Throws database error if the query fails or connection issues occur
 *
 * @example
 * ```typescript
 * // Dismiss notification 456 for account 123
 * try {
 *   const wasDismissed = await dismissNotification(456, 123);
 *   if (wasDismissed) {
 *     console.log('Notification dismissed successfully');
 *   } else {
 *     console.log('Notification not found or already dismissed');
 *   }
 * } catch (error) {
 *   console.error('Failed to dismiss notification:', error);
 * }
 * ```
 */
export async function dismissNotification(notificationId: number, accountId: number): Promise<boolean> {
  try {
    const query = `UPDATE account_notifications SET dismissed = 1 WHERE notification_id = ? AND account_id = ?;`;
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [notificationId, accountId]);

    // Return true if at least one row was affected (notification was dismissed)
    return result.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'dismissing a notification');
  }
}

/**
 * Dismisses all notifications for a specific account.
 *
 * This function provides a bulk operation to dismiss all notifications for an account.
 * This is useful for "dismiss all" functionality or account cleanup operations.
 *
 * @async
 * @function dismissAllNotifications
 * @param {number} accountId - The unique identifier of the account
 * @returns {Promise<boolean>} Promise that resolves to true if any notifications were dismissed, false otherwise
 * @throws {Error} Throws database error if the query fails or connection issues occur
 *
 * @example
 * ```typescript
 * // Dismiss all notifications for account 123
 * try {
 *   const wereDismissed = await dismissAllNotifications(123);
 *   if (wereDismissed) {
 *     console.log('All notifications dismissed successfully');
 *   } else {
 *     console.log('No notifications to dismiss or all already dismissed');
 *   }
 * } catch (error) {
 *   console.error('Failed to dismiss all notifications:', error);
 * }
 * ```
 */
export async function dismissAllNotifications(accountId: number): Promise<boolean> {
  try {
    const query = `UPDATE account_notifications SET dismissed = 1 WHERE account_id = ?;`;
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [accountId]);

    // Return true if at least one row was affected (notifications were dismissed)
    return result.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'dismissing all notifications');
  }
}

/**
 * Builds WHERE clause conditions and parameters for notification queries.
 *
 * This helper function creates the WHERE clause components based on filter options,
 * ensuring consistency between count and retrieval queries.
 *
 * @private
 * @function buildNotificationWhereClause
 * @param {GetAllNotificationsOptions} options - Filter options
 * @returns {{ conditions: string[], params: (string | number)[] }} Object containing SQL conditions array and parameter values array
 */
function buildNotificationWhereClause(options: GetAllNotificationsOptions): {
  conditions: string[];
  params: (string | number)[];
} {
  const { expired, type, startDate, endDate, sendToAll } = options;
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (!expired) {
    conditions.push('end_date > NOW()');
  }

  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }

  if (startDate) {
    conditions.push('start_date >= ?');
    params.push(formatDateForMySql(startDate));
  }

  if (endDate) {
    conditions.push('end_date <= ?');
    params.push(formatDateForMySql(endDate));
  }

  if (sendToAll !== undefined) {
    conditions.push('send_to_all = ?');
    params.push(sendToAll ? 1 : 0);
  }

  return { conditions, params };
}

/**
 * Retrieves a count of all system notifications matching the specified filters.
 *
 * This function counts notifications based on optional filters for expiration status,
 * type, and date range. It supports the administrative pagination system by providing
 * accurate total counts for the filtered result set.
 *
 * @async
 * @function getNotificationsCount
 * @param {GetAllNotificationsOptions} options - Filter options
 * @param {boolean} options.expired - Whether to include expired notifications (end_date < NOW())
 * @param {string} [options.type] - Filter by notification type (e.g., 'maintenance', 'welcome')
 * @param {string} [options.startDate] - Filter notifications starting on or after this date (ISO string)
 * @param {string} [options.endDate] - Filter notifications ending on or before this date (ISO string)
 * @returns {Promise<number>} Promise that resolves to the total count of notifications matching the filters
 * @throws {Error} Throws database error if the query fails or connection issues occur
 *
 * @example
 * ```typescript
 * // Count all active notifications
 * const count = await getNotificationsCount({ expired: false });
 * console.log(`${count} active notifications`);
 *
 * // Count maintenance notifications in date range
 * const maintenanceCount = await getNotificationsCount({
 *   expired: false,
 *   type: 'maintenance',
 *   startDate: '2025-01-01',
 *   endDate: '2025-12-31'
 * });
 * ```
 */
export async function getNotificationsCount(options: GetAllNotificationsOptions): Promise<number> {
  try {
    const { conditions, params } = buildNotificationWhereClause(options);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT COUNT(*) AS total FROM notifications ${whereClause}`;

    const [result] = await getDbPool().execute<ContentCountRow[]>(query, params);
    return result[0].total;
  } catch (error) {
    handleDatabaseError(error, 'get a count of all notifications');
  }
}

/**
 * Retrieves all system notifications for administrative purposes with filtering and pagination.
 *
 * This function is used by administrators to view and manage system-wide notifications.
 * It supports filtering by type, date range, and expiration status, along with pagination
 * for efficient data retrieval. Results are ordered by start_date in descending order (newest first).
 *
 * @async
 * @function getAllNotifications
 * @param {GetAllNotificationsOptions} options - Query options for filtering
 * @param {boolean} options.expired - Whether to include expired notifications (end_date < NOW())
 * @param {string} [options.type] - Filter by notification type (e.g., 'maintenance', 'welcome')
 * @param {string} [options.startDate] - Filter notifications starting on or after this date (ISO string)
 * @param {string} [options.endDate] - Filter notifications ending on or before this date (ISO string)
 * @param {number} [limit=50] - The maximum number of results to retrieve (default: 50)
 * @param {number} [offset=0] - The offset used to start retrieving results (default: 0, for first page)
 * @returns {Promise<AdminNotification[]>} Promise that resolves to an array of admin notifications ordered by start_date DESC
 * @throws {Error} Throws database error if the query fails or connection issues occur
 *
 * @example
 * ```typescript
 * // Get first page of active notifications (first 10)
 * try {
 *   const notifications = await getAllNotifications({ expired: false }, 10, 0);
 *   console.log(`Found ${notifications.length} notifications`);
 * } catch (error) {
 *   console.error('Failed to fetch admin notifications:', error);
 * }
 *
 * // Filter by type and date range with pagination
 * const filtered = await getAllNotifications(
 *   {
 *     expired: false,
 *     type: 'maintenance',
 *     startDate: '2025-01-01',
 *     endDate: '2025-12-31'
 *   },
 *   20,
 *   0
 * );
 *
 * // Get second page (offset 20)
 * const secondPage = await getAllNotifications({ expired: false }, 20, 20);
 * ```
 */
export async function getAllNotifications(
  options: GetAllNotificationsOptions,
  limit: number = 50,
  offset: number = 0,
): Promise<AdminNotification[]> {
  try {
    const { sortBy = 'startDate', sortOrder = 'desc' } = options;

    const { conditions, params } = buildNotificationWhereClause(options);

    // Map sort field to database column name
    const sortFieldMap: Record<string, string> = {
      startDate: 'start_date',
      endDate: 'end_date',
      type: 'type',
      sendToAll: 'send_to_all',
    };

    const sortColumn = sortFieldMap[sortBy] || 'start_date';
    const sortDirection = sortOrder.toUpperCase();

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM notifications${whereClause} ORDER BY ${sortColumn} ${sortDirection} LIMIT ${limit} OFFSET ${offset}`;

    const [notifications] = await getDbPool().execute<NotificationRow[]>(query, params);
    return notifications.map(transformAdminNotificationRow);
  } catch (error) {
    handleDatabaseError(error, 'getting all notifications');
  }
}

/**
 * Creates a new notification in the system with proper account associations.
 *
 * This function uses a database transaction to ensure data consistency when creating
 * notifications. If the notification is marked to send to all accounts, it will
 * automatically create entries in the account_notifications junction table for
 * all existing accounts. For single-account notifications, it creates a single
 * association entry.
 *
 * @async
 * @function addNotification
 * @param {CreateNotificationRequest} notificationRequest - The notification creation request object
 * @param {string} notificationRequest.title - The title of the notification
 * @param {string} notificationRequest.message - The message content of the notification
 * @param {string} notificationRequest.startDate - The start date for the notification (ISO date string)
 * @param {string} notificationRequest.endDate - The end date for the notification (ISO date string)
 * @param {boolean} notificationRequest.sendToAll - Whether to send to all users or specific account
 * @param {number|null} notificationRequest.accountId - Target account ID (null if sendToAll is true)
 * @param {string} notificationRequest.type - The type/category of the notification
 * @returns {Promise<void>} Promise that resolves when the notification is successfully created
 * @throws {NotFoundError} Throws when no accounts are found for sendToAll notifications
 * @throws {Error} Throws database error if the transaction fails or connection issues occur
 *
 * @example
 * ```typescript
 * // Create a system-wide notification
 * try {
 *   await addNotification({
 *     title: 'System Maintenance',
 *     message: 'Scheduled maintenance tonight from 2-4 AM EST',
 *     startDate: '2025-07-26T00:00:00Z',
 *     endDate: '2025-07-27T06:00:00Z',
 *     sendToAll: true,
 *     accountId: null,
 *     type: 'maintenance'
 *   });
 *   console.log('System notification created successfully');
 * } catch (error) {
 *   console.error('Failed to create notification:', error);
 * }
 *
 * // Create a user-specific notification
 * await addNotification({
 *   title: 'Welcome!',
 *   message: 'Welcome to KeepWatching! Start tracking your favorite shows.',
 *   startDate: '2025-07-26T00:00:00Z',
 *   endDate: '2025-08-26T00:00:00Z',
 *   sendToAll: false,
 *   accountId: 123,
 *   type: 'welcome'
 * });
 * ```
 *
 * @see {@link TransactionHelper} For transaction management details
 */
export async function addNotification(notificationRequest: CreateNotificationRequest): Promise<void> {
  const transactionHelper = new TransactionHelper();
  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      const notificationQuery =
        'INSERT INTO notifications (title, message, start_date, end_date, send_to_all, account_id, type) VALUES (?,?,?,?,?,?,?)';
      const [result] = await connection.execute<ResultSetHeader>(notificationQuery, [
        notificationRequest.title,
        notificationRequest.message,
        formatDateForMySql(notificationRequest.startDate),
        formatDateForMySql(notificationRequest.endDate),
        notificationRequest.sendToAll ? 1 : 0,
        notificationRequest.accountId ?? null,
        notificationRequest.type,
      ]);
      const notificationId = result.insertId;

      if (notificationRequest.sendToAll) {
        const [accounts] = await connection.query<AccountReferenceRow[]>(
          'SELECT account_id, account_name, email FROM accounts',
        );

        if (accounts.length === 0) {
          throw new NotFoundError('No accounts found when sending a notification to all accounts');
        }

        const placeholders = accounts.map(() => '(?,?,?)').join(',');
        const bulkInsertQuery = `INSERT INTO account_notifications (notification_id, account_id, dismissed) VALUES ${placeholders}`;

        const flatValues = accounts.flatMap((account) => [notificationId, account.account_id, false]);

        await connection.execute(bulkInsertQuery, flatValues);
      } else {
        await connection.execute(
          'INSERT INTO account_notifications (notification_id, account_id, dismissed) VALUES (?,?,?)',
          [notificationId, notificationRequest.accountId, false],
        );
      }
    });
  } catch (error) {
    handleDatabaseError(error, 'adding a notification');
  }
}

/**
 * Updates an existing notification with new information.
 *
 * This function modifies an existing notification record in the database.
 * Note that this only updates the notification metadata - it does not
 * modify existing account associations in the junction table.
 *
 * @async
 * @function updateNotification
 * @param {UpdateNotificationRequest} notificationRequest - The notification update request object
 * @param {number} notificationRequest.id - The unique identifier of the notification to update
 * @param {string} notificationRequest.title - The updated title of the notification
 * @param {string} notificationRequest.message - The updated message content
 * @param {string} notificationRequest.startDate - The updated start date (ISO date string)
 * @param {string} notificationRequest.endDate - The updated end date (ISO date string)
 * @param {boolean} notificationRequest.sendToAll - Updated targeting configuration
 * @param {number|null} notificationRequest.accountId - Updated target account ID
 * @param {string} notificationRequest.type - The updated type/category
 * @returns {Promise<void>} Promise that resolves when the notification is successfully updated
 * @throws {NoAffectedRowsError} Throws when no notification is found with the given ID
 * @throws {Error} Throws database error if the query fails or connection issues occur
 *
 * @example
 * ```typescript
 * // Update an existing notification
 * try {
 *   await updateNotification({
 *     id: 456,
 *     title: 'Updated: System Maintenance',
 *     message: 'Maintenance rescheduled to 3-5 AM EST due to technical issues',
 *     startDate: '2025-07-26T00:00:00Z',
 *     endDate: '2025-07-27T06:00:00Z',
 *     sendToAll: true,
 *     accountId: null,
 *     type: 'maintenance'
 *   });
 *   console.log('Notification updated successfully');
 * } catch (NoAffectedRowsError) {
 *   console.error('Notification not found');
 * } catch (error) {
 *   console.error('Failed to update notification:', error);
 * }
 * ```
 */
export async function updateNotification(notificationRequest: UpdateNotificationRequest): Promise<void> {
  try {
    const [result] = await getDbPool().execute<ResultSetHeader>(
      'UPDATE notifications SET title = ?, message = ?, start_date = ?, end_date = ?, type = ?, send_to_all = ?, account_id = ? WHERE notification_id = ?',
      [
        notificationRequest.title,
        notificationRequest.message,
        formatDateForMySql(notificationRequest.startDate),
        formatDateForMySql(notificationRequest.endDate),
        notificationRequest.type,
        notificationRequest.sendToAll ? 1 : 0,
        notificationRequest.accountId,
        notificationRequest.id,
      ],
    );

    if (result.affectedRows === 0) {
      throw new NoAffectedRowsError(`No notification found with ID ${notificationRequest.id}`);
    }
  } catch (error) {
    handleDatabaseError(error, 'updating a notification');
  }
}

/**
 * Permanently deletes a notification from the system.
 *
 * This function removes a notification record from the database. Due to foreign key
 * constraints, this will also cascade delete all associated entries in the
 * account_notifications junction table.
 *
 * @async
 * @function deleteNotification
 * @param {number} notification_id - The unique identifier of the notification to delete
 * @returns {Promise<void>} Promise that resolves when the notification is successfully deleted
 * @throws {NoAffectedRowsError} Throws when no notification is found with the given ID
 * @throws {Error} Throws database error if the query fails or connection issues occur
 *
 * @example
 * ```typescript
 * // Delete notification with ID 456
 * try {
 *   await deleteNotification(456);
 *   console.log('Notification deleted successfully');
 * } catch (NoAffectedRowsError) {
 *   console.error('Notification not found');
 * } catch (error) {
 *   console.error('Failed to delete notification:', error);
 * }
 * ```
 *
 * @warning This operation is irreversible and will cascade delete all user associations
 */
export async function deleteNotification(notification_id: number): Promise<void> {
  try {
    const [result] = await getDbPool().execute<ResultSetHeader>('DELETE FROM notifications WHERE notification_id = ?', [
      notification_id,
    ]);

    if (result.affectedRows === 0) {
      throw new NoAffectedRowsError(`No notification found with ID ${notification_id}`);
    }
  } catch (error) {
    handleDatabaseError(error, 'deleting a notification');
  }
}

/**
 * Formats a date string for MySQL datetime storage.
 *
 * This utility function converts JavaScript date strings into the format
 * expected by MySQL DATETIME columns (YYYY-MM-DD HH:MM:SS).
 *
 * @private
 * @function formatDateForMySql
 * @param {string} dateString - ISO date string or other valid date format
 * @returns {string} MySQL-formatted datetime string (YYYY-MM-DD HH:MM:SS)
 *
 * @example
 * ```typescript
 * const mysqlDate = formatDateForMySql('2025-07-26T14:30:00Z');
 * // Returns: '2025-07-26 14:30:00'
 *
 * const mysqlDate2 = formatDateForMySql('2025-07-26');
 * // Returns: '2025-07-26 00:00:00'
 * ```
 *
 */
function formatDateForMySql(dateString: string): string {
  const date = new Date(dateString);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}
