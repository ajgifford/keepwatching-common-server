import * as emailDb from '@db/emailDb';
import { errorService } from '@services/errorService';
import { type Mock, vi } from 'vitest';

vi.mock('@logger/logger');
vi.mock('@services/errorService');
vi.mock('@db/emailDb');

vi.mock('@services/email/emailDeliveryService', () => ({
  emailDeliveryService: {
    verifyConnection: vi.fn(),
    sendDigestEmailBatch: vi.fn(),
    sendDiscoveryEmailBatch: vi.fn(),
    sendDigestEmail: vi.fn(),
    sendDiscoveryEmail: vi.fn(),
    sendEmail: vi.fn(),
  },
}));

vi.mock('@services/email/emailContentService', () => ({
  emailContentService: {
    generateBatchEmailContent: vi.fn(),
    generateDigestContent: vi.fn(),
    generateDiscoveryContent: vi.fn(),
    generateEmailContent: vi.fn(),
  },
}));

/**
 * Sets up common mocks with default behaviors
 */
export function setupMocks() {
  vi.clearAllMocks();

  (errorService.handleError as Mock).mockImplementation((error) => {
    return error;
  });
}

/**
 * Sets up default mock implementations for emailDb functions
 */
export function setupEmailDbMocks() {
  (emailDb.createEmail as Mock).mockResolvedValue(1);
  (emailDb.createEmailRecipients as Mock).mockResolvedValue(undefined);
  (emailDb.updateEmailRecipientStatus as Mock).mockResolvedValue(undefined);
  (emailDb.updateEmailRecipientStatusFailure as Mock).mockResolvedValue(undefined);
  (emailDb.updateEmailStatus as Mock).mockResolvedValue(undefined);
  (emailDb.createEmailRecipient as Mock).mockResolvedValue(undefined);
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
