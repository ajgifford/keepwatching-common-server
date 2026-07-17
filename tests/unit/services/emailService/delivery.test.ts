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
        headerStyle: 'none' as const,
        footerStyle: 'none' as const,
        headerTitle: null,
        headerSubtitle: null,
        footerNote: null,
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

    it('should render the body with the chosen header/footer style and per-recipient variables', async () => {
      const mockEmailData = {
        subject: 'Hi {{accountName}}',
        message: '<p>Your email is {{accountEmail}}</p>',
        headerStyle: 'gradient' as const,
        footerStyle: 'standard' as const,
        headerTitle: null,
        headerSubtitle: null,
        footerNote: null,
        sendToAll: false,
        recipients: [1, 2],
        action: 'send' as const,
        scheduledDate: null,
      };

      (emailDb.getEmailRecipients as jest.Mock).mockResolvedValue(mockEmailRecipients);
      (emailDeliveryService.sendEmail as jest.Mock).mockResolvedValue(undefined);

      await emailService.sendImmediately(1, mockEmailData);

      expect(emailDeliveryService.sendEmail).toHaveBeenNthCalledWith(
        1,
        'user1@example.com',
        'Hi User One',
        expect.stringContaining('Your email is user1@example.com'),
      );
      const firstCallHtml = (emailDeliveryService.sendEmail as jest.Mock).mock.calls[0][2];
      expect(firstCallHtml).toContain('linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
      expect(firstCallHtml).toContain('Happy watching! 🍿');

      expect(emailDeliveryService.sendEmail).toHaveBeenNthCalledWith(
        2,
        'user2@example.com',
        'Hi User Two',
        expect.stringContaining('Your email is user2@example.com'),
      );
    });

    it('should resolve {{appUrl}} and the "cta" footer link from getClientAppUrl()', async () => {
      const mockEmailData = {
        subject: 'Check it out',
        message: '<p>Visit {{appUrl}}</p>',
        headerStyle: 'none' as const,
        footerStyle: 'cta' as const,
        headerTitle: null,
        headerSubtitle: null,
        footerNote: null,
        sendToAll: false,
        recipients: [1],
        action: 'send' as const,
        scheduledDate: null,
      };

      (emailDb.getEmailRecipients as jest.Mock).mockResolvedValue([mockEmailRecipients[0]]);
      (emailDeliveryService.sendEmail as jest.Mock).mockResolvedValue(undefined);

      await emailService.sendImmediately(1, mockEmailData);

      const renderedHtml = (emailDeliveryService.sendEmail as jest.Mock).mock.calls[0][2];
      expect(renderedHtml).toContain('Visit https://keepwatching.giffordfamilydev.us');
      expect(renderedHtml).toContain('href="https://keepwatching.giffordfamilydev.us/"');
      expect(renderedHtml).toContain('Open KeepWatching');
    });

    it('should apply headerTitle, headerSubtitle, and footerNote overrides per recipient', async () => {
      const mockEmailData = {
        subject: 'Fallback Subject',
        message: '<p>Body</p>',
        headerStyle: 'gradient' as const,
        footerStyle: 'standard' as const,
        headerTitle: 'Hi {{accountName}}, 🎉 big news',
        headerSubtitle: 'From the KeepWatching team',
        footerNote: 'Thanks, {{accountName}}!',
        sendToAll: false,
        recipients: [1],
        action: 'send' as const,
        scheduledDate: null,
      };

      (emailDb.getEmailRecipients as jest.Mock).mockResolvedValue([mockEmailRecipients[0]]);
      (emailDeliveryService.sendEmail as jest.Mock).mockResolvedValue(undefined);

      await emailService.sendImmediately(1, mockEmailData);

      const renderedHtml = (emailDeliveryService.sendEmail as jest.Mock).mock.calls[0][2];
      expect(renderedHtml).toContain('Hi User One, 🎉 big news');
      expect(renderedHtml).not.toContain('Fallback Subject</h1>');
      expect(renderedHtml).toContain('From the KeepWatching team');
      expect(renderedHtml).toContain('Thanks, User One!');
    });

    it('should handle individual recipient failures', async () => {
      const mockEmailData = {
        subject: 'Test Email',
        message: 'Test message',
        headerStyle: 'none' as const,
        footerStyle: 'none' as const,
        headerTitle: null,
        headerSubtitle: null,
        footerNote: null,
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
        headerStyle: 'none' as const,
        footerStyle: 'none' as const,
        headerTitle: null,
        headerSubtitle: null,
        footerNote: null,
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
