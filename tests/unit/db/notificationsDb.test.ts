import { NotificationRow } from '../../../src/types/notificationTypes';
import { setupDatabaseTest } from './helpers/dbTestSetup';
import { CreateNotificationRequest, UpdateNotificationRequest } from '@ajgifford/keepwatching-types';
import * as notificationsDb from '@db/notificationsDb';
import { TransactionHelper } from '@utils/transactionHelper';
import { ResultSetHeader } from 'mysql2';

describe('notificationDb', () => {
  let mockExecute: jest.Mock;
  let mockConnection: any;
  let mockTransactionHelper: jest.Mocked<TransactionHelper>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup all database mocks using the helper
    const mocks = setupDatabaseTest();
    mockExecute = mocks.mockExecute;
    mockTransactionHelper = mocks.mockTransactionHelper;
    mockConnection = mocks.mockConnection;
  });

  describe('getNotificationsForAccount()', () => {
    it('should get three notifications for account 1', async () => {
      const date = new Date();
      const dbNotifications = [
        { notification_id: 1, message: 'Test 1', start_date: date, end_date: date, dismissed: false, read: false },
        { notification_id: 2, message: 'Test 2', start_date: date, end_date: date, dismissed: false, read: false },
        { notification_id: 3, message: 'Test 3', start_date: date, end_date: date, dismissed: false, read: false },
      ];
      mockExecute.mockResolvedValue([dbNotifications]);

      const expectedNotifications = [
        { id: 1, message: 'Test 1', startDate: date, endDate: date, dismissed: false, read: false },
        { id: 2, message: 'Test 2', startDate: date, endDate: date, dismissed: false, read: false },
        { id: 3, message: 'Test 3', startDate: date, endDate: date, dismissed: false, read: false },
      ];

      const notifications = await notificationsDb.getNotificationsForAccount(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM current_notifications WHERE account_id = ? AND dismissed = 0',
        [1],
      );
      expect(notifications).toHaveLength(3);
      expect(notifications).toEqual(expectedNotifications);
    });

    it('should get dismissed notifications for account 1', async () => {
      const date = new Date();
      const dbNotifications = [
        { notification_id: 1, message: 'Test 1', start_date: date, end_date: date, dismissed: false, read: false },
        { notification_id: 2, message: 'Test 2', start_date: date, end_date: date, dismissed: false, read: false },
        { notification_id: 3, message: 'Test 3', start_date: date, end_date: date, dismissed: true, read: false },
      ];
      mockExecute.mockResolvedValue([dbNotifications]);

      const expectedNotifications = [
        { id: 1, message: 'Test 1', startDate: date, endDate: date, dismissed: false, read: false },
        { id: 2, message: 'Test 2', startDate: date, endDate: date, dismissed: false, read: false },
        { id: 3, message: 'Test 3', startDate: date, endDate: date, dismissed: true, read: false },
      ];

      const notifications = await notificationsDb.getNotificationsForAccount(1, true);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM current_notifications WHERE account_id = ?', [1]);
      expect(notifications).toHaveLength(3);
      expect(notifications).toEqual(expectedNotifications);
    });

    it('should get no notifications for account 2', async () => {
      mockExecute.mockResolvedValue([[]]);

      const notifications = await notificationsDb.getNotificationsForAccount(2);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM current_notifications WHERE account_id = ? AND dismissed = 0',
        [2],
      );
      expect(notifications).toHaveLength(0);
      expect(notifications).toEqual([]);
    });

    it('should throw error when getting notifications fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);

      await expect(notificationsDb.getNotificationsForAccount(1)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when getting notifications fails', async () => {
      mockExecute.mockRejectedValue({});

      await expect(notificationsDb.getNotificationsForAccount(1)).rejects.toThrow(
        'Unknown database error getting notifications for an account',
      );
    });
  });

  describe('markNotificationRead()', () => {
    it('should mark a notification read', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      const updated = await notificationsDb.markNotificationRead(1, 1);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        `UPDATE account_notifications SET has_been_read = ? WHERE notification_id = ? AND account_id = ?;`,
        [1, 1, 1],
      );
      expect(updated).toBe(true);
    });

    it('should mark a notification unread', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      const updated = await notificationsDb.markNotificationRead(1, 1, false);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        `UPDATE account_notifications SET has_been_read = ? WHERE notification_id = ? AND account_id = ?;`,
        [0, 1, 1],
      );
      expect(updated).toBe(true);
    });

    it('should verify no update to notification read status', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      const updated = await notificationsDb.markNotificationRead(2, 1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        `UPDATE account_notifications SET has_been_read = ? WHERE notification_id = ? AND account_id = ?;`,
        [1, 2, 1],
      );
      expect(updated).toBe(false);
    });

    it('should throw error when marking a notification read fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);

      await expect(notificationsDb.markNotificationRead(1, 1)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message marking a notification read fails', async () => {
      mockExecute.mockRejectedValue({});

      await expect(notificationsDb.markNotificationRead(1, 1)).rejects.toThrow(
        'Unknown database error marking a notification read',
      );
    });
  });

  describe('markAllNotificationRead()', () => {
    it('should mark all notifications read', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 3 } as ResultSetHeader]);

      const updated = await notificationsDb.markAllNotificationsRead(1);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'UPDATE account_notifications SET has_been_read = ? WHERE account_id = ?;',
        [1, 1],
      );
      expect(updated).toBe(true);
    });

    it('should mark all notifications unread', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 3 } as ResultSetHeader]);

      const updated = await notificationsDb.markAllNotificationsRead(1, false);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'UPDATE account_notifications SET has_been_read = ? WHERE account_id = ?;',
        [0, 1],
      );
      expect(updated).toBe(true);
    });

    it('should verify no updates to notifications read status', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      const updated = await notificationsDb.markAllNotificationsRead(2);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'UPDATE account_notifications SET has_been_read = ? WHERE account_id = ?;',
        [1, 2],
      );
      expect(updated).toBe(false);
    });

    it('should throw error when marking all notifications read fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);

      await expect(notificationsDb.markAllNotificationsRead(1)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message marking all notifications read fails', async () => {
      mockExecute.mockRejectedValue({});

      await expect(notificationsDb.markAllNotificationsRead(1)).rejects.toThrow(
        'Unknown database error marking all notifications read',
      );
    });
  });

  describe('dismissNotification()', () => {
    it('should dismiss a notification', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      const updated = await notificationsDb.dismissNotification(1, 1);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'UPDATE account_notifications SET dismissed = 1 WHERE notification_id = ? AND account_id = ?;',
        [1, 1],
      );
      expect(updated).toBe(true);
    });

    it('should verify no update to notification dismissed status', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      const updated = await notificationsDb.dismissNotification(2, 1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'UPDATE account_notifications SET dismissed = 1 WHERE notification_id = ? AND account_id = ?;',
        [2, 1],
      );
      expect(updated).toBe(false);
    });

    it('should throw error when dismissing a notification fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);

      await expect(notificationsDb.dismissNotification(1, 1)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message dismissing a notification fails', async () => {
      mockExecute.mockRejectedValue({});

      await expect(notificationsDb.dismissNotification(1, 1)).rejects.toThrow(
        'Unknown database error dismissing a notification',
      );
    });
  });

  describe('dismissAllNotification()', () => {
    it('should dismiss all notifications', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 3 } as ResultSetHeader]);

      const updated = await notificationsDb.dismissAllNotifications(1);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith('UPDATE account_notifications SET dismissed = 1 WHERE account_id = ?;', [
        1,
      ]);
      expect(updated).toBe(true);
    });

    it('should verify no updates to notifications dismissed status', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      const updated = await notificationsDb.dismissAllNotifications(2);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith('UPDATE account_notifications SET dismissed = 1 WHERE account_id = ?;', [
        2,
      ]);
      expect(updated).toBe(false);
    });

    it('should throw error when dismissing all notifications fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);

      await expect(notificationsDb.dismissAllNotifications(1)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message dismissing all notifications fails', async () => {
      mockExecute.mockRejectedValue({});

      await expect(notificationsDb.dismissAllNotifications(1)).rejects.toThrow(
        'Unknown database error dismissing all notifications',
      );
    });
  });

  describe('addNotification()', () => {
    it('should successfully save a notification for all accounts', async () => {
      const notification: CreateNotificationRequest = {
        title: 'Test title',
        message: 'Test message',
        startDate: '2025-05-01',
        endDate: '2025-05-31',
        sendToAll: true,
        accountId: null,
        type: 'general',
      };

      const mockAccounts = [{ account_id: 1 }, { account_id: 2 }];

      const notificationInsertResult: [ResultSetHeader, any] = [
        { insertId: 123, affectedRows: 1 } as ResultSetHeader,
        undefined,
      ];

      mockConnection.execute.mockResolvedValueOnce(notificationInsertResult);
      mockConnection.execute.mockResolvedValueOnce([mockAccounts, []]);
      mockConnection.execute.mockResolvedValueOnce([]);

      await notificationsDb.addNotification(notification);

      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        1,
        'INSERT INTO notifications (title, message, start_date, end_date, send_to_all, account_id, type) VALUES (?,?,?,?,?,?,?)',
        ['Test title', 'Test message', '2025-04-30 19:00:00', '2025-05-30 19:00:00', 1, null, 'general'],
      );

      expect(mockConnection.execute).toHaveBeenNthCalledWith(2, 'SELECT account_id, account_name, email FROM accounts');
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        3,
        'INSERT INTO account_notifications (notification_id, account_id, dismissed) VALUES (?,?,?),(?,?,?)',
        [123, 1, false, 123, 2, false],
      );
    });

    it('should successfully save a notification for a specific account', async () => {
      const notification: CreateNotificationRequest = {
        title: 'Test title',
        message: 'Test message',
        startDate: '2025-05-01',
        endDate: '2025-05-31',
        sendToAll: false,
        accountId: 5,
        type: 'general',
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
        'INSERT INTO notifications (title, message, start_date, end_date, send_to_all, account_id, type) VALUES (?,?,?,?,?,?,?)',
        ['Test title', 'Test message', '2025-04-30 19:00:00', '2025-05-30 19:00:00', 0, 5, 'general'],
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        'INSERT INTO account_notifications (notification_id, account_id, dismissed) VALUES (?,?,?)',
        [123, 5, false],
      );
    });

    it('should throw an error when no accounts found for all-account notification', async () => {
      const notification: CreateNotificationRequest = {
        title: 'Test title',
        message: 'Test notification',
        startDate: '2025-05-01',
        endDate: '2025-05-31',
        sendToAll: true,
        accountId: null,
        type: 'general',
      };

      mockConnection.execute.mockResolvedValueOnce([{ insertId: 123 }]);
      mockConnection.execute.mockResolvedValueOnce([[], []]); // empty accounts result

      await expect(notificationsDb.addNotification(notification)).rejects.toThrow(
        'No accounts found when sending a notification to all accounts',
      );
      expect(mockTransactionHelper.executeInTransaction).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors correctly', async () => {
      const notification: CreateNotificationRequest = {
        title: 'Test title',
        message: 'Test notification',
        startDate: '2025-05-01',
        endDate: '2025-05-31',
        sendToAll: false,
        accountId: 5,
        type: 'general',
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
        title: 'Updated title',
        message: 'Updated message',
        startDate: '2025-05-01',
        endDate: '2025-05-31',
        sendToAll: true,
        accountId: null,
        type: 'general',
      };

      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await notificationsDb.updateNotification(notification);

      expect(mockExecute).toHaveBeenCalledWith(
        'UPDATE notifications SET title = ?, message = ?, start_date = ?, end_date = ?, type = ?, send_to_all = ?, account_id = ? WHERE notification_id = ?',
        ['Updated title', 'Updated message', '2025-04-30 19:00:00', '2025-05-30 19:00:00', 'general', 1, null, 123],
      );
    });

    it('should throw a NoAffectedRowsError when a notification not found', async () => {
      const notification: UpdateNotificationRequest = {
        id: 999,
        title: 'Updated title',
        message: 'Updated message',
        startDate: '2025-05-01',
        endDate: '2025-05-31',
        sendToAll: true,
        accountId: null,
        type: 'general',
      };

      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      await expect(notificationsDb.updateNotification(notification)).rejects.toThrow(
        'No notification found with ID 999',
      );
    });

    it('should handle database errors correctly', async () => {
      const notification: UpdateNotificationRequest = {
        id: 123,
        title: 'Updated title',
        message: 'Updated message',
        startDate: '2025-05-01',
        endDate: '2025-05-31',
        sendToAll: true,
        accountId: null,
        type: 'general',
      };

      const error = new Error('Database error');
      mockExecute.mockRejectedValueOnce(error);

      await expect(notificationsDb.updateNotification(notification)).rejects.toThrow(
        'Database error updating a notification: Database error',
      );
    });
  });

  describe('getAllNotifications()', () => {
    it('should get all active notifications with default pagination', async () => {
      const mockNotifications = [
        {
          notification_id: 1,
          title: 'Test',
          message: 'Active notification',
          start_date: new Date('2025-04-01'),
          end_date: new Date('2025-04-30'),
          send_to_all: 1,
          account_id: null,
          type: 'general',
        },
      ] as NotificationRow[];

      mockExecute.mockResolvedValueOnce([mockNotifications]);

      const result = await notificationsDb.getAllNotifications({ expired: false });

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM notifications WHERE end_date > NOW() ORDER BY start_date DESC LIMIT 50 OFFSET 0',
        [],
      );

      expect(result).toEqual([
        {
          id: 1,
          title: 'Test',
          message: 'Active notification',
          startDate: new Date('2025-04-01'),
          endDate: new Date('2025-04-30'),
          sendToAll: true,
          accountId: null,
          type: 'general',
        },
      ]);
    });

    it('should get all notifications including expired ones with custom pagination', async () => {
      const mockNotifications = [
        {
          notification_id: 1,
          title: 'Test 1',
          message: 'Active notification',
          start_date: new Date('2025-04-01'),
          end_date: new Date('2025-04-30'),
          send_to_all: 1,
          account_id: null,
          type: 'general',
        },
        {
          notification_id: 2,
          title: 'Test 2',
          message: 'Expired notification',
          start_date: new Date('2025-03-01'),
          end_date: new Date('2025-03-31'),
          send_to_all: 0,
          account_id: 5,
          type: 'general',
        },
      ] as NotificationRow[];

      mockExecute.mockResolvedValueOnce([mockNotifications]);

      const result = await notificationsDb.getAllNotifications({ expired: true }, 10, 5);

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM notifications ORDER BY start_date DESC LIMIT 10 OFFSET 5',
        [],
      );

      expect(result).toEqual([
        {
          id: 1,
          title: 'Test 1',
          message: 'Active notification',
          startDate: new Date('2025-04-01'),
          endDate: new Date('2025-04-30'),
          sendToAll: true,
          accountId: null,
          type: 'general',
        },
        {
          id: 2,
          title: 'Test 2',
          message: 'Expired notification',
          startDate: new Date('2025-03-01'),
          endDate: new Date('2025-03-31'),
          sendToAll: false,
          accountId: 5,
          type: 'general',
        },
      ]);
    });

    it('should filter by type', async () => {
      const mockNotifications = [] as NotificationRow[];
      mockExecute.mockResolvedValueOnce([mockNotifications]);

      await notificationsDb.getAllNotifications({ expired: false, type: 'maintenance' });

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM notifications WHERE end_date > NOW() AND type = ? ORDER BY start_date DESC LIMIT 50 OFFSET 0',
        ['maintenance'],
      );
    });

    it('should filter by date range', async () => {
      const mockNotifications = [] as NotificationRow[];
      mockExecute.mockResolvedValueOnce([mockNotifications]);

      await notificationsDb.getAllNotifications({
        expired: false,
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM notifications WHERE end_date > NOW() AND start_date >= ? AND end_date <= ? ORDER BY start_date DESC LIMIT 50 OFFSET 0',
        ['2024-12-31 18:00:00', '2025-12-30 18:00:00'],
      );
    });

    it('should handle database errors correctly', async () => {
      const error = new Error('Database error');
      mockExecute.mockRejectedValueOnce(error);

      await expect(notificationsDb.getAllNotifications({ expired: false })).rejects.toThrow(
        'Database error getting all notifications: Database error',
      );
    });
  });

  describe('getNotificationsCount()', () => {
    it('should get count of active notifications', async () => {
      mockExecute.mockResolvedValueOnce([[{ total: 5 }]]);

      const result = await notificationsDb.getNotificationsCount({ expired: false });

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT COUNT(*) AS total FROM notifications WHERE end_date > NOW()',
        [],
      );
      expect(result).toBe(5);
    });

    it('should get count with filters', async () => {
      mockExecute.mockResolvedValueOnce([[{ total: 2 }]]);

      const result = await notificationsDb.getNotificationsCount({
        expired: false,
        type: 'maintenance',
        startDate: '2025-01-01',
      });

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT COUNT(*) AS total FROM notifications WHERE end_date > NOW() AND type = ? AND start_date >= ?',
        ['maintenance', '2024-12-31 18:00:00'],
      );
      expect(result).toBe(2);
    });

    it('should handle database errors correctly', async () => {
      const error = new Error('Database error');
      mockExecute.mockRejectedValueOnce(error);

      await expect(notificationsDb.getNotificationsCount({ expired: false })).rejects.toThrow(
        'Database error get a count of all notifications: Database error',
      );
    });
  });

  describe('deleteNotification()', () => {
    it('should successfully delete a notification', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await notificationsDb.deleteNotification(123);

      expect(mockExecute).toHaveBeenCalledWith('DELETE FROM notifications WHERE notification_id = ?', [123]);
    });

    it('should throw a NoAffectedRowsError when a notification is not found', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      await expect(notificationsDb.deleteNotification(999)).rejects.toThrow('No notification found with ID 999');
    });

    it('should handle database errors correctly', async () => {
      const error = new Error('Database error');
      mockExecute.mockRejectedValueOnce(error);

      await expect(notificationsDb.deleteNotification(123)).rejects.toThrow(
        'Database error deleting a notification: Database error',
      );
    });
  });
});
