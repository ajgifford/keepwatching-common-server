import { cleanupScheduledJobs, setupMocks } from './helpers/mocks';
import { emailDeliveryService } from '@services/email/emailDeliveryService';
import { EmailService, emailService } from '@services/emailService';

describe('EmailService - Basic Functionality', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    cleanupScheduledJobs(emailService);
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
});
