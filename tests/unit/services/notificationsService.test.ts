import { CreateNotificationRequest, UpdateNotificationRequest } from '@ajgifford/keepwatching-types';
import * as notificationsDb from '@db/notificationsDb';
import { NoAffectedRowsError } from '@middleware/errorMiddleware';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import {
  NotificationsService,
  createNotificationsService,
  notificationsService,
  resetNotificationsService,
} from '@services/notificationsService';

jest.mock('@db/notificationsDb');
jest.mock('@services/errorService');
jest.mock('@services/cacheService');

describe('notificationsService', () => {
  let service: NotificationsService;
  let mockCacheService: jest.Mocked<any>;

  const mockAccountNotifications = [
    {
      id: 1,
      message: 'Test notification 1',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-04-30'),
      dismissed: false,
      read: false,
    },
    {
      id: 2,
      message: 'Test notification 2',
      startDate: new Date('2025-04-05'),
      endDate: new Date('2025-04-25'),
      dismissed: false,
      read: false,
    },
  ];

  const mockAllAccountNotifications = [
    {
      id: 1,
      message: 'Test notification 1',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-04-30'),
      dismissed: false,
      read: false,
    },
    {
      id: 2,
      message: 'Test notification 2',
      startDate: new Date('2025-04-05'),
      endDate: new Date('2025-04-25'),
      dismissed: false,
      read: false,
    },
    {
      id: 3,
      message: 'Test notification 3',
      startDate: new Date('2025-04-05'),
      endDate: new Date('2025-04-25'),
      dismissed: true,
      read: false,
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

    resetNotificationsService();

    mockCacheService = {
      getOrSet: jest.fn(),
      invalidate: jest.fn(),
      invalidatePattern: jest.fn(),
    };

    // Default implementation for cache.getOrSet - calls the fetch function
    mockCacheService.getOrSet.mockImplementation(async (_key: string, fetchFn: () => Promise<any>) => {
      return await fetchFn();
    });

    (errorService.handleError as jest.Mock).mockImplementation((error) => {
      throw error;
    });

    service = createNotificationsService({ cacheService: mockCacheService });
  });

  afterEach(() => {
    resetNotificationsService();
    jest.resetModules();
  });

  describe('getNotifications', () => {
    it('should return notifications for an account that are not dismissed', async () => {
      (notificationsDb.getNotificationsForAccount as jest.Mock).mockResolvedValue(mockAccountNotifications);

      const result = await service.getNotifications(123);

      expect(notificationsDb.getNotificationsForAccount).toHaveBeenCalledWith(123, false);
      expect(result).toEqual(mockAccountNotifications);
    });

    it('should return all notifications for an account (dismissed or not)', async () => {
      (notificationsDb.getNotificationsForAccount as jest.Mock).mockResolvedValue(mockAllAccountNotifications);

      const result = await service.getNotifications(123, true);

      expect(notificationsDb.getNotificationsForAccount).toHaveBeenCalledWith(123, true);
      expect(result).toEqual(mockAllAccountNotifications);
    });

    it('should handle empty notifications array', async () => {
      (notificationsDb.getNotificationsForAccount as jest.Mock).mockResolvedValue([]);

      const result = await service.getNotifications(123);

      expect(notificationsDb.getNotificationsForAccount).toHaveBeenCalledWith(123, false);
      expect(result).toEqual([]);
    });

    it('should propagate database errors through errorService', async () => {
      const mockError = new Error('Database error');
      (notificationsDb.getNotificationsForAccount as jest.Mock).mockRejectedValue(mockError);

      await expect(service.getNotifications(123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getNotifications(123, false)');
    });
  });

  describe('markNotificationRead', () => {
    it('should mark a notification as read successfully', async () => {
      (notificationsDb.markNotificationRead as jest.Mock).mockResolvedValue(true);
      (notificationsDb.getNotificationsForAccount as jest.Mock).mockResolvedValue(mockAccountNotifications);

      const result = await service.markNotificationRead(1, 123);

      expect(notificationsDb.markNotificationRead).toHaveBeenCalledWith(1, 123, true);
      expect(notificationsDb.getNotificationsForAccount).toHaveBeenCalledWith(123, false);
      expect(result).toEqual(mockAccountNotifications);
    });

    it('should mark a notification as unread successfully', async () => {
      (notificationsDb.markNotificationRead as jest.Mock).mockResolvedValue(true);
      (notificationsDb.getNotificationsForAccount as jest.Mock).mockResolvedValue(mockAccountNotifications);

      const result = await service.markNotificationRead(1, 123, false);

      expect(notificationsDb.markNotificationRead).toHaveBeenCalledWith(1, 123, false);
      expect(notificationsDb.getNotificationsForAccount).toHaveBeenCalledWith(123, false);
      expect(result).toEqual(mockAccountNotifications);
    });

    it('should fail to mark a notification read', async () => {
      (notificationsDb.markNotificationRead as jest.Mock).mockResolvedValue(false);
      const mockError = new NoAffectedRowsError('No notification was marked read');

      await expect(service.markNotificationRead(1, 123)).rejects.toThrow(
        'No notification was marked read',
      );
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'markNotificationRead(1, 123, true, false)');
    });

    it('should propagate database errors through errorService', async () => {
      const mockError = new Error('Database error during mark read');
      (notificationsDb.markNotificationRead as jest.Mock).mockRejectedValue(mockError);

      await expect(service.markNotificationRead(1, 123)).rejects.toThrow(
        'Database error during mark read',
      );
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'markNotificationRead(1, 123, true, false)');
    });
  });

  describe('markAllNotificationsRead', () => {
    it('should mark all notifications as read successfully', async () => {
      (notificationsDb.markAllNotificationsRead as jest.Mock).mockResolvedValue(true);
      (notificationsDb.getNotificationsForAccount as jest.Mock).mockResolvedValue(mockAccountNotifications);

      const result = await service.markAllNotificationsRead(123);

      expect(notificationsDb.markAllNotificationsRead).toHaveBeenCalledWith(123, true);
      expect(notificationsDb.getNotificationsForAccount).toHaveBeenCalledWith(123, false);
      expect(result).toEqual(mockAccountNotifications);
    });

    it('should mark all notifications as unread successfully', async () => {
      (notificationsDb.markAllNotificationsRead as jest.Mock).mockResolvedValue(true);
      (notificationsDb.getNotificationsForAccount as jest.Mock).mockResolvedValue(mockAccountNotifications);

      const result = await service.markAllNotificationsRead(123, false);

      expect(notificationsDb.markAllNotificationsRead).toHaveBeenCalledWith(123, false);
      expect(notificationsDb.getNotificationsForAccount).toHaveBeenCalledWith(123, false);
      expect(result).toEqual(mockAccountNotifications);
    });

    it('should fail to mark all notifications read', async () => {
      (notificationsDb.markAllNotificationsRead as jest.Mock).mockResolvedValue(false);
      const mockError = new NoAffectedRowsError('No notifications were marked read');

      await expect(service.markAllNotificationsRead(123)).rejects.toThrow(
        'No notifications were marked read',
      );
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'markAllNotificationsRead(123, true, false)');
    });

    it('should propagate database errors through errorService', async () => {
      const mockError = new Error('Database error during marking read');
      (notificationsDb.markAllNotificationsRead as jest.Mock).mockRejectedValue(mockError);

      await expect(service.markAllNotificationsRead(123)).rejects.toThrow(
        'Database error during marking read',
      );
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'markAllNotificationsRead(123, true, false)');
    });
  });

  describe('dismissNotification', () => {
    it('should dismiss a notification successfully', async () => {
      (notificationsDb.dismissNotification as jest.Mock).mockResolvedValue(true);
      (notificationsDb.getNotificationsForAccount as jest.Mock).mockResolvedValue(mockAccountNotifications);

      const result = await service.dismissNotification(1, 123);

      expect(notificationsDb.dismissNotification).toHaveBeenCalledWith(1, 123);
      expect(notificationsDb.getNotificationsForAccount).toHaveBeenCalledWith(123, false);
      expect(result).toEqual(mockAccountNotifications);
    });

    it('should fail to dismiss a notification', async () => {
      (notificationsDb.dismissNotification as jest.Mock).mockResolvedValue(false);
      const mockError = new NoAffectedRowsError('No notification was dismissed');

      await expect(service.dismissNotification(1, 123)).rejects.toThrow('No notification was dismissed');
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'dismissNotification(1, 123, false)');
    });

    it('should propagate database errors through errorService', async () => {
      const mockError = new Error('Database error during dismissal');
      (notificationsDb.dismissNotification as jest.Mock).mockRejectedValue(mockError);

      await expect(service.dismissNotification(1, 123)).rejects.toThrow('Database error during dismissal');
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'dismissNotification(1, 123, false)');
    });
  });

  describe('dismissAllNotifications', () => {
    it('should dismiss all notifications successfully', async () => {
      (notificationsDb.dismissAllNotifications as jest.Mock).mockResolvedValue(true);
      (notificationsDb.getNotificationsForAccount as jest.Mock).mockResolvedValue(mockAccountNotifications);

      const result = await service.dismissAllNotifications(123);

      expect(notificationsDb.dismissAllNotifications).toHaveBeenCalledWith(123);
      expect(notificationsDb.getNotificationsForAccount).toHaveBeenCalledWith(123, false);
      expect(result).toEqual(mockAccountNotifications);
    });

    it('should fail to dismiss all notifications', async () => {
      (notificationsDb.dismissAllNotifications as jest.Mock).mockResolvedValue(false);
      const mockError = new NoAffectedRowsError('No notifications were dismissed');

      await expect(service.dismissAllNotifications(123)).rejects.toThrow(
        'No notifications were dismissed',
      );
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'dismissAllNotifications(123, false)');
    });

    it('should propagate database errors through errorService', async () => {
      const mockError = new Error('Database error during dismissal');
      (notificationsDb.dismissAllNotifications as jest.Mock).mockRejectedValue(mockError);

      await expect(service.dismissAllNotifications(123)).rejects.toThrow(
        'Database error during dismissal',
      );
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'dismissAllNotifications(123, false)');
    });
  });

  describe('getAllNotifications', () => {
    it('should return all notifications, including expired', async () => {
      (notificationsDb.getNotificationsCount as jest.Mock).mockResolvedValue(3);
      (notificationsDb.getAllNotifications as jest.Mock).mockResolvedValue(mockAdminNotifications);

      const result = await service.getAllNotifications({ expired: true }, 1, 1, 25);

      expect(notificationsDb.getAllNotifications).toHaveBeenCalledWith({ expired: true }, 25, 1);
      expect(notificationsDb.getNotificationsCount).toHaveBeenCalledWith({ expired: true });
      expect(result).toEqual({
        message: 'Notifications retrieved successfully',
        notifications: mockAdminNotifications,
        pagination: {
          totalCount: 3,
          totalPages: 1,
          currentPage: 1,
          limit: 25,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    });

    it('should return all notifications, excluding expired', async () => {
      (notificationsDb.getNotificationsCount as jest.Mock).mockResolvedValue(3);
      (notificationsDb.getAllNotifications as jest.Mock).mockResolvedValue(mockAdminNotifications);

      const result = await service.getAllNotifications({ expired: false }, 1, 1, 25);

      expect(notificationsDb.getAllNotifications).toHaveBeenCalledWith({ expired: false }, 25, 1);
      expect(notificationsDb.getNotificationsCount).toHaveBeenCalledWith({ expired: false });
      expect(result).toEqual({
        message: 'Notifications retrieved successfully',
        notifications: mockAdminNotifications,
        pagination: {
          totalCount: 3,
          totalPages: 1,
          currentPage: 1,
          limit: 25,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    });

    it('should handle empty notifications array', async () => {
      (notificationsDb.getNotificationsCount as jest.Mock).mockResolvedValue(0);
      (notificationsDb.getAllNotifications as jest.Mock).mockResolvedValue([]);

      const result = await service.getAllNotifications({ expired: true }, 1, 1, 25);

      expect(notificationsDb.getAllNotifications).toHaveBeenCalledWith({ expired: true }, 25, 1);
      expect(notificationsDb.getNotificationsCount).toHaveBeenCalledWith({ expired: true });
      expect(result).toEqual({
        message: 'Notifications retrieved successfully',
        notifications: [],
        pagination: {
          totalCount: 0,
          totalPages: 0,
          currentPage: 1,
          limit: 25,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    });

    it('should propagate database errors through errorService', async () => {
      const mockError = new Error('Database error');
      (notificationsDb.getAllNotifications as jest.Mock).mockRejectedValue(mockError);

      await expect(service.getAllNotifications({ expired: true }, 1, 1, 25)).rejects.toThrow(
        'Database error',
      );
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getAllNotifications({"expired":true})');
    });
  });

  describe('addNotification', () => {
    it('should add a notification for all accounts successfully', async () => {
      const mockNotification: CreateNotificationRequest = {
        title: 'Test title',
        message: 'Test message 13',
        startDate: '2025-04-05',
        endDate: '2025-04-25',
        sendToAll: true,
        accountId: null,
        type: 'general',
      };

      (notificationsDb.addNotification as jest.Mock).mockResolvedValue(undefined);

      await service.addNotification(mockNotification);

      expect(notificationsDb.addNotification).toHaveBeenCalledWith(mockNotification);
    });

    it('should add a notification for a single account successfully', async () => {
      const mockNotification: CreateNotificationRequest = {
        title: 'Test title',
        message: 'Test message 13',
        startDate: '2025-04-05',
        endDate: '2025-04-25',
        sendToAll: false,
        accountId: 1,
        type: 'general',
      };

      (notificationsDb.addNotification as jest.Mock).mockResolvedValue(undefined);

      await service.addNotification(mockNotification);

      expect(notificationsDb.addNotification).toHaveBeenCalledWith(mockNotification);
    });

    it('should propagate database errors through errorService', async () => {
      const mockError = new Error('Database error during add');
      (notificationsDb.addNotification as jest.Mock).mockRejectedValue(mockError);

      await expect(
        service.addNotification({
          title: 'title',
          message: 'message',
          startDate: '2025-04-01',
          endDate: '2025-05-01',
          sendToAll: true,
          accountId: null,
          type: 'general',
        }),
      ).rejects.toThrow('Database error during add');
      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        'addNotification({"title":"title","message":"message","startDate":"2025-04-01","endDate":"2025-05-01","sendToAll":true,"accountId":null,"type":"general"})',
      );
    });
  });

  describe('updateNotification', () => {
    it('should update a notification for all accounts successfully', async () => {
      const mockNotification: UpdateNotificationRequest = {
        title: 'Test title',
        message: 'Test message 13',
        startDate: '2025-04-05',
        endDate: '2025-04-25',
        sendToAll: true,
        accountId: null,
        type: 'general',
        id: 13,
      };

      (notificationsDb.updateNotification as jest.Mock).mockResolvedValue(mockNotification);

      await service.updateNotification(mockNotification);

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
        title: 'Test title',
        message: 'Test message 13',
        startDate: '2025-04-05',
        endDate: '2025-04-25',
        sendToAll: true,
        accountId: null,
        type: 'general',
        id: 13,
      };
      await service.updateNotification(updateRequest);

      expect(notificationsDb.updateNotification).toHaveBeenCalled();
    });

    it('should propagate database errors through errorService', async () => {
      const mockError = new Error('Database error during update');
      (notificationsDb.updateNotification as jest.Mock).mockRejectedValue(mockError);

      const updateRequest: UpdateNotificationRequest = {
        title: 'title',
        message: 'message',
        startDate: '2025-04-05',
        endDate: '2025-04-25',
        sendToAll: true,
        accountId: null,
        type: 'general',
        id: 13,
      };
      await expect(service.updateNotification(updateRequest)).rejects.toThrow(
        'Database error during update',
      );
      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        'updateNotification({"title":"title","message":"message","startDate":"2025-04-05","endDate":"2025-04-25","sendToAll":true,"accountId":null,"type":"general","id":13})',
      );
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification successfully', async () => {
      (notificationsDb.deleteNotification as jest.Mock).mockResolvedValue(undefined);

      await service.deleteNotification(1);

      expect(notificationsDb.deleteNotification).toHaveBeenCalledWith(1);
    });

    it('should propagate database errors through errorService', async () => {
      const mockError = new Error('Database error during delete');
      (notificationsDb.deleteNotification as jest.Mock).mockRejectedValue(mockError);

      await expect(service.deleteNotification(1)).rejects.toThrow('Database error during delete');
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'deleteNotification(1)');
    });
  });

  describe('service instance', () => {
    it('should be properly instantiated', () => {
      expect(notificationsService).toBeDefined();
      expect(service.getNotifications).toBeInstanceOf(Function);
      expect(service.dismissNotification).toBeInstanceOf(Function);
    });
  });
});
