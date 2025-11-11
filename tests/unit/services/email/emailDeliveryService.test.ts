import { DigestEmail, DiscoveryEmail } from '../../../../src/types/emailTypes';
import { EmailConfig } from '@config/config';
import { appLogger, cliLogger } from '@logger/logger';
import {
  EmailDeliveryService,
  createEmailDeliveryService,
  resetEmailDeliveryService,
} from '@services/email/emailDeliveryService';
import { errorService } from '@services/errorService';
import * as emailUtility from '@utils/emailUtility';
import nodemailer from 'nodemailer';

// Mock dependencies
jest.mock('nodemailer');
jest.mock('@logger/logger');
jest.mock('@services/errorService');
jest.mock('@utils/emailUtility');

const mockSendMail = jest.fn();
const mockVerify = jest.fn();
const mockTransporter = {
  sendMail: mockSendMail,
  verify: mockVerify,
};

describe('EmailDeliveryService', () => {
  let emailDeliveryService: EmailDeliveryService;
  let mockConfig: EmailConfig;

  const mockDigestEmail: DigestEmail = {
    to: 'test@example.com',
    accountName: 'Test User',
    profiles: [],
    weekRange: { start: '2025-08-01', end: '2025-08-07' },
    accountId: 0,
  };

  const mockDiscoveryEmail: DiscoveryEmail = {
    to: 'test@example.com',
    accountName: 'Test User',
    data: {
      accountName: 'Test User',
      profiles: [],
      featuredContent: {
        trendingShows: [],
        newReleases: [],
        popularMovies: [],
      },
      weekRange: { start: '2025-08-01', end: '2025-08-07' },
    },
    accountId: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetEmailDeliveryService();

    mockConfig = {
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      auth: {
        user: 'test@example.com',
        pass: 'testpass',
      },
      from: 'noreply@test.com',
    };

    // Set up nodemailer.createTransport mock
    jest.mocked(nodemailer.createTransport).mockReturnValue(mockTransporter as any);

    emailDeliveryService = createEmailDeliveryService({ config: mockConfig });

    (errorService.handleError as jest.Mock).mockImplementation((error) => error);
  });

  afterEach(() => {
    resetEmailDeliveryService();
  });

  describe('constructor', () => {
    it('should create transporter with correct configuration', () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: mockConfig.host,
        port: mockConfig.port,
        secure: mockConfig.secure,
        auth: mockConfig.auth,
      });
    });
  });

  describe('verifyConnection', () => {
    it('should return true when connection is successful', async () => {
      mockVerify.mockResolvedValue(true);

      const result = await emailDeliveryService.verifyConnection();

      expect(result).toBe(true);
      expect(mockVerify).toHaveBeenCalled();
      expect(cliLogger.info).toHaveBeenCalledWith('Email service connection verified successfully');
    });

    it('should return false and log error when connection fails', async () => {
      const error = new Error('Connection failed');
      mockVerify.mockRejectedValue(error);

      const result = await emailDeliveryService.verifyConnection();

      expect(result).toBe(false);
      expect(cliLogger.error).toHaveBeenCalledWith('Email service connection failed', error);
    });
  });

  describe('sendDigestEmail', () => {
    beforeEach(() => {
      (emailUtility.generateWeeklyDigestHTML as jest.Mock).mockReturnValue('<html>digest</html>');
      (emailUtility.generateWeeklyDigestText as jest.Mock).mockReturnValue('digest text');
    });

    it('should send digest email successfully', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });

      await emailDeliveryService.sendDigestEmail(mockDigestEmail);

      expect(emailUtility.generateWeeklyDigestHTML).toHaveBeenCalledWith(mockDigestEmail);
      expect(emailUtility.generateWeeklyDigestText).toHaveBeenCalledWith(mockDigestEmail);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: mockConfig.from,
        to: mockDigestEmail.to,
        subject: `Your Weekly Watch Guide - ${mockDigestEmail.weekRange.start} to ${mockDigestEmail.weekRange.end}`,
        html: '<html>digest</html>',
        text: 'digest text',
      });
      expect(cliLogger.info).toHaveBeenCalledWith(`Digest email sent to: ${mockDigestEmail.to}`);
    });

    it('should handle email sending failure', async () => {
      const sendError = new Error('Email sending failed');
      mockSendMail.mockRejectedValue(sendError);

      await expect(emailDeliveryService.sendDigestEmail(mockDigestEmail)).rejects.toThrow(sendError);

      expect(errorService.handleError).toHaveBeenCalledWith(sendError, `sendDigestEmail(${mockDigestEmail.to})`);
      expect(appLogger.error).toHaveBeenCalledWith('Digest email failed', {
        email: mockDigestEmail.to,
        error: sendError,
      });
    });
  });

  describe('sendDiscoveryEmail', () => {
    beforeEach(() => {
      (emailUtility.generateDiscoveryEmailHTML as jest.Mock).mockReturnValue('<html>discovery</html>');
      (emailUtility.generateDiscoveryEmailText as jest.Mock).mockReturnValue('discovery text');
    });

    it('should send discovery email successfully', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });

      await emailDeliveryService.sendDiscoveryEmail(mockDiscoveryEmail);

      expect(emailUtility.generateDiscoveryEmailHTML).toHaveBeenCalledWith(mockDiscoveryEmail);
      expect(emailUtility.generateDiscoveryEmailText).toHaveBeenCalledWith(mockDiscoveryEmail);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: mockConfig.from,
        to: mockDiscoveryEmail.to,
        subject: `🎬 Discover Something New This Week - ${mockDiscoveryEmail.data.weekRange.start} to ${mockDiscoveryEmail.data.weekRange.end}`,
        html: '<html>discovery</html>',
        text: 'discovery text',
      });
      expect(cliLogger.info).toHaveBeenCalledWith(`Discovery email sent to: ${mockDiscoveryEmail.to}`);
    });

    it('should handle email sending failure', async () => {
      const sendError = new Error('Email sending failed');
      mockSendMail.mockRejectedValue(sendError);

      await expect(emailDeliveryService.sendDiscoveryEmail(mockDiscoveryEmail)).rejects.toThrow(sendError);

      expect(errorService.handleError).toHaveBeenCalledWith(sendError, `sendDiscoveryEmail(${mockDiscoveryEmail.to})`);
      expect(appLogger.error).toHaveBeenCalledWith('Discovery email failed', {
        email: mockDiscoveryEmail.to,
        error: sendError,
      });
    });
  });

  describe('sendTestEmail', () => {
    it('should send test email with default content', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });

      await emailDeliveryService.sendEmail('test@example.com');

      expect(mockSendMail).toHaveBeenCalledWith({
        from: mockConfig.from,
        to: 'test@example.com',
        subject: 'Test Email from KeepWatching',
        html: '<p>This is a test email to verify email delivery is working.</p>',
        text: 'This is a test email to verify email delivery is working.',
      });
      expect(cliLogger.info).toHaveBeenCalledWith('Test email sent to: test@example.com');
    });

    it('should send test email with custom content', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });

      await emailDeliveryService.sendEmail('test@example.com', 'Custom Subject', 'Custom content');

      expect(mockSendMail).toHaveBeenCalledWith({
        from: mockConfig.from,
        to: 'test@example.com',
        subject: 'Custom Subject',
        html: 'Custom content',
        text: 'Custom content',
      });
    });
  });

  describe('sendDigestEmailBatch', () => {
    it('should send batch of digest emails successfully', async () => {
      const emails = [mockDigestEmail, { ...mockDigestEmail, to: 'test2@example.com' }];
      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });
      const mockUpdateStatus = jest.fn().mockResolvedValue(undefined);

      const result = await emailDeliveryService.sendDigestEmailBatch(emails, 1, mockUpdateStatus);

      expect(result).toEqual({
        sent: 2,
        failed: 0,
        errors: [],
      });
      expect(mockSendMail).toHaveBeenCalledTimes(2);
      expect(mockUpdateStatus).toHaveBeenCalledTimes(2);
      expect(mockUpdateStatus).toHaveBeenCalledWith(0, true);
    });

    it('should handle partial failures in batch', async () => {
      const emails = [mockDigestEmail, { ...mockDigestEmail, to: 'test2@example.com' }];
      const sendError = new Error('Send failed');
      const mockUpdateStatus = jest.fn().mockResolvedValue(undefined);

      mockSendMail.mockResolvedValueOnce({ messageId: 'success' }).mockRejectedValueOnce(sendError);

      const result = await emailDeliveryService.sendDigestEmailBatch(emails, 1, mockUpdateStatus);

      expect(result).toEqual({
        sent: 1,
        failed: 1,
        errors: [{ email: 'test2@example.com', error: sendError }],
      });
      expect(mockUpdateStatus).toHaveBeenCalledTimes(2);
      expect(mockUpdateStatus).toHaveBeenCalledWith(0, true);
      expect(mockUpdateStatus).toHaveBeenCalledWith(0, false, 'Send failed');
    });
  });

  describe('sendDiscoveryEmailBatch', () => {
    it('should send batch of discovery emails successfully', async () => {
      const emails = [mockDiscoveryEmail, { ...mockDiscoveryEmail, to: 'test2@example.com' }];
      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });
      const mockUpdateStatus = jest.fn().mockResolvedValue(undefined);

      const result = await emailDeliveryService.sendDiscoveryEmailBatch(emails, 1, mockUpdateStatus);

      expect(result).toEqual({
        sent: 2,
        failed: 0,
        errors: [],
      });
      expect(mockSendMail).toHaveBeenCalledTimes(2);
      expect(mockUpdateStatus).toHaveBeenCalledTimes(2);
      expect(mockUpdateStatus).toHaveBeenCalledWith(0, true);
    });
  });

  describe('getConfig', () => {
    it('should return config without auth credentials', () => {
      const config = emailDeliveryService.getConfig();

      expect(config).toEqual({
        host: mockConfig.host,
        port: mockConfig.port,
        secure: mockConfig.secure,
        from: mockConfig.from,
      });
      expect(config).not.toHaveProperty('auth');
    });
  });
});
