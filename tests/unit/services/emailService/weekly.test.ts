import { mockDigestContentResult, mockDigestData, mockDiscoveryData } from './helpers/fixtures';
import { cleanupScheduledJobs, setupEmailDbMocks, setupMocks } from './helpers/mocks';
import * as emailDb from '@db/emailDb';
import { cliLogger } from '@logger/logger';
import { emailContentService } from '@services/email/emailContentService';
import { emailDeliveryService } from '@services/email/emailDeliveryService';
import { emailService } from '@services/emailService';
import { errorService } from '@services/errorService';
import { type Mock, afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('EmailService - Weekly Email Operations', () => {
  beforeEach(() => {
    setupMocks();
    setupEmailDbMocks();
  });

  afterEach(() => {
    cleanupScheduledJobs(emailService);
  });

  describe('sendWeeklyEmailToAccount', () => {
    it('should send digest email when content result is digest type', async () => {
      const mockContentResult = {
        emailType: 'digest' as const,
        digestData: mockDigestData,
        discoveryData: null,
      };

      (emailContentService.generateEmailContent as Mock).mockResolvedValue(mockContentResult);

      const result = await emailService.sendWeeklyEmailToAccount('john@example.com');

      expect(emailContentService.generateEmailContent).toHaveBeenCalledWith('john@example.com');
      expect(emailDb.createEmail).toHaveBeenCalledWith({
        subject: 'Your Weekly Watch Guide - 2025-06-02 to 2025-06-08',
        message: 'Weekly digest email sent to single account',
        sent_to_all: false,
        account_count: 1,
        scheduled_date: null,
        sent_date: null,
        status: 'pending',
      });
      expect(emailDeliveryService.sendDigestEmail).toHaveBeenCalledWith(mockDigestData);
      expect(result).toEqual({ emailType: 'digest', hasContent: true });
      expect(cliLogger.info).toHaveBeenCalledWith('Weekly digest email sent to account: john@example.com');
    });

    it('should send discovery email when content result is discovery type', async () => {
      const mockContentResult = {
        emailType: 'discovery' as const,
        digestData: null,
        discoveryData: mockDiscoveryData,
      };

      (emailContentService.generateEmailContent as Mock).mockResolvedValue(mockContentResult);

      const result = await emailService.sendWeeklyEmailToAccount('john@example.com');

      expect(emailContentService.generateEmailContent).toHaveBeenCalledWith('john@example.com');
      expect(emailDb.createEmail).toHaveBeenCalledWith({
        subject: '🎬 Discover Something New This Week - 2025-06-02 to 2025-06-08',
        message: 'Weekly discovery email sent to single account',
        sent_to_all: false,
        account_count: 1,
        scheduled_date: null,
        sent_date: null,
        status: 'pending',
      });
      expect(emailDeliveryService.sendDiscoveryEmail).toHaveBeenCalledWith(mockDiscoveryData);
      expect(result).toEqual({ emailType: 'discovery', hasContent: false });
      expect(cliLogger.info).toHaveBeenCalledWith('Weekly discovery email sent to account: john@example.com');
    });

    it('should handle digest email send failure and update status', async () => {
      const mockContentResult = {
        emailType: 'digest' as const,
        digestData: mockDigestData,
        discoveryData: null,
      };
      const mockError = new Error('Email delivery failed');

      (emailContentService.generateEmailContent as Mock).mockResolvedValue(mockContentResult);
      (emailDeliveryService.sendDigestEmail as Mock).mockRejectedValue(mockError);

      await expect(emailService.sendWeeklyEmailToAccount('john@example.com')).rejects.toThrow(mockError);

      expect(emailDb.updateEmailRecipientStatusFailure).toHaveBeenCalledWith(1, 1, 'Email delivery failed');
      expect(emailDb.updateEmailStatus).toHaveBeenCalledWith(1, null, 'failed');
    });

    it('should handle discovery email send failure and update status', async () => {
      const mockContentResult = {
        emailType: 'discovery' as const,
        digestData: null,
        discoveryData: mockDiscoveryData,
      };
      const mockError = new Error('Email delivery failed');

      (emailContentService.generateEmailContent as Mock).mockResolvedValue(mockContentResult);
      (emailDeliveryService.sendDiscoveryEmail as Mock).mockRejectedValue(mockError);

      await expect(emailService.sendWeeklyEmailToAccount('john@example.com')).rejects.toThrow(mockError);

      expect(emailDb.updateEmailRecipientStatusFailure).toHaveBeenCalledWith(1, 2, 'Email delivery failed');
      expect(emailDb.updateEmailStatus).toHaveBeenCalledWith(1, null, 'failed');
    });

    it('should throw error if digest email record creation fails', async () => {
      const mockContentResult = {
        emailType: 'digest' as const,
        digestData: mockDigestData,
        discoveryData: null,
      };

      (emailContentService.generateEmailContent as Mock).mockResolvedValue(mockContentResult);
      (emailDb.createEmail as Mock).mockResolvedValue(0);

      await expect(emailService.sendWeeklyEmailToAccount('john@example.com')).rejects.toThrow(
        'Failed to create email record',
      );
    });

    it('should throw error if discovery email record creation fails', async () => {
      const mockContentResult = {
        emailType: 'discovery' as const,
        digestData: null,
        discoveryData: mockDiscoveryData,
      };

      (emailContentService.generateEmailContent as Mock).mockResolvedValue(mockContentResult);
      (emailDb.createEmail as Mock).mockResolvedValue(0);

      await expect(emailService.sendWeeklyEmailToAccount('john@example.com')).rejects.toThrow(
        'Failed to create email record',
      );
    });

    it('should throw error for invalid content result', async () => {
      const mockContentResult = {
        emailType: 'digest' as const,
        digestData: null,
        discoveryData: null,
      };

      (emailContentService.generateEmailContent as Mock).mockResolvedValue(mockContentResult);

      await expect(emailService.sendWeeklyEmailToAccount('john@example.com')).rejects.toThrow(
        'Invalid content result for account: john@example.com',
      );
    });

    it('should handle error and rethrow', async () => {
      const mockError = new Error('Content generation failed');
      (emailContentService.generateEmailContent as Mock).mockRejectedValue(mockError);

      await expect(emailService.sendWeeklyEmailToAccount('john@example.com')).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'sendWeeklyEmailToAccount(john@example.com)');
    });
  });

  describe('previewWeeklyDigestForAccount', () => {
    it('should return email content result', async () => {
      (emailContentService.generateEmailContent as Mock).mockResolvedValue(mockDigestContentResult);

      const result = await emailService.previewWeeklyDigestForAccount('john@example.com');

      expect(emailContentService.generateEmailContent).toHaveBeenCalledWith('john@example.com');
      expect(result).toEqual(mockDigestContentResult);
    });

    it('should handle error and rethrow', async () => {
      const mockError = new Error('Content generation failed');
      (emailContentService.generateEmailContent as Mock).mockRejectedValue(mockError);

      await expect(emailService.previewWeeklyDigestForAccount('john@example.com')).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        'previewWeeklyDigestForAccount(john@example.com)',
      );
    });
  });
});
