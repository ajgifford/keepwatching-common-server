import * as emailDb from '../db/emailDb';
import { appLogger, cliLogger } from '../logger/logger';
import { BadRequestError, NotFoundError } from '../middleware/errorMiddleware';
import { CreateEmailRow, EmailContentResult } from '../types/emailTypes';
import { emailContentService } from './email/emailContentService';
import { emailDeliveryService } from './email/emailDeliveryService';
import { errorService } from './errorService';
import {
  CreateEmail,
  CreateEmailRecipient,
  CreateEmailTemplate,
  EmailTemplate,
  UpdateEmailTemplate,
} from '@ajgifford/keepwatching-types';

export class EmailService {
  private scheduledJobs: Map<number, NodeJS.Timeout> = new Map();

  /**
   * Verify email connection
   */
  public async verifyConnection(): Promise<boolean> {
    return emailDeliveryService.verifyConnection();
  }

  /**
   * Send weekly digest emails to all accounts
   */
  public async sendWeeklyDigests(): Promise<void> {
    try {
      cliLogger.info('Starting weekly digest email job');
      appLogger.info('Weekly digest email job started');

      const { digestEmails, discoveryEmails } = await emailContentService.generateBatchEmailContent();

      let digestResults = { sent: 0, failed: 0, errors: [] as Array<{ email: string; error: Error }> };
      let discoveryResults = { sent: 0, failed: 0, errors: [] as Array<{ email: string; error: Error }> };

      // Send digest emails
      if (digestEmails.length > 0) {
        const digestEmailRecord: CreateEmailRow = {
          subject: `Your Weekly Watch Guide`,
          message: 'Weekly digest email with upcoming content',
          sent_to_all: false,
          account_count: digestEmails.length,
          scheduled_date: null,
          sent_date: null,
          status: 'pending',
        };
        const digestEmailId = await emailDb.createEmail(digestEmailRecord);

        if (digestEmailId > 0) {
          const digestRecipients: CreateEmailRecipient[] = digestEmails.map((email) => ({
            email_id: digestEmailId,
            account_id: email.accountId,
            status: 'pending',
            sent_at: null,
            error_message: null,
          }));
          await emailDb.createEmailRecipients(digestRecipients);

          digestResults = await emailDeliveryService.sendDigestEmailBatch(
            digestEmails,
            digestEmailId,
            async (accountId: number, success: boolean, error?: string) => {
              try {
                if (success) {
                  await emailDb.updateEmailRecipientStatus(digestEmailId, accountId, new Date().toISOString(), 'sent');
                } else {
                  await emailDb.updateEmailRecipientStatusFailure(digestEmailId, accountId, error || 'Unknown error');
                }
              } catch (dbError) {
                appLogger.error('Failed to update email recipient status', {
                  emailId: digestEmailId,
                  accountId,
                  success,
                  error: dbError instanceof Error ? dbError.message : String(dbError),
                });
              }
            },
          );

          const finalStatus = digestResults.failed === 0 ? 'sent' : digestResults.sent > 0 ? 'sent' : 'failed';
          try {
            await emailDb.updateEmailStatus(digestEmailId, new Date().toISOString(), finalStatus);
          } catch (dbError) {
            appLogger.error('Failed to update email status', {
              emailId: digestEmailId,
              finalStatus,
              error: dbError instanceof Error ? dbError.message : String(dbError),
            });
          }
        }
      }

      // Send discovery emails
      if (discoveryEmails.length > 0) {
        const discoveryEmailRecord: CreateEmailRow = {
          subject: '🎬 Discover Something New This Week',
          message: 'Weekly discovery email with featured content',
          sent_to_all: false,
          account_count: discoveryEmails.length,
          scheduled_date: null,
          sent_date: null,
          status: 'pending',
        };
        const discoveryEmailId = await emailDb.createEmail(discoveryEmailRecord);

        if (discoveryEmailId > 0) {
          const discoveryRecipients: CreateEmailRecipient[] = discoveryEmails.map((email) => ({
            email_id: discoveryEmailId,
            account_id: email.accountId,
            status: 'pending',
            sent_at: null,
            error_message: null,
          }));
          await emailDb.createEmailRecipients(discoveryRecipients);

          discoveryResults = await emailDeliveryService.sendDiscoveryEmailBatch(
            discoveryEmails,
            discoveryEmailId,
            async (accountId: number, success: boolean, error?: string) => {
              try {
                if (success) {
                  await emailDb.updateEmailRecipientStatus(
                    discoveryEmailId,
                    accountId,
                    new Date().toISOString(),
                    'sent',
                  );
                } else {
                  await emailDb.updateEmailRecipientStatusFailure(
                    discoveryEmailId,
                    accountId,
                    error || 'Unknown error',
                  );
                }
              } catch (dbError) {
                appLogger.error('Failed to update email recipient status', {
                  emailId: discoveryEmailId,
                  accountId,
                  success,
                  error: dbError instanceof Error ? dbError.message : String(dbError),
                });
              }
            },
          );

          const finalStatus = discoveryResults.failed === 0 ? 'sent' : discoveryResults.sent > 0 ? 'sent' : 'failed';
          try {
            await emailDb.updateEmailStatus(discoveryEmailId, new Date().toISOString(), finalStatus);
          } catch (dbError) {
            appLogger.error('Failed to update email status', {
              emailId: discoveryEmailId,
              finalStatus,
              error: dbError instanceof Error ? dbError.message : String(dbError),
            });
          }
        }
      }

      const totalSent = digestResults.sent + discoveryResults.sent;
      const totalFailed = digestResults.failed + discoveryResults.failed;

      cliLogger.info(`Weekly email job completed: ${totalSent} sent, ${totalFailed} failed`);
      appLogger.info('Weekly email job completed', {
        digestEmails: digestEmails.length,
        discoveryEmails: discoveryEmails.length,
        emailsSent: totalSent,
        emailsFailed: totalFailed,
      });

      [...digestResults.errors, ...discoveryResults.errors].forEach(({ email, error }) => {
        appLogger.error('Email delivery failed', { email, error });
      });
    } catch (error) {
      cliLogger.error('Weekly email job failed', error);
      appLogger.error('Weekly email job failed', { error });
      throw errorService.handleError(error, 'sendWeeklyDigests');
    }
  }

  /**
   * Send digest email to a specific account
   */
  public async sendDigestEmailToAccount(accountEmail: string): Promise<void> {
    try {
      const { digestData } = await emailContentService.generateDigestContent(accountEmail);
      await emailDeliveryService.sendDigestEmail(digestData);
      cliLogger.info(`Weekly digest sent to account: ${accountEmail}`);
    } catch (error) {
      throw errorService.handleError(error, `sendDigestEmailToAccount(${accountEmail})`);
    }
  }

  /**
   * Send discovery email to a specific account
   */
  public async sendDiscoveryEmailToAccount(accountEmail: string): Promise<void> {
    try {
      const { discoveryData } = await emailContentService.generateDiscoveryContent(accountEmail);
      await emailDeliveryService.sendDiscoveryEmail(discoveryData);
      cliLogger.info(`Weekly discovery email sent to: ${accountEmail}`);
    } catch (error) {
      throw errorService.handleError(error, `sendDiscoveryEmailToAccount(${accountEmail})`);
    }
  }

  /**
   * Send weekly digest to a specific account regardless of content availability
   * If no upcoming content, sends discovery email instead
   */
  public async sendWeeklyEmailToAccount(
    accountEmail: string,
  ): Promise<{ emailType: 'digest' | 'discovery'; hasContent: boolean }> {
    try {
      const contentResult = await emailContentService.generateEmailContent(accountEmail);

      if (contentResult.emailType === 'digest' && contentResult.digestData) {
        await emailDeliveryService.sendDigestEmail(contentResult.digestData);
        cliLogger.info(`Weekly digest email sent to account: ${accountEmail}`);
        return { emailType: 'digest', hasContent: true };
      } else if (contentResult.emailType === 'discovery' && contentResult.discoveryData) {
        await emailDeliveryService.sendDiscoveryEmail(contentResult.discoveryData);
        cliLogger.info(`Weekly discovery email sent to account: ${accountEmail}`);
        return { emailType: 'discovery', hasContent: false };
      } else {
        throw new Error(`Invalid content result for account: ${accountEmail}`);
      }
    } catch (error) {
      throw errorService.handleError(error, `sendWeeklyEmailToAccount(${accountEmail})`);
    }
  }

  /**
   * Preview weekly digest data for a specific account without sending email
   */
  public async previewWeeklyDigestForAccount(accountEmail: string): Promise<EmailContentResult> {
    try {
      return await emailContentService.generateEmailContent(accountEmail);
    } catch (error) {
      throw errorService.handleError(error, `previewWeeklyDigestForAccount(${accountEmail})`);
    }
  }

  /**
   * Get all email templates
   */
  public async getEmailTemplates(): Promise<EmailTemplate[]> {
    try {
      return await emailDb.getEmailTemplates();
    } catch (error) {
      throw errorService.handleError(error, 'getEmailTemplates');
    }
  }

  /**
   * Create a new email template
   */
  public async createEmailTemplate(template: CreateEmailTemplate): Promise<boolean> {
    try {
      return await emailDb.createEmailTemplate(template);
    } catch (error) {
      throw errorService.handleError(error, 'createEmailTemplate');
    }
  }

  /**
   * Update an existing email template
   */
  public async updateEmailTemplate(template: UpdateEmailTemplate): Promise<boolean> {
    try {
      return await emailDb.updateEmailTemplate(template);
    } catch (error) {
      throw errorService.handleError(error, 'updateEmailTemplate');
    }
  }

  /**
   * Delete an email template
   */
  public async deleteEmailTemplate(templateId: number): Promise<boolean> {
    try {
      return await emailDb.deleteEmailTemplate(templateId);
    } catch (error) {
      throw errorService.handleError(error, 'deleteEmailTemplate');
    }
  }

  /**
   * Get emails with pagination
   */
  public async getAllEmails(page: number, offset: number, limit: number) {
    try {
      const [totalCount, emails] = await Promise.all([
        emailDb.getAllEmailsCount(),
        emailDb.getAllEmails(limit, offset),
      ]);
      const totalPages = Math.ceil(totalCount / limit);
      return {
        emails,
        pagination: {
          totalCount,
          totalPages,
          currentPage: page,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      throw errorService.handleError(error, 'getAllSentEmails');
    }
  }

  /**
   * Send, schedule, or save an email
   */
  public async sendScheduleOrSaveEmail(emailData: CreateEmail): Promise<boolean> {
    try {
      const emailRecord: CreateEmailRow = {
        subject: emailData.subject,
        message: emailData.message,
        sent_to_all: emailData.sendToAll,
        account_count: emailData.recipients.length,
        scheduled_date: emailData.scheduledDate,
        sent_date: null,
        status: 'pending',
      };
      const emailId = await emailDb.createEmail(emailRecord);

      if (emailId === 0) {
        throw new Error('Failed to save email record to database');
      }

      await this.saveRecipients(emailId, emailData.recipients);

      switch (emailData.action) {
        case 'send':
          await this.sendImmediately(emailId, emailData);
          appLogger.info('Email sent', { subject: emailData.subject });
          break;
        case 'schedule':
          await this.scheduleEmail(emailId, emailData);
          appLogger.info('Email scheduled', {
            subject: emailData.subject,
            scheduledDate: emailData.scheduledDate,
          });
          break;
        case 'draft':
          appLogger.info('Email draft saved', { subject: emailData.subject });
          break;
      }

      return true;
    } catch (error) {
      throw errorService.handleError(error, 'sendScheduleOrSaveEmail');
    }
  }

  /**
   * Save email recipients
   */
  public async saveRecipients(emailId: number, recipients: number[]) {
    try {
      const emailRecipients: CreateEmailRecipient[] = recipients.map((recipient) => {
        return { email_id: emailId, account_id: recipient, status: 'pending', sent_at: null, error_message: null };
      });
      await emailDb.createEmailRecipients(emailRecipients);
    } catch (error) {
      throw errorService.handleError(error, 'saveRecipients');
    }
  }

  /**
   * Send an email immediately
   */
  public async sendImmediately(emailId: number, emailData: CreateEmail) {
    try {
      const accounts = await emailDb.getEmailRecipients(emailId);
      for (const account of accounts) {
        let emailSent = false;
        try {
          await emailDeliveryService.sendEmail(account.email, emailData.subject, emailData.message);
          emailSent = true;
          await emailDb.updateEmailRecipientStatus(emailId, account.id, new Date().toISOString(), 'sent');
        } catch (error) {
          // Only update failure status if email actually failed to send
          if (!emailSent) {
            try {
              await emailDb.updateEmailRecipientStatusFailure(
                emailId,
                account.id,
                error instanceof Error ? error.message : String(error),
              );
            } catch (dbError) {
              appLogger.error('Failed to update recipient failure status', {
                emailId,
                accountId: account.id,
                error: dbError instanceof Error ? dbError.message : String(dbError),
              });
            }
          } else {
            // Email sent but DB update failed
            appLogger.error('Email sent but failed to update recipient status', {
              emailId,
              accountId: account.id,
              accountEmail: account.email,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
      try {
        await emailDb.updateEmailStatus(emailId, new Date().toISOString(), 'sent');
      } catch (dbError) {
        appLogger.error('Emails sent but failed to update overall email status', {
          emailId,
          error: dbError instanceof Error ? dbError.message : String(dbError),
        });
      }
    } catch (error) {
      try {
        await emailDb.updateEmailStatus(emailId, null, 'failed');
      } catch (dbError) {
        appLogger.error('Failed to update email status to failed', {
          emailId,
          error: dbError instanceof Error ? dbError.message : String(dbError),
        });
      }
      throw errorService.handleError(error, 'sendImmediately');
    }
  }

  /**
   * Schedule the email for a later time
   */
  public async scheduleEmail(emailId: number, emailData: CreateEmail) {
    try {
      if (!emailData.scheduledDate) {
        throw new BadRequestError('Scheduled date is required for scheduling emails');
      }

      const scheduledDate = new Date(emailData.scheduledDate);
      const now = new Date();

      if (scheduledDate <= now) {
        throw new BadRequestError('Scheduled date must be in the future');
      }

      const delay = scheduledDate.getTime() - now.getTime();
      const timeoutId = setTimeout(async () => {
        try {
          appLogger.info('Executing scheduled email job', {
            emailId,
            subject: emailData.subject,
            scheduledDate: emailData.scheduledDate,
          });

          this.scheduledJobs.delete(emailId);

          await this.sendImmediately(emailId, emailData);

          appLogger.info('Scheduled email sent successfully', {
            emailId,
            subject: emailData.subject,
          });
        } catch (error) {
          appLogger.error('Failed to send scheduled email', {
            emailId,
            subject: emailData.subject,
            error: error instanceof Error ? error.message : String(error),
          });

          this.scheduledJobs.delete(emailId);
          await emailDb.updateEmailStatus(emailId, null, 'failed');
          throw errorService.handleError(error, 'scheduleEmail');
        }
      }, delay);

      this.scheduledJobs.set(emailId, timeoutId);

      await emailDb.updateEmailStatus(emailId, null, 'scheduled');

      appLogger.info('Email job scheduled', {
        emailId,
        subject: emailData.subject,
        scheduledDate: emailData.scheduledDate,
        delayMs: delay,
      });
    } catch (error) {
      await emailDb.updateEmailStatus(emailId, null, 'failed');
      throw errorService.handleError(error, 'scheduleEmail');
    }
  }

  /**
   * Cancel a scheduled email
   */
  public async cancelScheduledEmail(emailId: number): Promise<boolean> {
    try {
      const timeoutId = this.scheduledJobs.get(emailId);

      if (!timeoutId) {
        throw new BadRequestError('No scheduled job found for this email ID');
      }

      clearTimeout(timeoutId);
      this.scheduledJobs.delete(emailId);
      await emailDb.updateEmailStatus(emailId, null, 'draft');
      appLogger.info('Scheduled email job cancelled', { emailId });

      return true;
    } catch (error) {
      throw errorService.handleError(error, 'cancelScheduledEmail');
    }
  }

  /**
   * Get all active scheduled email jobs
   */
  public getActiveScheduledJobs(): number[] {
    return Array.from(this.scheduledJobs.keys());
  }

  /**
   * Delete an email
   */
  public async deleteEmail(id: number): Promise<boolean> {
    try {
      const email = await emailDb.getEmail(id);
      if (!email) {
        throw new NotFoundError(`Email with id ${id} not found`);
      }

      if (email.status === 'scheduled') {
        this.cancelScheduledEmail(id);
      }

      return await emailDb.deleteEmail(id);
    } catch (error) {
      throw errorService.handleError(error, 'deleteSentEmail');
    }
  }
}

export const emailService = new EmailService();
