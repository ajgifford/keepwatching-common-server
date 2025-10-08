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
});
