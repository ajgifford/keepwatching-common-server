import { mockSentEmails } from './helpers/fixtures';
import { cleanupScheduledJobs, setupMocks } from './helpers/mocks';
import * as emailDb from '@db/emailDb';
import { emailService } from '@services/emailService';
import { errorService } from '@services/errorService';
import { type Mock, afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('EmailService - Email Management', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    cleanupScheduledJobs(emailService);
  });

  describe('getAllEmails', () => {
    it('should return emails with pagination', async () => {
      (emailDb.getAllEmailsCount as Mock).mockResolvedValue(25);
      (emailDb.getAllEmails as Mock).mockResolvedValue(mockSentEmails);

      const result = await emailService.getAllEmails(1, 0, 10);

      expect(emailDb.getAllEmailsCount).toHaveBeenCalled();
      expect(emailDb.getAllEmails).toHaveBeenCalledWith(10, 0);
      expect(result).toEqual({
        emails: mockSentEmails,
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

      (emailDb.getAllEmailsCount as Mock).mockResolvedValue(25);
      (emailDb.getAllEmails as Mock).mockResolvedValue(mockEmails);

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
      (emailDb.getAllEmailsCount as Mock).mockRejectedValue(mockError);

      await expect(emailService.getAllEmails(1, 0, 10)).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'getAllSentEmails');
    });
  });

  describe('deleteEmail', () => {
    it('should delete a draft email', async () => {
      (emailDb.getEmail as Mock).mockResolvedValue({ id: 1, status: 'draft' });
      (emailDb.deleteEmail as Mock).mockResolvedValue(true);

      const result = await emailService.deleteEmail(1);

      expect(emailDb.getEmail).toHaveBeenCalledWith(1);
      expect(emailDb.deleteEmail).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('should cancel and delete a scheduled email', async () => {
      const futureDate = new Date(Date.now() + 10000).toISOString();

      (emailDb.updateEmailStatus as Mock).mockResolvedValue(undefined);

      // Schedule an email first
      await emailService.scheduleEmail(1, {
        subject: 'Test',
        message: 'Test',
        sendToAll: false,
        recipients: [1],
        action: 'schedule' as const,
        scheduledDate: futureDate,
      });

      (emailDb.getEmail as Mock).mockResolvedValue({ id: 1, status: 'scheduled' });
      (emailDb.deleteEmail as Mock).mockResolvedValue(true);

      const result = await emailService.deleteEmail(1);

      expect(emailDb.deleteEmail).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('should throw NotFoundError if email does not exist', async () => {
      (emailDb.getEmail as Mock).mockResolvedValue(null);

      await expect(emailService.deleteEmail(999)).rejects.toThrow('Email with id 999 not found');
    });

    it('should handle error and rethrow', async () => {
      const mockError = new Error('Database error');
      (emailDb.getEmail as Mock).mockRejectedValue(mockError);

      await expect(emailService.deleteEmail(1)).rejects.toThrow(mockError);
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'deleteSentEmail');
    });
  });
});
