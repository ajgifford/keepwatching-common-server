import { mockEmailRecipients } from './helpers/fixtures';
import { cleanupScheduledJobs, setupEmailDbMocks, setupMocks } from './helpers/mocks';
import * as emailDb from '@db/emailDb';
import { appLogger } from '@logger/logger';
import { emailDeliveryService } from '@services/email/emailDeliveryService';
import { emailService } from '@services/emailService';
import { errorService } from '@services/errorService';
import { type Mock, afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('EmailService - Email Orchestration', () => {
  beforeEach(() => {
    setupMocks();
    setupEmailDbMocks();
  });

  afterEach(() => {
    cleanupScheduledJobs(emailService);
  });

  describe('sendScheduleOrSaveEmail', () => {
    it('should send email immediately when action is "send"', async () => {
      const mockEmailData = {
        subject: 'Test Email',
        message: 'Test message',
        sendToAll: false,
        recipients: [1, 2],
        action: 'send' as const,
        scheduledDate: null,
      };

      (emailDb.getEmailRecipients as Mock).mockResolvedValue(mockEmailRecipients);
      (emailDeliveryService.sendEmail as Mock).mockResolvedValue(undefined);

      const result = await emailService.sendScheduleOrSaveEmail(mockEmailData);

      expect(result).toBe(true);
      expect(emailDb.createEmail).toHaveBeenCalledWith({
        subject: 'Test Email',
        message: 'Test message',
        sent_to_all: false,
        account_count: 2,
        scheduled_date: null,
        sent_date: null,
        status: 'pending',
      });
      expect(emailDb.createEmailRecipients).toHaveBeenCalled();
      expect(emailDeliveryService.sendEmail).toHaveBeenCalledTimes(2);
      expect(appLogger.info).toHaveBeenCalledWith('Email sent', { subject: 'Test Email' });
    });

    it('should schedule email when action is "schedule"', async () => {
      const futureDate = new Date(Date.now() + 10000).toISOString();
      const mockEmailData = {
        subject: 'Test Email',
        message: 'Test message',
        sendToAll: false,
        recipients: [1],
        action: 'schedule' as const,
        scheduledDate: futureDate,
      };

      const result = await emailService.sendScheduleOrSaveEmail(mockEmailData);

      expect(result).toBe(true);
      expect(emailDb.updateEmailStatus).toHaveBeenCalledWith(1, null, 'scheduled');
      expect(appLogger.info).toHaveBeenCalledWith('Email scheduled', {
        subject: 'Test Email',
        scheduledDate: futureDate,
      });
    });

    it('should save email as draft when action is "draft"', async () => {
      const mockEmailData = {
        subject: 'Test Email',
        message: 'Test message',
        sendToAll: false,
        recipients: [1],
        action: 'draft' as const,
        scheduledDate: null,
      };

      const result = await emailService.sendScheduleOrSaveEmail(mockEmailData);

      expect(result).toBe(true);
      expect(appLogger.info).toHaveBeenCalledWith('Email draft saved', { subject: 'Test Email' });
    });

    it('should throw error if email creation fails', async () => {
      const mockEmailData = {
        subject: 'Test Email',
        message: 'Test message',
        sendToAll: false,
        recipients: [1],
        action: 'draft' as const,
        scheduledDate: null,
      };

      (emailDb.createEmail as Mock).mockResolvedValue(0);

      await expect(emailService.sendScheduleOrSaveEmail(mockEmailData)).rejects.toThrow(
        'Failed to save email record to database',
      );
    });

    it('should handle error and rethrow', async () => {
      const mockError = new Error('Database error');
      const mockEmailData = {
        subject: 'Test Email',
        message: 'Test message',
        sendToAll: false,
        recipients: [1],
        action: 'draft' as const,
        scheduledDate: null,
      };

      (emailDb.createEmail as Mock).mockRejectedValue(mockError);

      await expect(emailService.sendScheduleOrSaveEmail(mockEmailData)).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'sendScheduleOrSaveEmail');
    });
  });
});
