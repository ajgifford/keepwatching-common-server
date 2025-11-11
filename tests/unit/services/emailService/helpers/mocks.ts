import * as emailDb from '@db/emailDb';
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

/**
 * Sets up common mocks with default behaviors
 */
export function setupMocks() {
  jest.clearAllMocks();

  (errorService.handleError as jest.Mock).mockImplementation((error) => {
    return error;
  });
}

/**
 * Sets up default mock implementations for emailDb functions
 */
export function setupEmailDbMocks() {
  (emailDb.createEmail as jest.Mock).mockResolvedValue(1);
  (emailDb.createEmailRecipients as jest.Mock).mockResolvedValue(undefined);
  (emailDb.updateEmailRecipientStatus as jest.Mock).mockResolvedValue(undefined);
  (emailDb.updateEmailRecipientStatusFailure as jest.Mock).mockResolvedValue(undefined);
  (emailDb.updateEmailStatus as jest.Mock).mockResolvedValue(undefined);
  (emailDb.createEmailRecipient as jest.Mock).mockResolvedValue(undefined);
}

/**
 * Cleanup function to cancel any scheduled jobs
 */
export function cleanupScheduledJobs(emailService: any) {
  const activeJobs = emailService.getActiveScheduledJobs();
  activeJobs.forEach((emailId: number) => {
    try {
      emailService.cancelScheduledEmail(emailId);
    } catch {
      // Ignore errors during cleanup
    }
  });
}
