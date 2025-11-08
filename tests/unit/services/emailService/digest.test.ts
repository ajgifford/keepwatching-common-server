import { mockDigestData } from './helpers/fixtures';
import { cleanupScheduledJobs, setupEmailDbMocks, setupMocks } from './helpers/mocks';
import * as emailDb from '@db/emailDb';
import { cliLogger } from '@logger/logger';
import { emailContentService } from '@services/email/emailContentService';
import { emailDeliveryService } from '@services/email/emailDeliveryService';
import { emailService } from '@services/emailService';
import { errorService } from '@services/errorService';
import { type Mock, afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('EmailService - Digest Email Sending', () => {
  beforeEach(() => {
    setupMocks();
    setupEmailDbMocks();
  });

  afterEach(() => {
    cleanupScheduledJobs(emailService);
  });

  describe('sendDigestEmailToAccount', () => {
    it('should send digest email to specific account', async () => {
      (emailContentService.generateDigestContent as Mock).mockResolvedValue({ digestData: mockDigestData });

      await emailService.sendDigestEmailToAccount('john@example.com');

      expect(emailContentService.generateDigestContent).toHaveBeenCalledWith('john@example.com');
      expect(emailDb.createEmail).toHaveBeenCalledWith({
        subject: 'Your Weekly Watch Guide - 2025-06-02 to 2025-06-08',
        message: 'Weekly digest email sent to single account',
        sent_to_all: false,
        account_count: 1,
        scheduled_date: null,
        sent_date: null,
        status: 'pending',
      });
      expect(emailDb.createEmailRecipient).toHaveBeenCalledWith({
        email_id: 1,
        account_id: 1,
        status: 'pending',
        sent_at: null,
        error_message: null,
      });
      expect(emailDeliveryService.sendDigestEmail).toHaveBeenCalledWith(mockDigestData);
      expect(emailDb.updateEmailRecipientStatus).toHaveBeenCalledWith(1, 1, expect.any(String), 'sent');
      expect(emailDb.updateEmailStatus).toHaveBeenCalledWith(1, expect.any(String), 'sent');
      expect(cliLogger.info).toHaveBeenCalledWith('Weekly digest sent to account: john@example.com');
    });

    it('should handle email send failure and update status', async () => {
      const mockError = new Error('Email delivery failed');

      (emailContentService.generateDigestContent as Mock).mockResolvedValue({ digestData: mockDigestData });
      (emailDeliveryService.sendDigestEmail as Mock).mockRejectedValue(mockError);

      await expect(emailService.sendDigestEmailToAccount('john@example.com')).rejects.toThrow(mockError);

      expect(emailDb.updateEmailRecipientStatusFailure).toHaveBeenCalledWith(1, 1, 'Email delivery failed');
      expect(emailDb.updateEmailStatus).toHaveBeenCalledWith(1, null, 'failed');
    });

    it('should throw error if email record creation fails', async () => {
      (emailContentService.generateDigestContent as Mock).mockResolvedValue({ digestData: mockDigestData });
      (emailDb.createEmail as Mock).mockResolvedValue(0);

      await expect(emailService.sendDigestEmailToAccount('john@example.com')).rejects.toThrow(
        'Failed to create email record',
      );
    });

    it('should handle error and rethrow', async () => {
      const mockError = new Error('Content generation failed');
      (emailContentService.generateDigestContent as Mock).mockRejectedValue(mockError);

      await expect(emailService.sendDigestEmailToAccount('john@example.com')).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'sendDigestEmailToAccount(john@example.com)');
    });
  });
});
