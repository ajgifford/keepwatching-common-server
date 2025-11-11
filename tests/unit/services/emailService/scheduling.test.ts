import { cleanupScheduledJobs, setupMocks } from './helpers/mocks';
import * as emailDb from '@db/emailDb';
import { appLogger } from '@logger/logger';
import { emailService } from '@services/emailService';
import { errorService } from '@services/errorService';

describe('EmailService - Email Scheduling', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    cleanupScheduledJobs(emailService);
  });

  describe('scheduleEmail', () => {
    it('should schedule email for future delivery', async () => {
      const futureDate = new Date(Date.now() + 10000).toISOString();
      const mockEmailData = {
        subject: 'Test Email',
        message: 'Test message',
        sendToAll: false,
        recipients: [1],
        action: 'schedule' as const,
        scheduledDate: futureDate,
      };

      (emailDb.updateEmailStatus as jest.Mock).mockResolvedValue(undefined);

      await emailService.scheduleEmail(1, mockEmailData);

      expect(emailDb.updateEmailStatus).toHaveBeenCalledWith(1, null, 'scheduled');
      expect(appLogger.info).toHaveBeenCalledWith('Email job scheduled', {
        emailId: 1,
        subject: 'Test Email',
        scheduledDate: futureDate,
        delayMs: expect.any(Number),
      });
    });

    it('should throw BadRequestError if scheduledDate is missing', async () => {
      const mockEmailData = {
        subject: 'Test Email',
        message: 'Test message',
        sendToAll: false,
        recipients: [1],
        action: 'schedule' as const,
        scheduledDate: null,
      };

      await expect(emailService.scheduleEmail(1, mockEmailData)).rejects.toThrow(
        'Scheduled date is required for scheduling emails',
      );
    });

    it('should throw BadRequestError if scheduledDate is in the past', async () => {
      const pastDate = new Date(Date.now() - 10000).toISOString();
      const mockEmailData = {
        subject: 'Test Email',
        message: 'Test message',
        sendToAll: false,
        recipients: [1],
        action: 'schedule' as const,
        scheduledDate: pastDate,
      };

      await expect(emailService.scheduleEmail(1, mockEmailData)).rejects.toThrow(
        'Scheduled date must be in the future',
      );
    });

    it('should handle error and update status to failed', async () => {
      const futureDate = new Date(Date.now() + 10000).toISOString();
      const mockEmailData = {
        subject: 'Test Email',
        message: 'Test message',
        sendToAll: false,
        recipients: [1],
        action: 'schedule' as const,
        scheduledDate: futureDate,
      };
      const mockError = new Error('Database error');

      // Mock to fail on the first call to updateEmailStatus (the 'scheduled' status update)
      (emailDb.updateEmailStatus as jest.Mock).mockRejectedValueOnce(mockError);
      // Mock to succeed on the second call (the 'failed' status update in the catch block)
      (emailDb.updateEmailStatus as jest.Mock).mockResolvedValueOnce(undefined);

      await expect(emailService.scheduleEmail(1, mockEmailData)).rejects.toThrow(mockError);
      expect(emailDb.updateEmailStatus).toHaveBeenCalledWith(1, null, 'scheduled');
      expect(emailDb.updateEmailStatus).toHaveBeenCalledWith(1, null, 'failed');
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'scheduleEmail');
    });
  });

  describe('cancelScheduledEmail', () => {
    it('should cancel a scheduled email', async () => {
      const futureDate = new Date(Date.now() + 10000).toISOString();
      const mockEmailData = {
        subject: 'Test Email',
        message: 'Test message',
        sendToAll: false,
        recipients: [1],
        action: 'schedule' as const,
        scheduledDate: futureDate,
      };

      (emailDb.updateEmailStatus as jest.Mock).mockResolvedValue(undefined);

      // First schedule the email
      await emailService.scheduleEmail(1, mockEmailData);

      // Then cancel it
      const result = await emailService.cancelScheduledEmail(1);

      expect(result).toBe(true);
      expect(emailDb.updateEmailStatus).toHaveBeenCalledWith(1, null, 'draft');
      expect(appLogger.info).toHaveBeenCalledWith('Scheduled email job cancelled', { emailId: 1 });
    });

    it('should throw BadRequestError if no scheduled job found', async () => {
      await expect(emailService.cancelScheduledEmail(999)).rejects.toThrow('No scheduled job found for this email ID');
    });

    it('should handle error and rethrow', async () => {
      const futureDate = new Date(Date.now() + 10000).toISOString();
      const mockEmailData = {
        subject: 'Test Email',
        message: 'Test message',
        sendToAll: false,
        recipients: [1],
        action: 'schedule' as const,
        scheduledDate: futureDate,
      };
      const mockError = new Error('Database error');

      (emailDb.updateEmailStatus as jest.Mock).mockResolvedValueOnce(undefined); // for schedule
      (emailDb.updateEmailStatus as jest.Mock).mockRejectedValueOnce(mockError); // for cancel

      await emailService.scheduleEmail(1, mockEmailData);

      await expect(emailService.cancelScheduledEmail(1)).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'cancelScheduledEmail');
    });
  });

  describe('getActiveScheduledJobs', () => {
    it('should return empty array when no jobs are scheduled', () => {
      const result = emailService.getActiveScheduledJobs();
      expect(result).toEqual([]);
    });

    it('should return array of scheduled email IDs', async () => {
      const futureDate1 = new Date(Date.now() + 10000).toISOString();
      const futureDate2 = new Date(Date.now() + 20000).toISOString();

      (emailDb.updateEmailStatus as jest.Mock).mockResolvedValue(undefined);

      await emailService.scheduleEmail(1, {
        subject: 'Test 1',
        message: 'Test',
        sendToAll: false,
        recipients: [1],
        action: 'schedule' as const,
        scheduledDate: futureDate1,
      });

      await emailService.scheduleEmail(2, {
        subject: 'Test 2',
        message: 'Test',
        sendToAll: false,
        recipients: [1],
        action: 'schedule' as const,
        scheduledDate: futureDate2,
      });

      const result = emailService.getActiveScheduledJobs();
      expect(result).toEqual(expect.arrayContaining([1, 2]));
      expect(result.length).toBe(2);
    });
  });
});
