import { mockBatchEmailContent } from './helpers/fixtures';
import { cleanupScheduledJobs, setupEmailDbMocks, setupMocks } from './helpers/mocks';
import { appLogger, cliLogger } from '@logger/logger';
import { emailContentService } from '@services/email/emailContentService';
import { emailDeliveryService } from '@services/email/emailDeliveryService';
import { emailService } from '@services/emailService';
import { errorService } from '@services/errorService';

describe('EmailService - Batch Email Sending', () => {
  beforeEach(() => {
    setupMocks();
    setupEmailDbMocks();
  });

  afterEach(() => {
    cleanupScheduledJobs(emailService);
  });

  describe('sendWeeklyDigests', () => {
    it('should send digest and discovery emails successfully', async () => {
      (emailContentService.generateBatchEmailContent as jest.Mock).mockResolvedValue(mockBatchEmailContent);

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
      expect(emailDeliveryService.sendDigestEmailBatch).toHaveBeenCalledWith(
        mockBatchEmailContent.digestEmails,
        1,
        expect.any(Function),
      );
      expect(emailDeliveryService.sendDiscoveryEmailBatch).toHaveBeenCalledWith(
        mockBatchEmailContent.discoveryEmails,
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
});
