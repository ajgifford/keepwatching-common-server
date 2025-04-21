import { NoAffectedRowsError, NotFoundError } from '../middleware/errorMiddleware';
import { AccountNotification, AdminNotification } from '../types/notificationTypes';
import { getDbPool } from '../utils/db';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { TransactionHelper } from '../utils/transactionHelper';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface NotificationRow extends RowDataPacket {
  notification_id: number;
  message: string;
  start_date: Date;
  end_date: Date;
  send_to_all: number;
  account_id: number | null;
}

interface AccountRow extends RowDataPacket {
  account_id: number;
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
export async function getNotificationsForAccount(accountId: number): Promise<AccountNotification[]> {
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
    handleDatabaseError(error, 'getting notifications for an account');
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
    handleDatabaseError(error, 'dismissing a notification');
  }
}

export async function addNotification(notification: AdminNotification) {
  const transactionHelper = new TransactionHelper();
  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      const notificationQuery =
        'INSERT INTO notifications (message, start_date, end_date, send_to_all, account_id) VALUES (?,?,?,?,?)';
      const [result] = await connection.execute<ResultSetHeader>(notificationQuery, [
        notification.message,
        notification.start_date,
        notification.end_date,
        notification.send_to_all,
        notification.account_id,
      ]);
      const notificationId = result.insertId;

      if (notification.send_to_all) {
        const [accounts] = await connection.query<AccountRow[]>('SELECT account_id FROM accounts');

        if (accounts.length === 0) {
          throw new NotFoundError('No accounts found when sending a notification to all accounts');
        }

        const values = accounts.map((account) => [notificationId, account.account_id, false]);
        await connection.execute(
          'INSERT INTO account_notifications (notification_id, account_id, dismissed) VALUES ?',
          [values],
        );
      } else {
        await connection.execute(
          'INSERT INTO account_notifications (notification_id, account_id, dismissed) VALUES (?,?,?)',
          [notificationId, notification.account_id, false],
        );
      }
    });
  } catch (error) {
    handleDatabaseError(error, 'adding a notification');
  }
}

export async function updateNotification(notification: AdminNotification) {
  try {
    const [result] = await getDbPool().execute<ResultSetHeader>(
      'UPDATE notifications SET message = ?, start_date = ?, end_date = ?, send_to_all = ?, account_id = ? WHERE notification_id = ?',
      [
        notification.message,
        notification.start_date,
        notification.end_date,
        notification.send_to_all,
        notification.account_id,
        notification.notification_id,
      ],
    );

    if (result.affectedRows === 0) {
      throw new NoAffectedRowsError(`No notification found with ID ${notification.notification_id}`);
    }

    return notification;
  } catch (error) {
    handleDatabaseError(error, 'updating a notification');
  }
}

export async function getAllNotifications(expired: boolean): Promise<AdminNotification[]> {
  try {
    const query = expired
      ? 'SELECT * FROM notifications'
      : 'SELECT * FROM notifications WHERE NOW() BETWEEN start_date AND end_date';

    const [notifications] = await getDbPool().execute<NotificationRow[]>(query);
    return notifications.map(transformRow);
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

export function createAdminNotification(
  message: string,
  start_date: string,
  end_date: string,
  send_to_all: boolean,
  account_id: number | null,
  notification_id?: number,
): AdminNotification {
  return { message, start_date, end_date, send_to_all, account_id, notification_id };
}

function transformRow(row: RowDataPacket): AdminNotification {
  if (!row) {
    throw new Error('Cannot transform undefined or null row');
  }

  return {
    message: row.message,
    start_date: row.start_date,
    end_date: row.end_date,
    send_to_all: Boolean(row.send_to_all),
    account_id: row.account_id,
    notification_id: row.notification_id,
  };
}
