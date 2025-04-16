import * as notificationsDb from '@db/notificationsDb';
import { errorService } from '@services/errorService';
import { notificationsService } from '@services/notificationsService';

jest.mock('@db/notificationsDb');
jest.mock('@services/errorService');

describe('notificationsService', () => {
  const mockNotifications = [
    {
      notification_id: 1,
      message: 'Test notification 1',
      start_date: new Date('2025-04-01'),
      end_date: new Date('2025-04-30')
    },
    {
      notification_id: 2,
      message: 'Test notification 2',
      start_date: new Date('2025-04-05'),
      end_date: new Date('2025-04-25')
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    (errorService.handleError as jest.Mock).mockImplementation((error) => {
      throw error;
    });
  });

  describe('getNotifications', () => {
    it('should return notifications for an account', async () => {
      (notificationsDb.getNotificationsForAccount as jest.Mock).mockResolvedValue(mockNotifications);

      const result = await notificationsService.getNotifications(123);

      expect(notificationsDb.getNotificationsForAccount).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockNotifications);
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

      await notificationsService.dismissNotification(1, 123);

      expect(notificationsDb.dismissNotification).toHaveBeenCalledWith(1, 123);
    });

    it('should handle case when notification is already dismissed', async () => {
      (notificationsDb.dismissNotification as jest.Mock).mockResolvedValue(false);

      await notificationsService.dismissNotification(1, 123);

      expect(notificationsDb.dismissNotification).toHaveBeenCalledWith(1, 123);
      // No error is thrown when dismissal returns false
    });

    it('should propagate database errors through errorService', async () => {
      const mockError = new Error('Database error during dismissal');
      (notificationsDb.dismissNotification as jest.Mock).mockRejectedValue(mockError);

      await expect(notificationsService.dismissNotification(1, 123)).rejects.toThrow(
        'Database error during dismissal'
      );
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'dismissNotification(1, 123)');
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
