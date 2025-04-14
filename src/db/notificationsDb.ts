import { DatabaseError } from '../middleware/errorMiddleware';
import { getDbPool } from '../utils/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Notification {
  notification_id: number;
  message: string;
  start_date: Date;
  end_date: Date;
}

/**
 * Retrieves all active notifications for a specific account
 *
 * This method fetches all current, non-dismissed notifications that are within
 * their active date range (between start_date and end_date) for a specific account.
 *
 * @param accountId - The account ID to fetch notifications for
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
export async function getNotificationsForAccount(accountId: number): Promise<Notification[]> {
  try {
    const query = `SELECT n.notification_id, n.message, n.start_date, n.end_date FROM notifications n JOIN account_notifications an ON n.notification_id = an.notification_id WHERE an.account_id = ? AND an.dismissed = 0 AND NOW() BETWEEN n.start_date AND n.end_date;`;
    const [rows] = await getDbPool().execute<RowDataPacket[]>(query, [accountId]);

    return rows.map((row) => {
      return {
        notification_id: row.notification_id,
        message: row.message,
        start_date: row.start_date,
        end_date: row.end_date,
      };
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error getting account notifications';
    throw new DatabaseError(errorMessage, error);
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
export async function dismissNotification(notificationId: number, accountId: number) {
  try {
    const query = `UPDATE account_notifications SET dismissed = 1 WHERE notification_id = ? AND account_id = ?;`;
    const [result] = await getDbPool().execute<ResultSetHeader>(query, [notificationId, accountId]);

    // Return true if at least one row was affected (notification was dismissed)
    return result.affectedRows > 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error dismissing a notification';
    throw new DatabaseError(errorMessage, error);
  }
}
