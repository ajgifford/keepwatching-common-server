import { DatabaseError, NoAffectedRowsError, NotFoundError } from '../middleware/errorMiddleware';
import { getDbPool } from '../utils/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface AccountNotification {
  notification_id: number;
  message: string;
  start_date: Date;
  end_date: Date;
}

export interface AdminNotification {
  notification_id?: number;
  message: string;
  start_date: string;
  end_date: string;
  send_to_all: boolean;
  account_id: number | null;
}

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

export async function saveNotification(notification: AdminNotification) {
  const connection = await getDbPool().getConnection();
  try {
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

      await connection.execute('INSERT INTO account_notifications (notification_id, account_id, dismissed) VALUES ?', [
        values,
      ]);
    } else {
      await connection.execute(
        'INSERT INTO account_notifications (notification_id, account_id, dismissed) VALUES (?,?,?)',
        [notificationId, notification.account_id, false],
      );
    }

    await connection.commit();
  } catch (error) {
    connection.rollback();
    throw new DatabaseError('', error);
  } finally {
    connection.release();
  }
}

export async function update(notification: AdminNotification) {
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
    if (error instanceof NoAffectedRowsError) {
      throw error;
    }
    throw new DatabaseError('Database error while updating a notification', error);
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
    throw new DatabaseError('Database error when retrieving all notifications', error);
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
    if (error instanceof NoAffectedRowsError) {
      throw error;
    }
    throw new DatabaseError('Database error while deleting a notification', error);
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
