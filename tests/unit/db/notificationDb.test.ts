import * as notificationsDb from '@db/notificationsDb';
import { getDbPool } from '@utils/db';
import { ResultSetHeader } from 'mysql2';

jest.mock('@utils/db', () => {
  const mockPool = {
    execute: jest.fn(),
  };
  return {
    getDbPool: jest.fn(() => mockPool),
  };
});

describe('notificationDb', () => {
  let mockPool: any;

  beforeEach(() => {
    mockPool = getDbPool();
    mockPool.execute.mockReset();
  });

  describe('getNotificationsForAccount()', () => {
    test('get three notifications for account 1', async () => {
      const mockRows = [
        { notification_id: 1, message: 'Test 1', start_date: new Date(), end_date: new Date() },
        { notification_id: 2, message: 'Test 2', start_date: new Date(), end_date: new Date() },
        { notification_id: 3, message: 'Test 3', start_date: new Date(), end_date: new Date() },
      ];
      mockPool.execute.mockResolvedValue([mockRows]);

      const notifications = await notificationsDb.getNotificationsForAccount(1);
      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT n.notification_id, n.message, n.start_date, n.end_date FROM notifications n JOIN account_notifications an ON n.notification_id = an.notification_id WHERE an.account_id = ? AND an.dismissed = 0 AND NOW() BETWEEN n.start_date AND n.end_date;',
        [1],
      );
      expect(notifications).toHaveLength(3);
      expect(notifications).toEqual(mockRows);
    });

    test('get no notifications for account 2', async () => {
      mockPool.execute.mockResolvedValue([[]]);

      const notifications = await notificationsDb.getNotificationsForAccount(2);
      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT n.notification_id, n.message, n.start_date, n.end_date FROM notifications n JOIN account_notifications an ON n.notification_id = an.notification_id WHERE an.account_id = ? AND an.dismissed = 0 AND NOW() BETWEEN n.start_date AND n.end_date;',
        [2],
      );
      expect(notifications).toHaveLength(0);
      expect(notifications).toEqual([]);
    });

    test('should throw error when getting notifications fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      await expect(notificationsDb.getNotificationsForAccount(1)).rejects.toThrow('DB connection failed');
    });

    test('should throw error with default message when getting notifications fails', async () => {
      mockPool.execute.mockRejectedValue({});

      await expect(notificationsDb.getNotificationsForAccount(1)).rejects.toThrow(
        'Unknown database error getting account notifications',
      );
    });
  });

  describe('dismissNotification()', () => {
    test('notification dismissed', async () => {
      mockPool.execute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      const updated = await notificationsDb.dismissNotification(1, 1);

      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE account_notifications SET dismissed = 1 WHERE notification_id = ? AND account_id = ?;',
        [1, 1],
      );
      expect(updated).toBe(true);
    });

    test('notification not dismissed', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      const updated = await notificationsDb.dismissNotification(2, 1);
      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE account_notifications SET dismissed = 1 WHERE notification_id = ? AND account_id = ?;',
        [2, 1],
      );
      expect(updated).toBe(false);
    });

    test('should throw error when dismissing a notification fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      await expect(notificationsDb.dismissNotification(1, 1)).rejects.toThrow('DB connection failed');
    });

    test('should throw error with default message dismissing a notification fails', async () => {
      mockPool.execute.mockRejectedValue({});

      await expect(notificationsDb.dismissNotification(1, 1)).rejects.toThrow(
        'Unknown database error dismissing a notification',
      );
    });
  });
});
