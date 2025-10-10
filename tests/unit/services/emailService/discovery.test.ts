import { mockDiscoveryData } from './helpers/fixtures';
import { cleanupScheduledJobs, setupEmailDbMocks, setupMocks } from './helpers/mocks';
import * as emailDb from '@db/emailDb';
import { cliLogger } from '@logger/logger';
import { emailContentService } from '@services/email/emailContentService';
import { emailDeliveryService } from '@services/email/emailDeliveryService';
import { emailService } from '@services/emailService';
import { errorService } from '@services/errorService';

describe('EmailService - Discovery Email Sending', () => {
  beforeEach(() => {
    setupMocks();
    setupEmailDbMocks();
  });

  afterEach(() => {
    cleanupScheduledJobs(emailService);
  });

  describe('sendDiscoveryEmailToAccount', () => {
    it('should send discovery email to specific account', async () => {
      (emailContentService.generateDiscoveryContent as jest.Mock).mockResolvedValue({
        discoveryData: mockDiscoveryData,
      });

      await emailService.sendDiscoveryEmailToAccount('john@example.com');

      expect(emailContentService.generateDiscoveryContent).toHaveBeenCalledWith('john@example.com');
      expect(emailDb.createEmail).toHaveBeenCalledWith({
        subject: '🎬 Discover Something New This Week - 2025-06-02 to 2025-06-08',
        message: 'Weekly discovery email sent to single account',
        sent_to_all: false,
        account_count: 1,
        scheduled_date: null,
        sent_date: null,
        status: 'pending',
      });
      expect(emailDb.createEmailRecipient).toHaveBeenCalledWith({
        email_id: 1,
        account_id: 2,
        status: 'pending',
        sent_at: null,
        error_message: null,
      });
      expect(emailDeliveryService.sendDiscoveryEmail).toHaveBeenCalledWith(mockDiscoveryData);
      expect(emailDb.updateEmailRecipientStatus).toHaveBeenCalledWith(1, 2, expect.any(String), 'sent');
      expect(emailDb.updateEmailStatus).toHaveBeenCalledWith(1, expect.any(String), 'sent');
      expect(cliLogger.info).toHaveBeenCalledWith('Weekly discovery email sent to: john@example.com');
    });

    it('should handle email send failure and update status', async () => {
      const mockError = new Error('Email delivery failed');

      (emailContentService.generateDiscoveryContent as jest.Mock).mockResolvedValue({
        discoveryData: mockDiscoveryData,
      });
      (emailDeliveryService.sendDiscoveryEmail as jest.Mock).mockRejectedValue(mockError);

      await expect(emailService.sendDiscoveryEmailToAccount('john@example.com')).rejects.toThrow(mockError);

      expect(emailDb.updateEmailRecipientStatusFailure).toHaveBeenCalledWith(1, 2, 'Email delivery failed');
      expect(emailDb.updateEmailStatus).toHaveBeenCalledWith(1, null, 'failed');
    });

    it('should throw error if email record creation fails', async () => {
      (emailContentService.generateDiscoveryContent as jest.Mock).mockResolvedValue({
        discoveryData: mockDiscoveryData,
      });
      (emailDb.createEmail as jest.Mock).mockResolvedValue(0);

      await expect(emailService.sendDiscoveryEmailToAccount('john@example.com')).rejects.toThrow(
        'Failed to create email record',
      );
    });

    it('should handle error and rethrow', async () => {
      const mockError = new Error('Content generation failed');
      (emailContentService.generateDiscoveryContent as jest.Mock).mockRejectedValue(mockError);

      await expect(emailService.sendDiscoveryEmailToAccount('john@example.com')).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'sendDiscoveryEmailToAccount(john@example.com)');
    });
  });
});
