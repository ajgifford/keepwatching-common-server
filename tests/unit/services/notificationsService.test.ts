import { CreateNotificationRequest, UpdateNotificationRequest } from '@ajgifford/keepwatching-types';
import * as notificationsDb from '@db/notificationsDb';
import { NoAffectedRowsError } from '@middleware/errorMiddleware';
import { errorService } from '@services/errorService';
import { notificationsService } from '@services/notificationsService';

jest.mock('@db/notificationsDb');
jest.mock('@services/errorService');

describe('notificationsService', () => {
  const mockAccountNotifications = [
    {
      id: 1,
      message: 'Test notification 1',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-04-30'),
    },
    {
      id: 2,
      message: 'Test notification 2',
      startDate: new Date('2025-04-05'),
      endDate: new Date('2025-04-25'),
    },
  ];

  const mockAdminNotifications = [
    {
      notification_id: 11,
      message: 'Test notification 11',
      start_date: new Date('2025-04-01'),
      end_date: new Date('2025-04-30'),
      send_to_all: true,
      account_id: null,
    },
    {
      notification_id: 12,
      message: 'Test notification 12',
      start_date: new Date('2025-04-05'),
      end_date: new Date('2025-04-25'),
      send_to_all: true,
      account_id: null,
    },
    {
      notification_id: 13,
      message: 'Test notification 13',
      start_date: new Date('2025-04-05'),
      end_date: new Date('2025-04-25'),
      send_to_all: false,
      account_id: 1,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    (errorService.handleError as jest.Mock).mockImplementation((error) => {
      throw error;
    });
  });

  describe('getNotifications', () => {
    it('should return notifications for an account', async () => {
      (notificationsDb.getNotificationsForAccount as jest.Mock).mockResolvedValue(mockAccountNotifications);

      const result = await notificationsService.getNotifications(123);

      expect(notificationsDb.getNotificationsForAccount).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockAccountNotifications);
    });

    it('should handle empty notifications array', async () => {
      (notificationsDb.getNotificationsForAccount as jest.Mock).mockResolvedValue([]);

      const result = await notificationsService.getNotifications(123);

      expect(notificationsDb.getNotificationsForAccount).toHaveBeenCalledWith(123);
      expect(result).toEqual([]);
    });

    it('should propagate database errors through errorService', async () => {
      const mockError = new Error('Database error');
      (notificationsDb.getNotificationsForAccount as jest.Mock).mockRejectedValue(mockError);

      await expect(notificationsService.getNotifications(123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getNotifications(123)');
    });
  });

  describe('dismissNotification', () => {
    it('should dismiss a notification successfully', async () => {
      (notificationsDb.dismissNotification as jest.Mock).mockResolvedValue(true);
      (notificationsDb.getNotificationsForAccount as jest.Mock).mockResolvedValue(mockAccountNotifications);

      const result = await notificationsService.dismissNotification(1, 123);

      expect(notificationsDb.dismissNotification).toHaveBeenCalledWith(1, 123);
      expect(notificationsDb.getNotificationsForAccount).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockAccountNotifications);
    });

    it('should fail to dismiss a notification', async () => {
      (notificationsDb.dismissNotification as jest.Mock).mockResolvedValue(false);
      const mockError = new NoAffectedRowsError('No notification was dismissed');

      await expect(notificationsService.dismissNotification(1, 123)).rejects.toThrow('No notification was dismissed');
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'dismissNotification(1, 123)');
    });

    it('should propagate database errors through errorService', async () => {
      const mockError = new Error('Database error during dismissal');
      (notificationsDb.dismissNotification as jest.Mock).mockRejectedValue(mockError);

      await expect(notificationsService.dismissNotification(1, 123)).rejects.toThrow('Database error during dismissal');
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'dismissNotification(1, 123)');
    });
  });

  describe('getAllNotifications', () => {
    it('should return all notifications, including expired', async () => {
      (notificationsDb.getAllNotifications as jest.Mock).mockResolvedValue(mockAdminNotifications);

      const result = await notificationsService.getAllNotifications(true);

      expect(notificationsDb.getAllNotifications).toHaveBeenCalledWith(true);
      expect(result).toEqual(mockAdminNotifications);
    });

    it('should return all notifications, excluding expired', async () => {
      (notificationsDb.getAllNotifications as jest.Mock).mockResolvedValue(mockAdminNotifications);

      const result = await notificationsService.getAllNotifications(false);

      expect(notificationsDb.getAllNotifications).toHaveBeenCalledWith(false);
      expect(result).toEqual(mockAdminNotifications);
    });

    it('should handle empty notifications array', async () => {
      (notificationsDb.getAllNotifications as jest.Mock).mockResolvedValue([]);

      const result = await notificationsService.getAllNotifications(true);

      expect(notificationsDb.getAllNotifications).toHaveBeenCalledWith(true);
      expect(result).toEqual([]);
    });

    it('should propagate database errors through errorService', async () => {
      const mockError = new Error('Database error');
      (notificationsDb.getAllNotifications as jest.Mock).mockRejectedValue(mockError);

      await expect(notificationsService.getAllNotifications(true)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getAllNotifications(true)');
    });
  });

  describe('addNotification', () => {
    it('should add a notification for all accounts successfully', async () => {
      const mockNotification: CreateNotificationRequest = {
        message: 'Test notification 13',
        startDate: '2025-04-05',
        endDate: '2025-04-25',
        sendToAll: true,
        accountId: null,
      };

      (notificationsDb.addNotification as jest.Mock).mockResolvedValue(undefined);

      await notificationsService.addNotification(mockNotification);

      expect(notificationsDb.addNotification).toHaveBeenCalledWith(mockNotification);
    });

    it('should add a notification for a single account successfully', async () => {
      const mockNotification: CreateNotificationRequest = {
        message: 'Test notification 13',
        startDate: '2025-04-05',
        endDate: '2025-04-25',
        sendToAll: false,
        accountId: 1,
      };

      (notificationsDb.addNotification as jest.Mock).mockResolvedValue(undefined);

      await notificationsService.addNotification(mockNotification);

      expect(notificationsDb.addNotification).toHaveBeenCalledWith(mockNotification);
    });

    it('should propagate database errors through errorService', async () => {
      const mockError = new Error('Database error during add');
      (notificationsDb.addNotification as jest.Mock).mockRejectedValue(mockError);

      await expect(
        notificationsService.addNotification({
          message: 'message',
          startDate: '2025-04-01',
          endDate: '2025-05-01',
          sendToAll: true,
          accountId: null,
        }),
      ).rejects.toThrow('Database error during add');
      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        'addNotification({"message":"message","startDate":"2025-04-01","endDate":"2025-05-01","sendToAll":true,"accountId":null})',
      );
    });
  });

  describe('updateNotification', () => {
    it('should update a notification for all accounts successfully', async () => {
      const mockNotification: UpdateNotificationRequest = {
        message: 'Test notification 13',
        startDate: '2025-04-05',
        endDate: '2025-04-25',
        sendToAll: true,
        accountId: null,
        id: 13,
      };

      (notificationsDb.updateNotification as jest.Mock).mockResolvedValue(mockNotification);

      await notificationsService.updateNotification(mockNotification);

      expect(notificationsDb.updateNotification).toHaveBeenCalled();
    });

    it('should update a notification for a single account successfully', async () => {
      const mockNotification = {
        message: 'Test notification 13',
        start_date: new Date('2025-04-05'),
        end_date: new Date('2025-04-25'),
        send_to_all: false,
        account_id: 1,
        notification_id: 13,
      };

      (notificationsDb.updateNotification as jest.Mock).mockResolvedValue(mockNotification);

      const updateRequest: UpdateNotificationRequest = {
        message: 'Test notification 13',
        startDate: '2025-04-05',
        endDate: '2025-04-25',
        sendToAll: true,
        accountId: null,
        id: 13,
      };
      await notificationsService.updateNotification(updateRequest);

      expect(notificationsDb.updateNotification).toHaveBeenCalled();
    });

    it('should propagate database errors through errorService', async () => {
      const mockError = new Error('Database error during update');
      (notificationsDb.updateNotification as jest.Mock).mockRejectedValue(mockError);

      const updateRequest: UpdateNotificationRequest = {
        message: 'message',
        startDate: '2025-04-05',
        endDate: '2025-04-25',
        sendToAll: true,
        accountId: null,
        id: 13,
      };
      await expect(notificationsService.updateNotification(updateRequest)).rejects.toThrow(
        'Database error during update',
      );
      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        'updateNotification({"message":"message","startDate":"2025-04-05","endDate":"2025-04-25","sendToAll":true,"accountId":null,"id":13})',
      );
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification successfully', async () => {
      (notificationsDb.deleteNotification as jest.Mock).mockResolvedValue(undefined);

      await notificationsService.deleteNotification(1);

      expect(notificationsDb.deleteNotification).toHaveBeenCalledWith(1);
    });

    it('should propagate database errors through errorService', async () => {
      const mockError = new Error('Database error during delete');
      (notificationsDb.deleteNotification as jest.Mock).mockRejectedValue(mockError);

      await expect(notificationsService.deleteNotification(1)).rejects.toThrow('Database error during delete');
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'deleteNotification(1)');
    });
  });

  describe('service instance', () => {
    it('should be properly instantiated', () => {
      expect(notificationsService).toBeDefined();
      expect(notificationsService.getNotifications).toBeInstanceOf(Function);
      expect(notificationsService.dismissNotification).toBeInstanceOf(Function);
    });
  });
});
