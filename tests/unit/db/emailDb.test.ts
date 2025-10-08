import {
  CreateEmailRow,
  UpdateEmailRow,
  transformEmailRow,
  transformEmailTemplateRow,
} from '../../../src/types/emailTypes';
import { CreateEmailTemplate, UpdateEmailTemplate } from '@ajgifford/keepwatching-types';
import * as emailDb from '@db/emailDb';
import { getDbPool } from '@utils/db';
import { handleDatabaseError } from '@utils/errorHandlingUtility';
import { ResultSetHeader } from 'mysql2';

// Mock dependencies
jest.mock('@utils/db');
jest.mock('@utils/errorHandlingUtility');

const mockGetDbPool = getDbPool as jest.MockedFunction<typeof getDbPool>;
const mockHandleDatabaseError = handleDatabaseError as jest.MockedFunction<typeof handleDatabaseError>;

const mockExecute = jest.fn();
const mockPool = {
  execute: mockExecute,
};

describe('emailDb', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDbPool.mockReturnValue(mockPool as any);
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

      expect(mockHandleDatabaseError).toHaveBeenCalledWith(mockError, 'getting all email templates');
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

      expect(mockHandleDatabaseError).toHaveBeenCalledWith(mockError, 'creating an email template');
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

      expect(mockHandleDatabaseError).toHaveBeenCalledWith(mockError, 'updating an email template');
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

      expect(mockHandleDatabaseError).toHaveBeenCalledWith(mockError, 'deleting an email template');
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

      expect(mockHandleDatabaseError).toHaveBeenCalledWith(mockError, 'getting emails count');
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

      expect(mockHandleDatabaseError).toHaveBeenCalledWith(mockError, 'getting emails');
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

      expect(mockHandleDatabaseError).toHaveBeenCalledWith(mockError, 'creating an email');
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

      expect(mockHandleDatabaseError).toHaveBeenCalledWith(mockError, 'updating an email');
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

      expect(mockHandleDatabaseError).toHaveBeenCalledWith(mockError, 'updating an email status');
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

      expect(mockHandleDatabaseError).toHaveBeenCalledWith(mockError, 'deleting an email');
    });
  });
});
