import { mockEmailTemplates } from './helpers/fixtures';
import { cleanupScheduledJobs, setupMocks } from './helpers/mocks';
import * as emailDb from '@db/emailDb';
import { emailService } from '@services/emailService';
import { errorService } from '@services/errorService';

describe('EmailService - Template Management', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    cleanupScheduledJobs(emailService);
  });

  describe('getEmailTemplates', () => {
    it('should return all email templates', async () => {
      (emailDb.getEmailTemplates as jest.Mock).mockResolvedValue(mockEmailTemplates);

      const result = await emailService.getEmailTemplates();

      expect(emailDb.getEmailTemplates).toHaveBeenCalled();
      expect(result).toEqual(mockEmailTemplates);
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
});
