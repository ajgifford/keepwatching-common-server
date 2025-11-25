import { transformAccountReferenceRow } from '../../../src/types/accountTypes';
import {
  CreateEmailRow,
  UpdateEmailRow,
  transformEmailRow,
  transformEmailTemplateRow,
} from '../../../src/types/emailTypes';
import { setupDatabaseTest } from './helpers/dbTestSetup';
import { CreateEmailRecipient, CreateEmailTemplate, UpdateEmailTemplate } from '@ajgifford/keepwatching-types';
import * as emailDb from '@db/emailDb';
import { handleDatabaseError } from '@utils/errorHandlingUtility';
import { ResultSetHeader } from 'mysql2';

jest.mock('@utils/errorHandlingUtility');

describe('emailDb', () => {
  let mockExecute: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup all database mocks using the helper
    const mocks = setupDatabaseTest();
    mockExecute = mocks.mockExecute;
  });

  describe('getEmailTemplates', () => {
    it('should return transformed email templates', async () => {
      const mockRows = [
        {
          id: 1,
          name: 'Welcome Email',
          subject: 'Welcome!',
          message: 'Welcome to our service!',
          created_at: '2023-01-01 00:00:00',
          updated_at: '2023-01-01 00:00:00',
        },
        {
          id: 2,
          name: 'Reset Password',
          subject: 'Reset Your Password',
          message: 'Click here to reset your password.',
          created_at: '2023-01-02 00:00:00',
          updated_at: '2023-01-02 00:00:00',
        },
      ] as any[];

      mockExecute.mockResolvedValue([mockRows]);

      const result = await emailDb.getEmailTemplates();

      expect(mockExecute).toHaveBeenCalledWith('SELECT * from email_templates');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(transformEmailTemplateRow(mockRows[0]));
      expect(result[1]).toEqual(transformEmailTemplateRow(mockRows[1]));
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database connection failed');
      mockExecute.mockRejectedValue(mockError);

      await emailDb.getEmailTemplates();

      expect(handleDatabaseError).toHaveBeenCalledWith(mockError, 'getting all email templates');
    });
  });

  describe('createEmailTemplate', () => {
    it('should create email template successfully', async () => {
      const emailTemplate: CreateEmailTemplate = {
        name: 'Test Template',
        subject: 'Test Subject',
        message: 'Test Message',
      };

      const mockResult = {
        affectedRows: 1,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.createEmailTemplate(emailTemplate);

      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO email_templates (name, subject, message) VALUES (?, ?, ?)',
        [emailTemplate.name, emailTemplate.subject, emailTemplate.message],
      );
      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      const emailTemplate: CreateEmailTemplate = {
        name: 'Test Template',
        subject: 'Test Subject',
        message: 'Test Message',
      };

      const mockResult = {
        affectedRows: 0,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.createEmailTemplate(emailTemplate);

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      const emailTemplate: CreateEmailTemplate = {
        name: 'Test Template',
        subject: 'Test Subject',
        message: 'Test Message',
      };

      const mockError = new Error('Database connection failed');
      mockExecute.mockRejectedValue(mockError);

      await emailDb.createEmailTemplate(emailTemplate);

      expect(handleDatabaseError).toHaveBeenCalledWith(mockError, 'creating an email template');
    });
  });

  describe('updateEmailTemplate', () => {
    it('should update email template successfully', async () => {
      const emailTemplate: UpdateEmailTemplate = {
        id: 1,
        name: 'Updated Template',
        subject: 'Updated Subject',
        message: 'Updated Message',
      };

      const mockResult = {
        affectedRows: 1,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 1,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.updateEmailTemplate(emailTemplate);

      expect(mockExecute).toHaveBeenCalledWith(
        'UPDATE email_templates SET name = ?, subject = ?, message = ? WHERE id = ?',
        [emailTemplate.name, emailTemplate.subject, emailTemplate.message, emailTemplate.id],
      );
      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      const emailTemplate: UpdateEmailTemplate = {
        id: 999,
        name: 'Updated Template',
        subject: 'Updated Subject',
        message: 'Updated Message',
      };

      const mockResult = {
        affectedRows: 0,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.updateEmailTemplate(emailTemplate);

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      const emailTemplate: UpdateEmailTemplate = {
        id: 1,
        name: 'Updated Template',
        subject: 'Updated Subject',
        message: 'Updated Message',
      };

      const mockError = new Error('Database connection failed');
      mockExecute.mockRejectedValue(mockError);

      await emailDb.updateEmailTemplate(emailTemplate);

      expect(handleDatabaseError).toHaveBeenCalledWith(mockError, 'updating an email template');
    });
  });

  describe('deleteEmailTemplate', () => {
    it('should delete email template successfully', async () => {
      const mockResult = {
        affectedRows: 1,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.deleteEmailTemplate(1);

      expect(mockExecute).toHaveBeenCalledWith('DELETE FROM email_templates WHERE id = ?', [1]);
      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      const mockResult = {
        affectedRows: 0,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.deleteEmailTemplate(999);

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database connection failed');
      mockExecute.mockRejectedValue(mockError);

      await emailDb.deleteEmailTemplate(1);

      expect(handleDatabaseError).toHaveBeenCalledWith(mockError, 'deleting an email template');
    });
  });

  describe('getAllSentEmailsCount', () => {
    it('should return sent emails count', async () => {
      const mockCountResult = [{ total: 42 }];
      mockExecute.mockResolvedValue([mockCountResult]);

      const result = await emailDb.getAllEmailsCount();

      expect(mockExecute).toHaveBeenCalledWith('SELECT COUNT(*) as total FROM emails');
      expect(result).toBe(42);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database connection failed');
      mockExecute.mockRejectedValue(mockError);

      await emailDb.getAllEmailsCount();

      expect(handleDatabaseError).toHaveBeenCalledWith(mockError, 'getting emails count');
    });
  });

  describe('getAllEmails', () => {
    it('should return transformed emails with default parameters', async () => {
      const mockRows = [
        {
          id: 1,
          subject: 'Test Email 1',
          message: 'Test message 1',
          sent_to_all: 1,
          account_count: 100,
          scheduled_date: '2023-01-01 00:00:00',
          sent_date: '2023-01-01 00:00:00',
          status: 'sent',
          created_at: '2023-01-01 00:00:00',
          updated_at: '2023-01-01 00:00:00',
        },
        {
          id: 2,
          subject: 'Test Email 2',
          message: 'Test message 2',
          sent_to_all: 0,
          account_count: 50,
          scheduled_date: '2023-01-02 00:00:00',
          sent_date: '2023-01-02 00:00:00',
          status: 'sent',
          created_at: '2023-01-02 00:00:00',
          updated_at: '2023-01-02 00:00:00',
        },
      ] as any[];

      mockExecute.mockResolvedValue([mockRows]);

      const result = await emailDb.getAllEmails();

      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM emails ORDER BY created_at DESC LIMIT 50 OFFSET 0');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(transformEmailRow(mockRows[0]));
      expect(result[1]).toEqual(transformEmailRow(mockRows[1]));
    });

    it('should return transformed emails with custom parameters', async () => {
      const mockRows = [
        {
          id: 1,
          subject: 'Test Email 1',
          message: 'Test message 1',
          sent_to_all: 1,
          account_count: 100,
          scheduled_date: '2023-01-01 00:00:00',
          sent_date: '2023-01-01 00:00:00',
          status: 'sent',
          created_at: '2023-01-01 00:00:00',
          updated_at: '2023-01-01 00:00:00',
        },
      ] as any[];

      mockExecute.mockResolvedValue([mockRows]);

      const result = await emailDb.getAllEmails(25, 10);

      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM emails ORDER BY created_at DESC LIMIT 25 OFFSET 10');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(transformEmailRow(mockRows[0]));
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database connection failed');
      mockExecute.mockRejectedValue(mockError);

      await emailDb.getAllEmails();

      expect(handleDatabaseError).toHaveBeenCalledWith(mockError, 'getting emails');
    });
  });

  describe('createSentEmail', () => {
    it('should create sent email successfully', async () => {
      const sentEmail: CreateEmailRow = {
        subject: 'Test Subject',
        message: 'Test Message',
        sent_to_all: true,
        account_count: 100,
        scheduled_date: null,
        sent_date: '2023-01-01 00:00:00',
        status: 'pending',
      };

      const mockResult = {
        affectedRows: 1,
        insertId: 101,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.createEmail(sentEmail);

      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO emails (subject, message, sent_to_all, account_count, scheduled_date, sent_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          sentEmail.subject,
          sentEmail.message,
          1, // sentToAll converted to 1
          sentEmail.account_count,
          sentEmail.scheduled_date,
          sentEmail.sent_date,
          sentEmail.status,
        ],
      );
      expect(result).toBe(101);
    });

    it('should create sent email with sentToAll false', async () => {
      const sentEmail: CreateEmailRow = {
        subject: 'Test Subject',
        message: 'Test Message',
        sent_to_all: false,
        account_count: 50,
        scheduled_date: null,
        sent_date: '2023-01-01 00:00:00',
        status: 'pending',
      };

      const mockResult = {
        affectedRows: 1,
        insertId: 102,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.createEmail(sentEmail);

      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO emails (subject, message, sent_to_all, account_count, scheduled_date, sent_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          sentEmail.subject,
          sentEmail.message,
          0, // sentToAll converted to 0
          sentEmail.account_count,
          sentEmail.scheduled_date,
          sentEmail.sent_date,
          sentEmail.status,
        ],
      );
      expect(result).toBe(102);
    });

    it('should return false when no rows affected', async () => {
      const sentEmail: CreateEmailRow = {
        subject: 'Test Subject',
        message: 'Test Message',
        sent_to_all: true,
        account_count: 50,
        scheduled_date: null,
        sent_date: '2023-01-01 00:00:00',
        status: 'pending',
      };

      const mockResult = {
        affectedRows: 0,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.createEmail(sentEmail);

      expect(result).toBe(0);
    });

    it('should handle database errors', async () => {
      const sentEmail: CreateEmailRow = {
        subject: 'Test Subject',
        message: 'Test Message',
        sent_to_all: true,
        account_count: 50,
        scheduled_date: null,
        sent_date: '2023-01-01 00:00:00',
        status: 'pending',
      };

      const mockError = new Error('Database connection failed');
      mockExecute.mockRejectedValue(mockError);

      await emailDb.createEmail(sentEmail);

      expect(handleDatabaseError).toHaveBeenCalledWith(mockError, 'creating an email');
    });
  });

  describe('updateEmail', () => {
    it('should update sent email successfully', async () => {
      const emailSent: UpdateEmailRow = {
        id: 1,
        subject: 'Updated Subject',
        message: 'Updated Message',
        sent_to_all: false,
        account_count: 75,
        scheduled_date: null,
        sent_date: '2023-01-02 00:00:00',
        status: 'sent',
      };

      const mockResult = {
        affectedRows: 1,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 1,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.updateEmail(emailSent);

      expect(mockExecute).toHaveBeenCalledWith(
        'UPDATE emails SET subject = ?, message = ?, sent_to_all = ?, account_count = ?, scheduled_date = ?, sent_date = ?, status = ? WHERE id = ?',
        [
          emailSent.subject,
          emailSent.message,
          0, // sentToAll converted to 0
          emailSent.account_count,
          emailSent.scheduled_date,
          emailSent.sent_date,
          emailSent.status,
          emailSent.id,
        ],
      );
      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      const emailSent: UpdateEmailRow = {
        id: 99,
        subject: 'Updated Subject',
        message: 'Updated Message',
        sent_to_all: false,
        account_count: 75,
        scheduled_date: null,
        sent_date: '2023-01-02 00:00:00',
        status: 'sent',
      };

      const mockResult = {
        affectedRows: 0,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.updateEmail(emailSent);

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      const emailSent: UpdateEmailRow = {
        id: 1,
        subject: 'Updated Subject',
        message: 'Updated Message',
        sent_to_all: false,
        account_count: 75,
        scheduled_date: null,
        sent_date: '2023-01-02 00:00:00',
        status: 'sent',
      };

      const mockError = new Error('Database connection failed');
      mockExecute.mockRejectedValue(mockError);

      await emailDb.updateEmail(emailSent);

      expect(handleDatabaseError).toHaveBeenCalledWith(mockError, 'updating an email');
    });
  });

  describe('updateEmailStatus', () => {
    it('should update sent email status successfully', async () => {
      const id = 1;
      const sentDate = '2023-01-01 12:00:00';
      const status = 'sent';

      const mockResult = {
        affectedRows: 1,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 1,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.updateEmailStatus(id, sentDate, status);

      expect(mockExecute).toHaveBeenCalledWith('UPDATE emails SET sent_date = ?, status = ? WHERE id = ?', [
        sentDate,
        status,
        id,
      ]);
      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      const id = 999;
      const sentDate = '2023-01-01 12:00:00';
      const status = 'sent';

      const mockResult = {
        affectedRows: 0,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.updateEmailStatus(id, sentDate, status);

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      const id = 1;
      const sentDate = '2023-01-01 12:00:00';
      const status = 'sent';

      const mockError = new Error('Database connection failed');
      mockExecute.mockRejectedValue(mockError);

      await emailDb.updateEmailStatus(id, sentDate, status);

      expect(handleDatabaseError).toHaveBeenCalledWith(mockError, 'updating an email status');
    });
  });

  describe('deleteEmail', () => {
    it('should delete sent email successfully', async () => {
      const mockResult = {
        affectedRows: 1,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.deleteEmail(1);

      expect(mockExecute).toHaveBeenCalledWith('DELETE FROM emails WHERE id = ?', [1]);
      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      const mockResult = {
        affectedRows: 0,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.deleteEmail(999);

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database connection failed');
      mockExecute.mockRejectedValue(mockError);

      await emailDb.deleteEmail(1);

      expect(handleDatabaseError).toHaveBeenCalledWith(mockError, 'deleting an email');
    });
  });

  describe('getEmail', () => {
    it('should return transformed email when found', async () => {
      const mockRow = {
        id: 1,
        subject: 'Test Email',
        message: 'Test message',
        sent_to_all: 1,
        account_count: 100,
        scheduled_date: '2023-01-01 00:00:00',
        sent_date: '2023-01-01 00:00:00',
        status: 'sent',
        created_at: '2023-01-01 00:00:00',
        updated_at: '2023-01-01 00:00:00',
      } as any;

      mockExecute.mockResolvedValue([[mockRow]]);

      const result = await emailDb.getEmail(1);

      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM emails WHERE id = ?', [1]);
      expect(result).toEqual(transformEmailRow(mockRow));
    });

    it('should return null when email not found', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await emailDb.getEmail(999);

      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM emails WHERE id = ?', [999]);
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database connection failed');
      mockExecute.mockRejectedValue(mockError);

      await emailDb.getEmail(1);

      expect(handleDatabaseError).toHaveBeenCalledWith(mockError, 'get email');
    });
  });

  describe('getEmailRecipients', () => {
    it('should return transformed email recipients', async () => {
      const mockRows = [
        {
          account_id: 1,
          account_name: 'John Doe',
          email: 'john@example.com',
        },
        {
          account_id: 2,
          account_name: 'Jane Smith',
          email: 'jane@example.com',
        },
      ] as any[];

      mockExecute.mockResolvedValue([mockRows]);

      const result = await emailDb.getEmailRecipients(1);

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT account_id, account_name, email FROM email_recipient_details WHERE email_id = ?',
        [1],
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(transformAccountReferenceRow(mockRows[0]));
      expect(result[1]).toEqual(transformAccountReferenceRow(mockRows[1]));
    });

    it('should return empty array when no recipients found', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await emailDb.getEmailRecipients(999);

      expect(result).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database connection failed');
      mockExecute.mockRejectedValue(mockError);

      await emailDb.getEmailRecipients(1);

      expect(handleDatabaseError).toHaveBeenCalledWith(mockError, 'getting email recipients');
    });
  });

  describe('createEmailRecipient', () => {
    it('should create email recipient successfully', async () => {
      const recipient: CreateEmailRecipient = {
        email_id: 1,
        account_id: 100,
        status: 'pending',
        sent_at: null,
        error_message: null,
      };

      const mockResult = {
        affectedRows: 1,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.createEmailRecipient(recipient);

      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO email_recipients (email_id, account_id, status, sent_at, error_message) VALUES (?, ?, ?, ?, ?)',
        [recipient.email_id, recipient.account_id, recipient.status, recipient.sent_at, recipient.error_message],
      );
      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      const recipient: CreateEmailRecipient = {
        email_id: 1,
        account_id: 100,
        status: 'pending',
        sent_at: null,
        error_message: null,
      };

      const mockResult = {
        affectedRows: 0,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.createEmailRecipient(recipient);

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      const recipient: CreateEmailRecipient = {
        email_id: 1,
        account_id: 100,
        status: 'pending',
        sent_at: null,
        error_message: null,
      };

      const mockError = new Error('Database connection failed');
      mockExecute.mockRejectedValue(mockError);

      await emailDb.createEmailRecipient(recipient);

      expect(handleDatabaseError).toHaveBeenCalledWith(mockError, 'creating an email recipient');
    });
  });

  describe('updateEmailRecipientStatus', () => {
    it('should update email recipient status successfully', async () => {
      const emailId = 1;
      const accountId = 100;
      const sentDate = '2023-01-01 12:00:00';
      const status = 'sent';

      const mockResult = {
        affectedRows: 1,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 1,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.updateEmailRecipientStatus(emailId, accountId, sentDate, status);

      expect(mockExecute).toHaveBeenCalledWith(
        'UPDATE email_recipients SET sent_at = ?, status = ? WHERE email_id = ? AND account_id = ?',
        [sentDate, status, emailId, accountId],
      );
      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      const emailId = 999;
      const accountId = 999;
      const sentDate = '2023-01-01 12:00:00';
      const status = 'sent';

      const mockResult = {
        affectedRows: 0,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.updateEmailRecipientStatus(emailId, accountId, sentDate, status);

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      const emailId = 1;
      const accountId = 100;
      const sentDate = '2023-01-01 12:00:00';
      const status = 'sent';

      const mockError = new Error('Database connection failed');
      mockExecute.mockRejectedValue(mockError);

      await emailDb.updateEmailRecipientStatus(emailId, accountId, sentDate, status);

      expect(handleDatabaseError).toHaveBeenCalledWith(mockError, 'updating an email recipient status');
    });
  });

  describe('updateEmailRecipientStatusFailure', () => {
    it('should update email recipient status to failed successfully', async () => {
      const emailId = 1;
      const accountId = 100;
      const errorMessage = 'Failed to send email';

      const mockResult = {
        affectedRows: 1,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 1,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.updateEmailRecipientStatusFailure(emailId, accountId, errorMessage);

      expect(mockExecute).toHaveBeenCalledWith(
        `UPDATE email_recipients SET status = 'failed', error_message = ? WHERE email_id = ? AND account_id = ?`,
        [errorMessage, emailId, accountId],
      );
      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      const emailId = 999;
      const accountId = 999;
      const errorMessage = 'Failed to send email';

      const mockResult = {
        affectedRows: 0,
        insertId: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.updateEmailRecipientStatusFailure(emailId, accountId, errorMessage);

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      const emailId = 1;
      const accountId = 100;
      const errorMessage = 'Failed to send email';

      const mockError = new Error('Database connection failed');
      mockExecute.mockRejectedValue(mockError);

      await emailDb.updateEmailRecipientStatusFailure(emailId, accountId, errorMessage);

      expect(handleDatabaseError).toHaveBeenCalledWith(mockError, 'updating an email recipient status for failure');
    });
  });

  describe('createEmailRecipients', () => {
    it('should create multiple email recipients successfully', async () => {
      const recipients: CreateEmailRecipient[] = [
        {
          email_id: 1,
          account_id: 100,
          status: 'pending',
          sent_at: null,
          error_message: null,
        },
        {
          email_id: 1,
          account_id: 101,
          status: 'pending',
          sent_at: null,
          error_message: null,
        },
      ];

      const mockResult = {
        affectedRows: 2,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.createEmailRecipients(recipients);

      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO email_recipients (email_id, account_id, status, sent_at, error_message) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)',
        [1, 100, 'pending', null, null, 1, 101, 'pending', null, null],
      );
      expect(result).toBe(true);
    });

    it('should return true when empty array provided', async () => {
      const result = await emailDb.createEmailRecipients([]);

      expect(mockExecute).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when affected rows do not match recipients count', async () => {
      const recipients: CreateEmailRecipient[] = [
        {
          email_id: 1,
          account_id: 100,
          status: 'pending',
          sent_at: null,
          error_message: null,
        },
        {
          email_id: 1,
          account_id: 101,
          status: 'pending',
          sent_at: null,
          error_message: null,
        },
      ];

      const mockResult = {
        affectedRows: 1,
        insertId: 1,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
        fieldCount: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await emailDb.createEmailRecipients(recipients);

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      const recipients: CreateEmailRecipient[] = [
        {
          email_id: 1,
          account_id: 100,
          status: 'pending',
          sent_at: null,
          error_message: null,
        },
      ];

      const mockError = new Error('Database connection failed');
      mockExecute.mockRejectedValue(mockError);

      await emailDb.createEmailRecipients(recipients);

      expect(handleDatabaseError).toHaveBeenCalledWith(mockError, 'creating email recipients');
    });
  });
});
