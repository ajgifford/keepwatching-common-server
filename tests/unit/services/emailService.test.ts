import { EmailContentResult } from '../../../src/types/emailTypes';
import * as emailDb from '@db/emailDb';
import { appLogger, cliLogger } from '@logger/logger';
import { emailContentService } from '@services/email/emailContentService';
import { emailDeliveryService } from '@services/email/emailDeliveryService';
import { EmailService, emailService } from '@services/emailService';
import { errorService } from '@services/errorService';

jest.mock('@logger/logger');
jest.mock('@services/errorService');
jest.mock('@db/emailDb');

jest.mock('@services/email/emailDeliveryService', () => ({
  emailDeliveryService: {
    verifyConnection: jest.fn(),
    sendDigestEmailBatch: jest.fn(),
    sendDiscoveryEmailBatch: jest.fn(),
    sendDigestEmail: jest.fn(),
    sendDiscoveryEmail: jest.fn(),
    sendEmail: jest.fn(),
  },
}));

jest.mock('@services/email/emailContentService', () => ({
  emailContentService: {
    generateBatchEmailContent: jest.fn(),
    generateDigestContent: jest.fn(),
    generateDiscoveryContent: jest.fn(),
    generateEmailContent: jest.fn(),
  },
}));

describe('EmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (errorService.handleError as jest.Mock).mockImplementation((error) => {
      throw error;
    });
  });

  describe('constructor', () => {
    it('should create EmailService instance', () => {
      const service = new EmailService();
      expect(service).toBeInstanceOf(EmailService);
    });
  });

  describe('shared instance', () => {
    it('should export a shared emailService instance', () => {
      expect(emailService).toBeInstanceOf(EmailService);
    });
  });

  describe('verifyConnection', () => {
    it('should return true when connection is successful', async () => {
      (emailDeliveryService.verifyConnection as jest.Mock).mockResolvedValue(true);

      const result = await emailService.verifyConnection();

      expect(result).toBe(true);
      expect(emailDeliveryService.verifyConnection).toHaveBeenCalled();
    });

    it('should return false when connection fails', async () => {
      (emailDeliveryService.verifyConnection as jest.Mock).mockResolvedValue(false);

      const result = await emailService.verifyConnection();

      expect(result).toBe(false);
      expect(emailDeliveryService.verifyConnection).toHaveBeenCalled();
    });
  });

  describe('sendWeeklyDigests', () => {
    beforeEach(() => {
      jest.clearAllMocks();

      // Mock emailDb functions
      (emailDb.createEmail as jest.Mock).mockResolvedValue(1);
      (emailDb.createEmailRecipients as jest.Mock).mockResolvedValue(undefined);
      (emailDb.updateEmailRecipientStatus as jest.Mock).mockResolvedValue(undefined);
      (emailDb.updateEmailRecipientStatusFailure as jest.Mock).mockResolvedValue(undefined);
      (emailDb.updateEmailStatus as jest.Mock).mockResolvedValue(undefined);
    });

    it('should send digest and discovery emails successfully', async () => {
      const mockDigestEmails = [
        {
          to: 'user1@example.com',
          accountName: 'User 1',
          accountId: 1,
          profiles: [],
          weekRange: { start: '2025-06-02', end: '2025-06-08' },
        },
        {
          to: 'user2@example.com',
          accountName: 'User 2',
          accountId: 2,
          profiles: [],
          weekRange: { start: '2025-06-02', end: '2025-06-08' },
        },
      ];
      const mockDiscoveryEmails = [
        {
          to: 'user3@example.com',
          accountName: 'User 3',
          accountId: 3,
          trendingShows: [],
          newReleases: [],
          popularMovies: [],
          data: { weekRange: { start: '2025-06-02', end: '2025-06-08' } },
        },
      ];

      (emailContentService.generateBatchEmailContent as jest.Mock).mockResolvedValue({
        digestEmails: mockDigestEmails,
        discoveryEmails: mockDiscoveryEmails,
      });

      (emailDeliveryService.sendDigestEmailBatch as jest.Mock).mockImplementation(async (emails, emailId, callback) => {
        for (const email of emails) {
          await callback(email.accountId, true);
        }
        return { sent: 2, failed: 0, errors: [] };
      });

      (emailDeliveryService.sendDiscoveryEmailBatch as jest.Mock).mockImplementation(
        async (emails, emailId, callback) => {
          for (const email of emails) {
            await callback(email.accountId, true);
          }
          return { sent: 1, failed: 0, errors: [] };
        },
      );

      await emailService.sendWeeklyDigests();

      expect(cliLogger.info).toHaveBeenCalledWith('Starting weekly digest email job');
      expect(appLogger.info).toHaveBeenCalledWith('Weekly digest email job started');
      expect(emailContentService.generateBatchEmailContent).toHaveBeenCalled();
      expect(emailDeliveryService.sendDigestEmailBatch).toHaveBeenCalledWith(mockDigestEmails, 1, expect.any(Function));
      expect(emailDeliveryService.sendDiscoveryEmailBatch).toHaveBeenCalledWith(
        mockDiscoveryEmails,
        1,
        expect.any(Function),
      );
      expect(cliLogger.info).toHaveBeenCalledWith('Weekly email job completed: 3 sent, 0 failed');
      expect(appLogger.info).toHaveBeenCalledWith('Weekly email job completed', {
        digestEmails: 2,
        discoveryEmails: 1,
        emailsSent: 3,
        emailsFailed: 0,
      });
    });

    it('should handle email sending failures gracefully', async () => {
      const mockError = new Error('Failed to send');
      const mockDigestEmails = [
        {
          to: 'user1@example.com',
          accountName: 'User 1',
          accountId: 1,
          profiles: [],
          weekRange: { start: '2025-06-02', end: '2025-06-08' },
        },
      ];
      const mockDiscoveryEmails = [
        {
          to: 'user2@example.com',
          accountName: 'User 2',
          accountId: 2,
          trendingShows: [],
          newReleases: [],
          popularMovies: [],
          data: { weekRange: { start: '2025-06-02', end: '2025-06-08' } },
        },
      ];

      (emailContentService.generateBatchEmailContent as jest.Mock).mockResolvedValue({
        digestEmails: mockDigestEmails,
        discoveryEmails: mockDiscoveryEmails,
      });

      (emailDeliveryService.sendDigestEmailBatch as jest.Mock).mockImplementation(async (emails, emailId, callback) => {
        for (const email of emails) {
          await callback(email.accountId, false, mockError.message);
        }
        return {
          sent: 0,
          failed: 1,
          errors: [{ email: 'user1@example.com', error: mockError }],
        };
      });

      (emailDeliveryService.sendDiscoveryEmailBatch as jest.Mock).mockImplementation(
        async (emails, emailId, callback) => {
          for (const email of emails) {
            await callback(email.accountId, false, mockError.message);
          }
          return {
            sent: 0,
            failed: 1,
            errors: [{ email: 'user2@example.com', error: mockError }],
          };
        },
      );

      await emailService.sendWeeklyDigests();

      expect(cliLogger.info).toHaveBeenCalledWith('Weekly email job completed: 0 sent, 2 failed');
      expect(appLogger.error).toHaveBeenCalledWith('Email delivery failed', {
        email: 'user1@example.com',
        error: mockError,
      });
      expect(appLogger.error).toHaveBeenCalledWith('Email delivery failed', {
        email: 'user2@example.com',
        error: mockError,
      });
    });

    it('should handle and rethrow error', async () => {
      const mockError = new Error('Generate failed');
      (emailContentService.generateBatchEmailContent as jest.Mock).mockRejectedValue(mockError);

      await expect(emailService.sendWeeklyDigests()).rejects.toThrow(mockError);

      expect(cliLogger.error).toHaveBeenCalledWith('Weekly email job failed', mockError);
      expect(appLogger.error).toHaveBeenCalledWith('Weekly email job failed', { error: mockError });
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'sendWeeklyDigests');
    });
  });

  describe('sendDigestEmailToAccount', () => {
    it('should send digest email to specific account', async () => {
      const mockDigestData = {
        to: 'john@example.com',
        accountName: 'John Doe',
        profiles: [],
        weekRange: { start: '2025-06-02', end: '2025-06-08' },
      };

      (emailContentService.generateDigestContent as jest.Mock).mockResolvedValue({ digestData: mockDigestData });
      (emailDeliveryService.sendDigestEmail as jest.Mock).mockResolvedValue(undefined);

      await emailService.sendDigestEmailToAccount('john@example.com');

      expect(emailContentService.generateDigestContent).toHaveBeenCalledWith('john@example.com');
      expect(emailDeliveryService.sendDigestEmail).toHaveBeenCalledWith(mockDigestData);
      expect(cliLogger.info).toHaveBeenCalledWith('Weekly digest sent to account: john@example.com');
    });

    it('should handle error and rethrow', async () => {
      const mockError = new Error('Content generation failed');
      (emailContentService.generateDigestContent as jest.Mock).mockRejectedValue(mockError);

      await expect(emailService.sendDigestEmailToAccount('john@example.com')).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'sendDigestEmailToAccount(john@example.com)');
    });
  });

  describe('sendDiscoveryEmailToAccount', () => {
    it('should send discovery email to specific account', async () => {
      const mockDiscoveryData = {
        to: 'john@example.com',
        accountName: 'John Doe',
        trendingShows: [],
        newReleases: [],
        popularMovies: [],
      };

      (emailContentService.generateDiscoveryContent as jest.Mock).mockResolvedValue({
        discoveryData: mockDiscoveryData,
      });
      (emailDeliveryService.sendDiscoveryEmail as jest.Mock).mockResolvedValue(undefined);

      await emailService.sendDiscoveryEmailToAccount('john@example.com');

      expect(emailContentService.generateDiscoveryContent).toHaveBeenCalledWith('john@example.com');
      expect(emailDeliveryService.sendDiscoveryEmail).toHaveBeenCalledWith(mockDiscoveryData);
      expect(cliLogger.info).toHaveBeenCalledWith('Weekly discovery email sent to: john@example.com');
    });

    it('should handle error and rethrow', async () => {
      const mockError = new Error('Content generation failed');
      (emailContentService.generateDiscoveryContent as jest.Mock).mockRejectedValue(mockError);

      await expect(emailService.sendDiscoveryEmailToAccount('john@example.com')).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'sendDiscoveryEmailToAccount(john@example.com)');
    });
  });

  describe('sendWeeklyEmailToAccount', () => {
    it('should send digest email when content result is digest type', async () => {
      const mockDigestData = {
        to: 'john@example.com',
        accountName: 'John Doe',
        profiles: [],
        weekRange: { start: '2025-06-02', end: '2025-06-08' },
      };

      const mockContentResult = {
        emailType: 'digest' as const,
        digestData: mockDigestData,
        discoveryData: null,
      };

      (emailContentService.generateEmailContent as jest.Mock).mockResolvedValue(mockContentResult);
      (emailDeliveryService.sendDigestEmail as jest.Mock).mockResolvedValue(undefined);

      const result = await emailService.sendWeeklyEmailToAccount('john@example.com');

      expect(emailContentService.generateEmailContent).toHaveBeenCalledWith('john@example.com');
      expect(emailDeliveryService.sendDigestEmail).toHaveBeenCalledWith(mockDigestData);
      expect(result).toEqual({ emailType: 'digest', hasContent: true });
      expect(cliLogger.info).toHaveBeenCalledWith('Weekly digest email sent to account: john@example.com');
    });

    it('should send discovery email when content result is discovery type', async () => {
      const mockDiscoveryData = {
        to: 'john@example.com',
        accountName: 'John Doe',
        trendingShows: [],
        newReleases: [],
        popularMovies: [],
      };

      const mockContentResult = {
        emailType: 'discovery' as const,
        digestData: null,
        discoveryData: mockDiscoveryData,
      };

      (emailContentService.generateEmailContent as jest.Mock).mockResolvedValue(mockContentResult);
      (emailDeliveryService.sendDiscoveryEmail as jest.Mock).mockResolvedValue(undefined);

      const result = await emailService.sendWeeklyEmailToAccount('john@example.com');

      expect(emailContentService.generateEmailContent).toHaveBeenCalledWith('john@example.com');
      expect(emailDeliveryService.sendDiscoveryEmail).toHaveBeenCalledWith(mockDiscoveryData);
      expect(result).toEqual({ emailType: 'discovery', hasContent: false });
      expect(cliLogger.info).toHaveBeenCalledWith('Weekly discovery email sent to account: john@example.com');
    });

    it('should throw error for invalid content result', async () => {
      const mockContentResult = {
        emailType: 'digest' as const,
        digestData: null,
        discoveryData: null,
      };

      (emailContentService.generateEmailContent as jest.Mock).mockResolvedValue(mockContentResult);

      await expect(emailService.sendWeeklyEmailToAccount('john@example.com')).rejects.toThrow(
        'Invalid content result for account: john@example.com',
      );
    });

    it('should handle error and rethrow', async () => {
      const mockError = new Error('Content generation failed');
      (emailContentService.generateEmailContent as jest.Mock).mockRejectedValue(mockError);

      await expect(emailService.sendWeeklyEmailToAccount('john@example.com')).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'sendWeeklyEmailToAccount(john@example.com)');
    });
  });

  describe('previewWeeklyDigestForAccount', () => {
    it('should return email content result', async () => {
      const mockContentResult: EmailContentResult = {
        account: { email: 'john@example.com', name: 'John Doe' },
        emailType: 'digest',
        profileCount: 1,
        profilesWithContent: 1,
        profileAnalyses: [],
        digestData: {
          to: 'john@example.com',
          accountName: 'John Doe',
          profiles: [],
          weekRange: { start: '2025-06-02', end: '2025-06-08' },
          accountId: 0,
        },
      };

      (emailContentService.generateEmailContent as jest.Mock).mockResolvedValue(mockContentResult);

      const result = await emailService.previewWeeklyDigestForAccount('john@example.com');

      expect(emailContentService.generateEmailContent).toHaveBeenCalledWith('john@example.com');
      expect(result).toEqual(mockContentResult);
    });

    it('should handle error and rethrow', async () => {
      const mockError = new Error('Content generation failed');
      (emailContentService.generateEmailContent as jest.Mock).mockRejectedValue(mockError);

      await expect(emailService.previewWeeklyDigestForAccount('john@example.com')).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        'previewWeeklyDigestForAccount(john@example.com)',
      );
    });
  });

  describe('getEmailTemplates', () => {
    it('should return all email templates', async () => {
      const mockTemplates = [
        {
          id: 1,
          name: 'Welcome',
          subject: 'Welcome!',
          body: 'Hello',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
        {
          id: 2,
          name: 'Reminder',
          subject: 'Reminder',
          body: "Don't forget",
          created_at: '2025-01-02',
          updated_at: '2025-01-02',
        },
      ];

      (emailDb.getEmailTemplates as jest.Mock).mockResolvedValue(mockTemplates);

      const result = await emailService.getEmailTemplates();

      expect(emailDb.getEmailTemplates).toHaveBeenCalled();
      expect(result).toEqual(mockTemplates);
    });

    it('should handle error and rethrow', async () => {
      const mockError = new Error('Database error');
      (emailDb.getEmailTemplates as jest.Mock).mockRejectedValue(mockError);

      await expect(emailService.getEmailTemplates()).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getEmailTemplates');
    });
  });

  describe('createEmailTemplate', () => {
    it('should create a new email template', async () => {
      const mockTemplate = {
        name: 'Welcome',
        subject: 'Welcome!',
        message: 'Hello',
      };

      (emailDb.createEmailTemplate as jest.Mock).mockResolvedValue(true);

      const result = await emailService.createEmailTemplate(mockTemplate);

      expect(emailDb.createEmailTemplate).toHaveBeenCalledWith(mockTemplate);
      expect(result).toBe(true);
    });

    it('should handle error and rethrow', async () => {
      const mockTemplate = {
        name: 'Welcome',
        subject: 'Welcome!',
        message: 'Hello',
      };
      const mockError = new Error('Database error');
      (emailDb.createEmailTemplate as jest.Mock).mockRejectedValue(mockError);

      await expect(emailService.createEmailTemplate(mockTemplate)).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'createEmailTemplate');
    });
  });

  describe('updateEmailTemplate', () => {
    it('should update an existing email template', async () => {
      const mockTemplate = {
        id: 1,
        name: 'Welcome',
        subject: 'Welcome Updated!',
        message: 'Hello there',
      };

      (emailDb.updateEmailTemplate as jest.Mock).mockResolvedValue(true);

      const result = await emailService.updateEmailTemplate(mockTemplate);

      expect(emailDb.updateEmailTemplate).toHaveBeenCalledWith(mockTemplate);
      expect(result).toBe(true);
    });

    it('should handle error and rethrow', async () => {
      const mockTemplate = {
        id: 1,
        name: 'Welcome',
        subject: 'Welcome Updated!',
        message: 'Hello there',
      };
      const mockError = new Error('Database error');
      (emailDb.updateEmailTemplate as jest.Mock).mockRejectedValue(mockError);

      await expect(emailService.updateEmailTemplate(mockTemplate)).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'updateEmailTemplate');
    });
  });

  describe('deleteEmailTemplate', () => {
    it('should delete an email template', async () => {
      (emailDb.deleteEmailTemplate as jest.Mock).mockResolvedValue(true);

      const result = await emailService.deleteEmailTemplate(1);

      expect(emailDb.deleteEmailTemplate).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('should handle error and rethrow', async () => {
      const mockError = new Error('Database error');
      (emailDb.deleteEmailTemplate as jest.Mock).mockRejectedValue(mockError);

      await expect(emailService.deleteEmailTemplate(1)).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'deleteEmailTemplate');
    });
  });

  describe('getAllEmails', () => {
    it('should return emails with pagination', async () => {
      const mockEmails = [
        { id: 1, subject: 'Email 1', message: 'Message 1', status: 'sent' },
        { id: 2, subject: 'Email 2', message: 'Message 2', status: 'sent' },
      ];

      (emailDb.getAllEmailsCount as jest.Mock).mockResolvedValue(25);
      (emailDb.getAllEmails as jest.Mock).mockResolvedValue(mockEmails);

      const result = await emailService.getAllEmails(1, 0, 10);

      expect(emailDb.getAllEmailsCount).toHaveBeenCalled();
      expect(emailDb.getAllEmails).toHaveBeenCalledWith(10, 0);
      expect(result).toEqual({
        emails: mockEmails,
        pagination: {
          totalCount: 25,
          totalPages: 3,
          currentPage: 1,
          limit: 10,
          hasNextPage: true,
          hasPrevPage: false,
        },
      });
    });

    it('should calculate pagination correctly for last page', async () => {
      const mockEmails = [{ id: 1, subject: 'Email 1', message: 'Message 1', status: 'sent' }];

      (emailDb.getAllEmailsCount as jest.Mock).mockResolvedValue(25);
      (emailDb.getAllEmails as jest.Mock).mockResolvedValue(mockEmails);

      const result = await emailService.getAllEmails(3, 20, 10);

      expect(result.pagination).toEqual({
        totalCount: 25,
        totalPages: 3,
        currentPage: 3,
        limit: 10,
        hasNextPage: false,
        hasPrevPage: true,
      });
    });

    it('should handle error and rethrow', async () => {
      const mockError = new Error('Database error');
      (emailDb.getAllEmailsCount as jest.Mock).mockRejectedValue(mockError);

      await expect(emailService.getAllEmails(1, 0, 10)).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getAllSentEmails');
    });
  });

  describe('sendScheduleOrSaveEmail', () => {
    beforeEach(() => {
      (emailDb.createEmail as jest.Mock).mockResolvedValue(1);
      (emailDb.createEmailRecipients as jest.Mock).mockResolvedValue(undefined);
    });

    it('should send email immediately when action is "send"', async () => {
      const mockEmailData = {
        subject: 'Test Email',
        message: 'Test message',
        sendToAll: false,
        recipients: [1, 2],
        action: 'send' as const,
        scheduledDate: null,
      };

      (emailDb.getEmailRecipients as jest.Mock).mockResolvedValue([
        { id: 1, email: 'user1@example.com' },
        { id: 2, email: 'user2@example.com' },
      ]);
      (emailDeliveryService.sendEmail as jest.Mock).mockResolvedValue(undefined);
      (emailDb.updateEmailRecipientStatus as jest.Mock).mockResolvedValue(undefined);
      (emailDb.updateEmailStatus as jest.Mock).mockResolvedValue(undefined);

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

      (emailDb.updateEmailStatus as jest.Mock).mockResolvedValue(undefined);

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

      (emailDb.createEmail as jest.Mock).mockResolvedValue(0);

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

      (emailDb.createEmail as jest.Mock).mockRejectedValue(mockError);

      await expect(emailService.sendScheduleOrSaveEmail(mockEmailData)).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'sendScheduleOrSaveEmail');
    });
  });

  describe('saveRecipients', () => {
    it('should save email recipients', async () => {
      (emailDb.createEmailRecipients as jest.Mock).mockResolvedValue(undefined);

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

      (emailDb.getEmailRecipients as jest.Mock).mockResolvedValue([
        { id: 1, email: 'user1@example.com' },
        { id: 2, email: 'user2@example.com' },
      ]);
      (emailDeliveryService.sendEmail as jest.Mock).mockResolvedValue(undefined);
      (emailDb.updateEmailRecipientStatus as jest.Mock).mockResolvedValue(undefined);
      (emailDb.updateEmailStatus as jest.Mock).mockResolvedValue(undefined);

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

      (emailDb.getEmailRecipients as jest.Mock).mockResolvedValue([
        { id: 1, email: 'user1@example.com' },
        { id: 2, email: 'user2@example.com' },
      ]);
      (emailDeliveryService.sendEmail as jest.Mock).mockRejectedValueOnce(mockError).mockResolvedValueOnce(undefined);
      (emailDb.updateEmailRecipientStatusFailure as jest.Mock).mockResolvedValue(undefined);
      (emailDb.updateEmailRecipientStatus as jest.Mock).mockResolvedValue(undefined);
      (emailDb.updateEmailStatus as jest.Mock).mockResolvedValue(undefined);

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
      (emailDb.updateEmailStatus as jest.Mock).mockResolvedValue(undefined);

      await expect(emailService.sendImmediately(1, mockEmailData)).rejects.toThrow(mockError);
      expect(emailDb.updateEmailStatus).toHaveBeenCalledWith(1, null, 'failed');
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'sendImmediately');
    });
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

  describe('deleteEmail', () => {
    it('should delete a draft email', async () => {
      (emailDb.getEmail as jest.Mock).mockResolvedValue({ id: 1, status: 'draft' });
      (emailDb.deleteEmail as jest.Mock).mockResolvedValue(true);

      const result = await emailService.deleteEmail(1);

      expect(emailDb.getEmail).toHaveBeenCalledWith(1);
      expect(emailDb.deleteEmail).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('should cancel and delete a scheduled email', async () => {
      const futureDate = new Date(Date.now() + 10000).toISOString();

      (emailDb.updateEmailStatus as jest.Mock).mockResolvedValue(undefined);

      // Schedule an email first
      await emailService.scheduleEmail(1, {
        subject: 'Test',
        message: 'Test',
        sendToAll: false,
        recipients: [1],
        action: 'schedule' as const,
        scheduledDate: futureDate,
      });

      (emailDb.getEmail as jest.Mock).mockResolvedValue({ id: 1, status: 'scheduled' });
      (emailDb.deleteEmail as jest.Mock).mockResolvedValue(true);

      const result = await emailService.deleteEmail(1);

      expect(emailDb.deleteEmail).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('should throw NotFoundError if email does not exist', async () => {
      (emailDb.getEmail as jest.Mock).mockResolvedValue(null);

      await expect(emailService.deleteEmail(999)).rejects.toThrow('Email with id 999 not found');
    });

    it('should handle error and rethrow', async () => {
      const mockError = new Error('Database error');
      (emailDb.getEmail as jest.Mock).mockRejectedValue(mockError);

      await expect(emailService.deleteEmail(1)).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'deleteSentEmail');
    });
  });
});
