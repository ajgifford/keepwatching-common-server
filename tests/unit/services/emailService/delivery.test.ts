import { mockEmailRecipients } from './helpers/fixtures';
import { cleanupScheduledJobs, setupEmailDbMocks, setupMocks } from './helpers/mocks';
import * as emailDb from '@db/emailDb';
import { emailDeliveryService } from '@services/email/emailDeliveryService';
import { emailService } from '@services/emailService';
import { errorService } from '@services/errorService';

describe('EmailService - Email Delivery', () => {
  beforeEach(() => {
    setupMocks();
    setupEmailDbMocks();
  });

  afterEach(() => {
    cleanupScheduledJobs(emailService);
  });

  describe('saveRecipients', () => {
    it('should save email recipients', async () => {
      await emailService.saveRecipients(1, [1, 2, 3]);

      expect(emailDb.createEmailRecipients).toHaveBeenCalledWith([
        { email_id: 1, account_id: 1, status: 'pending', sent_at: null, error_message: null },
        { email_id: 1, account_id: 2, status: 'pending', sent_at: null, error_message: null },
        { email_id: 1, account_id: 3, status: 'pending', sent_at: null, error_message: null },
      ]);
    });

    it('should handle error and rethrow', async () => {
      const mockError = new Error('Database error');
      (emailDb.createEmailRecipients as jest.Mock).mockRejectedValue(mockError);

      await expect(emailService.saveRecipients(1, [1, 2])).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'saveRecipients');
    });
  });

  describe('sendImmediately', () => {
    it('should send email to all recipients successfully', async () => {
      const mockEmailData = {
        subject: 'Test Email',
        message: 'Test message',
        sendToAll: false,
        recipients: [1, 2],
        action: 'send' as const,
        scheduledDate: null,
      };

      (emailDb.getEmailRecipients as jest.Mock).mockResolvedValue(mockEmailRecipients);
      (emailDeliveryService.sendEmail as jest.Mock).mockResolvedValue(undefined);

      await emailService.sendImmediately(1, mockEmailData);

      expect(emailDb.getEmailRecipients).toHaveBeenCalledWith(1);
      expect(emailDeliveryService.sendEmail).toHaveBeenCalledTimes(2);
      expect(emailDb.updateEmailRecipientStatus).toHaveBeenCalledTimes(2);
      expect(emailDb.updateEmailStatus).toHaveBeenCalledWith(1, expect.any(String), 'sent');
    });

    it('should handle individual recipient failures', async () => {
      const mockEmailData = {
        subject: 'Test Email',
        message: 'Test message',
        sendToAll: false,
        recipients: [1, 2],
        action: 'send' as const,
        scheduledDate: null,
      };
      const mockError = new Error('Send failed');

      (emailDb.getEmailRecipients as jest.Mock).mockResolvedValue(mockEmailRecipients);
      (emailDeliveryService.sendEmail as jest.Mock).mockRejectedValueOnce(mockError).mockResolvedValueOnce(undefined);

      await emailService.sendImmediately(1, mockEmailData);

      expect(emailDb.updateEmailRecipientStatusFailure).toHaveBeenCalledWith(1, 1, 'Send failed');
      expect(emailDb.updateEmailRecipientStatus).toHaveBeenCalledWith(1, 2, expect.any(String), 'sent');
      expect(emailDb.updateEmailStatus).toHaveBeenCalledWith(1, expect.any(String), 'sent');
    });

    it('should handle error and update status to failed', async () => {
      const mockEmailData = {
        subject: 'Test Email',
        message: 'Test message',
        sendToAll: false,
        recipients: [1],
        action: 'send' as const,
        scheduledDate: null,
      };
      const mockError = new Error('Database error');

      (emailDb.getEmailRecipients as jest.Mock).mockRejectedValue(mockError);

      await expect(emailService.sendImmediately(1, mockEmailData)).rejects.toThrow(mockError);
      expect(emailDb.updateEmailStatus).toHaveBeenCalledWith(1, null, 'failed');
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'sendImmediately');
    });
  });
});
