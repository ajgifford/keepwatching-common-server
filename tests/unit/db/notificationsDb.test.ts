import { NotificationRow } from '../../../src/types/notificationTypes';
import { CreateNotificationRequest, UpdateNotificationRequest } from '@ajgifford/keepwatching-types';
import * as notificationsDb from '@db/notificationsDb';
import { getDbPool } from '@utils/db';
import { TransactionHelper } from '@utils/transactionHelper';
import { ResultSetHeader } from 'mysql2';

jest.mock('@utils/db', () => {
  const mockConnection = {
    execute: jest.fn(),
    query: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
  };

  const mockPool = {
    execute: jest.fn(),
    getConnection: jest.fn().mockResolvedValue(mockConnection),
  };

  return {
    getDbPool: jest.fn(() => mockPool),
  };
});
jest.mock('@utils/transactionHelper');

describe('notificationDb', () => {
  let mockPool: any;
  let mockConnection: any;

  beforeEach(() => {
    mockPool = getDbPool();
    mockPool.execute.mockReset();

    mockConnection = {
      execute: jest.fn(),
      query: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    mockPool.getConnection.mockResolvedValue(mockConnection);
  });

  describe('getNotificationsForAccount()', () => {
    it('should get three notifications for account 1', async () => {
      const date = new Date();
      const dbNotifications = [
        { notification_id: 1, message: 'Test 1', start_date: date, end_date: date },
        { notification_id: 2, message: 'Test 2', start_date: date, end_date: date },
        { notification_id: 3, message: 'Test 3', start_date: date, end_date: date },
      ];
      mockPool.execute.mockResolvedValue([dbNotifications]);

      const expectedNotifications = [
        { id: 1, message: 'Test 1', startDate: date, endDate: date },
        { id: 2, message: 'Test 2', startDate: date, endDate: date },
        { id: 3, message: 'Test 3', startDate: date, endDate: date },
      ];

      const notifications = await notificationsDb.getNotificationsForAccount(1);
      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT n.notification_id, n.message, n.start_date, n.end_date FROM notifications n JOIN account_notifications an ON n.notification_id = an.notification_id WHERE an.account_id = ? AND an.dismissed = 0 AND NOW() BETWEEN n.start_date AND n.end_date;',
        [1],
      );
      expect(notifications).toHaveLength(3);
      expect(notifications).toEqual(expectedNotifications);
    });

    it('should get no notifications for account 2', async () => {
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

    it('should throw error when getting notifications fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      await expect(notificationsDb.getNotificationsForAccount(1)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when getting notifications fails', async () => {
      mockPool.execute.mockRejectedValue({});

      await expect(notificationsDb.getNotificationsForAccount(1)).rejects.toThrow(
        'Unknown database error getting notifications for an account',
      );
    });
  });

  describe('dismissNotification()', () => {
    it('should dismiss a notification', async () => {
      mockPool.execute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      const updated = await notificationsDb.dismissNotification(1, 1);

      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE account_notifications SET dismissed = 1 WHERE notification_id = ? AND account_id = ?;',
        [1, 1],
      );
      expect(updated).toBe(true);
    });

    it('should verify a notification that is not dismissed', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      const updated = await notificationsDb.dismissNotification(2, 1);
      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE account_notifications SET dismissed = 1 WHERE notification_id = ? AND account_id = ?;',
        [2, 1],
      );
      expect(updated).toBe(false);
    });

    it('should throw error when dismissing a notification fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      await expect(notificationsDb.dismissNotification(1, 1)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message dismissing a notification fails', async () => {
      mockPool.execute.mockRejectedValue({});

      await expect(notificationsDb.dismissNotification(1, 1)).rejects.toThrow(
        'Unknown database error dismissing a notification',
      );
    });
  });

  describe('addNotification()', () => {
    let mockTransactionHelper: jest.Mocked<TransactionHelper>;

    beforeEach(() => {
      mockTransactionHelper = {
        executeInTransaction: jest.fn().mockImplementation(async (callback) => {
          return callback(mockConnection);
        }),
      } as unknown as jest.Mocked<TransactionHelper>;

      (TransactionHelper as jest.Mock).mockImplementation(() => mockTransactionHelper);
    });

    it('should successfully save a notification for all accounts', async () => {
      const notification: CreateNotificationRequest = {
        message: 'Test notification',
        startDate: '2025-05-01',
        endDate: '2025-05-31',
        sendToAll: true,
        accountId: null,
      };

      const mockAccounts = [{ account_id: 1 }, { account_id: 2 }];

      const notificationInsertResult: [ResultSetHeader, any] = [
        { insertId: 123, affectedRows: 1 } as ResultSetHeader,
        undefined,
      ];

      mockConnection.execute.mockResolvedValueOnce(notificationInsertResult);
      mockConnection.query.mockResolvedValueOnce([mockAccounts, []]);
      mockConnection.execute.mockResolvedValueOnce([]);

      await notificationsDb.addNotification(notification);

      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        1,
        'INSERT INTO notifications (message, start_date, end_date, send_to_all, account_id) VALUES (?,?,?,?,?)',
        ['Test notification', '2025-05-01', '2025-05-31', true, null],
      );

      expect(mockConnection.query).toHaveBeenNthCalledWith(1, 'SELECT account_id FROM accounts');

      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        'INSERT INTO account_notifications (notification_id, account_id, dismissed) VALUES ?',
        [
          [
            [123, 1, false],
            [123, 2, false],
          ],
        ],
      );
    });

    it('should successfully save a notification for a specific account', async () => {
      const notification: CreateNotificationRequest = {
        message: 'Test notification',
        startDate: '2025-05-01',
        endDate: '2025-05-31',
        sendToAll: false,
        accountId: 5,
      };

      const notificationInsertResult: [ResultSetHeader, any] = [
        { insertId: 123, affectedRows: 1 } as ResultSetHeader,
        undefined,
      ];

      mockConnection.execute.mockResolvedValueOnce(notificationInsertResult);
      mockConnection.execute.mockResolvedValueOnce([]);

      await notificationsDb.addNotification(notification);

      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        1,
        'INSERT INTO notifications (message, start_date, end_date, send_to_all, account_id) VALUES (?,?,?,?,?)',
        ['Test notification', '2025-05-01', '2025-05-31', false, 5],
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        'INSERT INTO account_notifications (notification_id, account_id, dismissed) VALUES (?,?,?)',
        [123, 5, false],
      );
    });

    it('should throw an error when no accounts found for all-account notification', async () => {
      const notification: CreateNotificationRequest = {
        message: 'Test notification',
        startDate: '2025-05-01',
        endDate: '2025-05-31',
        sendToAll: true,
        accountId: null,
      };

      mockConnection.execute.mockResolvedValueOnce([{ insertId: 123 }]);
      mockConnection.query.mockResolvedValueOnce([[], []]); // empty accounts result

      await expect(notificationsDb.addNotification(notification)).rejects.toThrow(
        'No accounts found when sending a notification to all accounts',
      );
      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors correctly', async () => {
      const notification: CreateNotificationRequest = {
        message: 'Test notification',
        startDate: '2025-05-01',
        endDate: '2025-05-31',
        sendToAll: false,
        accountId: 5,
      };

      const error = new Error('Database error');
      mockConnection.execute.mockRejectedValueOnce(error);

      await expect(notificationsDb.addNotification(notification)).rejects.toThrow(
        'Database error adding a notification: Database error',
      );
      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateNotification()', () => {
    it('should successfully update a notification', async () => {
      const notification: UpdateNotificationRequest = {
        id: 123,
        message: 'Updated message',
        startDate: '2025-05-01',
        endDate: '2025-05-31',
        sendToAll: true,
        accountId: null,
      };

      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await notificationsDb.updateNotification(notification);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE notifications SET message = ?, start_date = ?, end_date = ?, send_to_all = ?, account_id = ? WHERE notification_id = ?',
        ['Updated message', '2025-05-01', '2025-05-31', true, null, 123],
      );
    });

    it('should throw a NoAffectedRowsError when a notification not found', async () => {
      const notification: UpdateNotificationRequest = {
        id: 999,
        message: 'Updated message',
        startDate: '2025-05-01',
        endDate: '2025-05-31',
        sendToAll: true,
        accountId: null,
      };

      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      await expect(notificationsDb.updateNotification(notification)).rejects.toThrow(
        'No notification found with ID 999',
      );
    });

    it('should handle database errors correctly', async () => {
      const notification: UpdateNotificationRequest = {
        id: 123,
        message: 'Updated message',
        startDate: '2025-05-01',
        endDate: '2025-05-31',
        sendToAll: true,
        accountId: null,
      };

      const error = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(error);

      await expect(notificationsDb.updateNotification(notification)).rejects.toThrow(
        'Database error updating a notification: Database error',
      );
    });
  });

  describe('getAllNotifications()', () => {
    it('should get all active notifications when expired is false', async () => {
      const mockNotifications = [
        {
          notification_id: 1,
          message: 'Active notification',
          start_date: new Date('2025-04-01'),
          end_date: new Date('2025-04-30'),
          send_to_all: 1,
          account_id: null,
        },
      ] as NotificationRow[];

      mockPool.execute.mockResolvedValueOnce([mockNotifications]);

      const result = await notificationsDb.getAllNotifications(false);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * FROM notifications WHERE NOW() BETWEEN start_date AND end_date',
      );

      expect(result).toEqual([
        {
          id: 1,
          message: 'Active notification',
          startDate: new Date('2025-04-01'),
          endDate: new Date('2025-04-30'),
          sendToAll: true,
          accountId: null,
        },
      ]);
    });

    it('should get all notifications including expired ones when expired is true', async () => {
      const mockNotifications = [
        {
          notification_id: 1,
          message: 'Active notification',
          start_date: new Date('2025-04-01'),
          end_date: new Date('2025-04-30'),
          send_to_all: 1,
          account_id: null,
        },
        {
          notification_id: 2,
          message: 'Expired notification',
          start_date: new Date('2025-03-01'),
          end_date: new Date('2025-03-31'),
          send_to_all: 0,
          account_id: 5,
        },
      ] as NotificationRow[];

      mockPool.execute.mockResolvedValueOnce([mockNotifications]);

      const result = await notificationsDb.getAllNotifications(true);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM notifications');

      expect(result).toEqual([
        {
          id: 1,
          message: 'Active notification',
          startDate: new Date('2025-04-01'),
          endDate: new Date('2025-04-30'),
          sendToAll: true,
          accountId: null,
        },
        {
          id: 2,
          message: 'Expired notification',
          startDate: new Date('2025-03-01'),
          endDate: new Date('2025-03-31'),
          sendToAll: false,
          accountId: 5,
        },
      ]);
    });

    it('should handle database errors correctly', async () => {
      const error = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(error);

      await expect(notificationsDb.getAllNotifications(false)).rejects.toThrow(
        'Database error getting all notifications: Database error',
      );
    });
  });

  describe('deleteNotification()', () => {
    it('should successfully delete a notification', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await notificationsDb.deleteNotification(123);

      expect(mockPool.execute).toHaveBeenCalledWith('DELETE FROM notifications WHERE notification_id = ?', [123]);
    });

    it('should throw a NoAffectedRowsError when a notification is not found', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      await expect(notificationsDb.deleteNotification(999)).rejects.toThrow('No notification found with ID 999');
    });

    it('should handle database errors correctly', async () => {
      const error = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(error);

      await expect(notificationsDb.deleteNotification(123)).rejects.toThrow(
        'Database error deleting a notification: Database error',
      );
    });
  });
});
