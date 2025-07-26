import { NoAffectedRowsError, NotFoundError } from '../middleware/errorMiddleware';
import { AccountReferenceRow } from '../types/accountTypes';
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
  UpdateNotificationRequest,
} from '@ajgifford/keepwatching-types';
import { ResultSetHeader } from 'mysql2';

/**
 * Retrieves all active notifications for a specific account
 *
 * This method fetches all current, non-dismissed notifications that are within
 * their active date range (between start_date and end_date) for a specific account.
 *
 * @param accountId - The account ID to fetch notifications for
 * @param includeDismissed - Flag indicating if dismissed notifications should also be retrieved, default false
 * @returns Array of active notifications for the account
 * @throws {DatabaseError} If a database error occurs during the operation
 *
 * @example
 * try {
 *   // Get all active notifications for account ID 123
 *   const notifications = await notificationDb.getNotificationsForAccount(123);
 *
 *   console.log(`Found ${notifications.length} active notifications:`);
 *   notifications.forEach(notification => {
 *     console.log(`- ID ${notification.notification_id}: ${notification.message}`);
 *     console.log(`  Active from ${notification.start_date} to ${notification.end_date}`);
 *   });
 * } catch (error) {
 *   console.error('Error fetching notifications:', error);
 * }
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
 * Marks a notification read/unread status for a specific account
 *
 * This method updates the account_notifications junction table to mark a notification
 * as read or unread for a particular account.
 *
 * @param notificationId - ID of the notification to update
 * @param accountId - ID of the account
 * @param hasBeenRead - Boolean indicating read status (true = read, false = unread)
 * @returns `True` if the notification status was successfully updated, `false` otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 *
 * @example
 * try {
 *   // Mark notification ID 456 as read for account ID 123
 *   const updated = await notificationDb.markNotificationRead(456, 123, true);
 *
 *   // Mark notification ID 456 as unread for account ID 123
 *   const updated = await notificationDb.markNotificationRead(456, 123, false);
 *
 *   if (updated) {
 *     console.log('Notification status updated successfully');
 *   } else {
 *     console.log('Notification not found');
 *   }
 * } catch (error) {
 *   console.error('Error updating notification status:', error);
 * }
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
 * Marks all notifications read/unread status for a specific account
 *
 * This method updates the account_notifications junction table to mark all notifications
 * as read or unread for a particular account.
 *
 * @param accountId - ID of the account that is updating the notifications
 * @param hasBeenRead - Boolean indicating read status (true = read, false = unread)
 * @returns `True` if the notifications were successfully updated, `false` otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 *
 * @example
 * try {
 *   // Mark all notifications as read for account ID 123
 *   const updated = await notificationDb.markAllNotificationsRead(123, true);
 *
 *   // Mark all notifications as unread for account ID 123
 *   const updated = await notificationDb.markAllNotificationsRead(123, false);
 *
 *   if (updated) {
 *     console.log('All notifications status updated successfully');
 *   } else {
 *     console.log('No notifications to update');
 *   }
 * } catch (error) {
 *   console.error('Error updating all notifications status:', error);
 * }
 */
export async function markAllNotificationsRead(accountId: number, hasBeenRead: boolean = true): Promise<boolean> {
  try {
    const readValue = hasBeenRead ? 1 : 0;
    const query = `UPDATE account_notifications SET has_bean_read = ? WHERE account_id = ?;`;
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [readValue, accountId]);

    // Return true if at least one row was affected (notifications were updated)
    return result.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, `marking all notifications ${hasBeenRead ? 'read' : 'unread'}`);
  }
}

/**
 * Marks a notification as dismissed for a specific account
 *
 * This method updates the account_notifications junction table to mark a notification
 * as dismissed for a particular account, preventing it from being shown again to that user.
 *
 * @param notificationId - ID of the notification to dismiss
 * @param accountId - ID of the account that is dismissing the notification
 * @returns `True` if the notification was successfully dismissed, `false` otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 *
 * @example
 * try {
 *   // Dismiss notification ID 456 for account ID 123
 *   const dismissed = await notificationDb.dismissNotification(456, 123);
 *
 *   if (dismissed) {
 *     console.log('Notification dismissed successfully');
 *   } else {
 *     console.log('Notification not found or already dismissed');
 *   }
 * } catch (error) {
 *   console.error('Error dismissing notification:', error);
 * }
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
 * Marks all notifications as dismissed for a specific account
 *
 * This method updates the account_notifications junction table to mark all notifications
 * as dismissed for a particular account, preventing them from being shown again to that user.
 *
 * @param accountId - ID of the account that is dismissing the notifications
 * @returns `True` if the notifications were successfully dismissed, `false` otherwise
 * @throws {DatabaseError} If a database error occurs during the operation
 *
 * @example
 * try {
 *   // Dismiss all notifications for account ID 123
 *   const dismissed = await notificationDb.dismissAllNotifications(123);
 *
 *   if (dismissed) {
 *     console.log('Notifications dismissed successfully');
 *   } else {
 *     console.log('Notifications not dismissed');
 *   }
 * } catch (error) {
 *   console.error('Error dismissing notifications:', error);
 * }
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

export async function addNotification(notificationRequest: CreateNotificationRequest): Promise<void> {
  const transactionHelper = new TransactionHelper();
  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      const notificationQuery =
        'INSERT INTO notifications (message, start_date, end_date, send_to_all, account_id, type) VALUES (?,?,?,?,?,?)';
      const [result] = await connection.execute<ResultSetHeader>(notificationQuery, [
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

export async function updateNotification(notificationRequest: UpdateNotificationRequest): Promise<void> {
  try {
    const [result] = await getDbPool().execute<ResultSetHeader>(
      'UPDATE notifications SET message = ?, start_date = ?, end_date = ?, type = ?, send_to_all = ?, account_id = ? WHERE notification_id = ?',
      [
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

export async function getAllNotifications(expired: boolean): Promise<AdminNotification[]> {
  try {
    const query = expired
      ? 'SELECT * FROM notifications ORDER BY start_date ASC'
      : 'SELECT * FROM notifications WHERE end_date > NOW() ORDER BY start_date ASC';

    const [notifications] = await getDbPool().execute<NotificationRow[]>(query);
    return notifications.map(transformAdminNotificationRow);
  } catch (error) {
    handleDatabaseError(error, 'getting all notifications');
  }
}

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

function formatDateForMySql(dateString: string): string {
  const date = new Date(dateString);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}
