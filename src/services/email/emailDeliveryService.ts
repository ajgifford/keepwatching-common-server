import { EmailConfig, getEmailConfig } from '../../config';
import { appLogger, cliLogger } from '../../logger/logger';
import { DigestEmail, DiscoveryEmail, WelcomeEmail } from '../../types/emailTypes';
import {
  generateDiscoveryEmailHTML,
  generateDiscoveryEmailText,
  generateWeeklyDigestHTML,
  generateWeeklyDigestText,
  generateWelcomeEmailHTML,
  generateWelcomeEmailText,
} from '../../utils/emailUtility';
import { errorService } from '../errorService';
import nodemailer from 'nodemailer';

/**
 * Service responsible for email transport and delivery
 */
export class EmailDeliveryService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;

  /**
   * Constructor accepts optional dependencies for testing
   */
  constructor(dependencies?: { config?: EmailConfig; transporter?: nodemailer.Transporter }) {
    this.config = dependencies?.config ?? getEmailConfig();
    this.transporter =
      dependencies?.transporter ??
      nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
      });
  }

  /**
   * Verify email connection
   */
  public async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      cliLogger.info('Email service connection verified successfully');
      return true;
    } catch (error) {
      cliLogger.error('Email service connection failed', error);
      return false;
    }
  }

  /**
   * Send weekly digest email
   */
  public async sendDigestEmail(emailData: DigestEmail): Promise<void> {
    try {
      const htmlContent = generateWeeklyDigestHTML(emailData);
      const textContent = generateWeeklyDigestText(emailData);

      const mailOptions = {
        from: this.config.from,
        to: emailData.to,
        subject: `Your Weekly Watch Guide - ${emailData.weekRange.start} to ${emailData.weekRange.end}`,
        html: htmlContent,
        text: textContent,
      };

      await this.transporter.sendMail(mailOptions);
      cliLogger.info(`Digest email sent to: ${emailData.to}`);
    } catch (error) {
      const enhancedError = errorService.handleError(error, `sendDigestEmail(${emailData.to})`);
      appLogger.error('Digest email failed', {
        email: emailData.to,
        error: enhancedError,
      });
      throw enhancedError;
    }
  }

  /**
   * Send welcome email
   */
  public async sendWelcomeEmail(emailData: WelcomeEmail): Promise<void> {
    try {
      const htmlContent = generateWelcomeEmailHTML(emailData);
      const textContent = generateWelcomeEmailText(emailData);

      const mailOptions = {
        from: this.config.from,
        to: emailData.to,
        subject: `Welcome to KeepWatching!`,
        html: htmlContent,
        text: textContent,
      };

      await this.transporter.sendMail(mailOptions);
      cliLogger.info(`Welcome email sent to: ${emailData.to}`);
    } catch (error) {
      const enhancedError = errorService.handleError(error, `sendWelcomeEmail(${emailData.to})`);
      appLogger.error('Welcome email failed', {
        email: emailData.to,
        error: enhancedError,
      });
      throw enhancedError;
    }
  }

  /**
   * Send weekly content discovery email
   */
  public async sendDiscoveryEmail(emailData: DiscoveryEmail): Promise<void> {
    try {
      const htmlContent = generateDiscoveryEmailHTML(emailData);
      const textContent = generateDiscoveryEmailText(emailData);

      const mailOptions = {
        from: this.config.from,
        to: emailData.to,
        subject: `🎬 Discover Something New This Week - ${emailData.data.weekRange.start} to ${emailData.data.weekRange.end}`,
        html: htmlContent,
        text: textContent,
      };

      await this.transporter.sendMail(mailOptions);
      cliLogger.info(`Discovery email sent to: ${emailData.to}`);
    } catch (error) {
      const enhancedError = errorService.handleError(error, `sendDiscoveryEmail(${emailData.to})`);
      appLogger.error('Discovery email failed', {
        email: emailData.to,
        error: enhancedError,
      });
      throw enhancedError;
    }
  }

  /**
   * Send an email
   */
  public async sendEmail(to: string, subject?: string, content?: string): Promise<void> {
    try {
      const mailOptions = {
        from: this.config.from,
        to,
        subject: subject || 'Test Email from KeepWatching',
        html: content || '<p>This is a test email to verify email delivery is working.</p>',
        text: content || 'This is a test email to verify email delivery is working.',
      };

      await this.transporter.sendMail(mailOptions);
      cliLogger.info(`Test email sent to: ${to}`);
    } catch (error) {
      const enhancedError = errorService.handleError(error, `sendTestEmail(${to})`);
      appLogger.error('Test email failed', {
        email: to,
        error: enhancedError,
      });
      throw enhancedError;
    }
  }

  /**
   * Send batch of digest emails
   */
  public async sendDigestEmailBatch(
    emails: DigestEmail[],
    emailId: number,
    updateStatus: (accountId: number, success: boolean, error?: string) => Promise<void>,
  ): Promise<{
    sent: number;
    failed: number;
    errors: Array<{ email: string; error: Error }>;
  }> {
    let sent = 0;
    let failed = 0;
    const errors: Array<{ email: string; error: Error }> = [];

    for (const email of emails) {
      try {
        await this.sendDigestEmail(email);
        await updateStatus(email.accountId, true);
        sent++;
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        await updateStatus(email.accountId, false, errorMessage);
        errors.push({ email: email.to, error: error as Error });
        cliLogger.error(`Failed to send digest email to: ${email.to}`, error);
      }
    }

    return { sent, failed, errors };
  }

  /**
   * Send batch of discovery emails
   */
  public async sendDiscoveryEmailBatch(
    emails: DiscoveryEmail[],
    emailId: number,
    updateStatus: (accountId: number, success: boolean, error?: string) => Promise<void>,
  ): Promise<{
    sent: number;
    failed: number;
    errors: Array<{ email: string; error: Error }>;
  }> {
    let sent = 0;
    let failed = 0;
    const errors: Array<{ email: string; error: Error }> = [];

    for (const email of emails) {
      try {
        await this.sendDiscoveryEmail(email);
        await updateStatus(email.accountId, true);
        sent++;
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        await updateStatus(email.accountId, false, errorMessage);
        errors.push({ email: email.to, error: error as Error });
        cliLogger.error(`Failed to send discovery email to: ${email.to}`, error);
      }
    }

    return { sent, failed, errors };
  }

  /**
   * Get email configuration (for debugging/monitoring)
   */
  public getConfig(): Omit<EmailConfig, 'auth'> {
    return {
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      from: this.config.from,
    };
  }
}

/**
 * Factory function for creating new instances
 * Use this in tests to create isolated instances with mocked dependencies
 */
export function createEmailDeliveryService(dependencies?: {
  config?: EmailConfig;
  transporter?: nodemailer.Transporter;
}): EmailDeliveryService {
  return new EmailDeliveryService(dependencies);
}

/**
 * Singleton instance for production use
 */
let instance: EmailDeliveryService | null = null;

/**
 * Get or create singleton instance
 * Use this in production code
 */
export function getEmailDeliveryService(): EmailDeliveryService {
  if (!instance) {
    instance = createEmailDeliveryService();
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 * Call this in beforeEach/afterEach to ensure test isolation
 */
export function resetEmailDeliveryService(): void {
  instance = null;
}

/**
 * Backward-compatible default export
 * Existing code using `import { emailDeliveryService }` continues to work
 */
export const emailDeliveryService = getEmailDeliveryService();
