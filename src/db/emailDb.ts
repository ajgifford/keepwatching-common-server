import { AccountReferenceRow, transformAccountReferenceRow } from '../types/accountTypes';
import {
  CreateEmailRow,
  EmailRow,
  EmailTemplateRow,
  UpdateEmailRow,
  transformEmailRow,
  transformEmailTemplateRow,
} from '../types/emailTypes';
import { getDbPool } from '../utils/db';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { TimestampUtil } from '../utils/timestampUtil';
import {
  AccountReference,
  CreateEmailRecipient,
  CreateEmailTemplate,
  Email,
  EmailStatus,
  EmailTemplate,
  UpdateEmailTemplate,
} from '@ajgifford/keepwatching-types';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  try {
    const query = 'SELECT * from email_templates';
    const [templates] = await getDbPool().execute<EmailTemplateRow[]>(query);
    return templates.map(transformEmailTemplateRow);
  } catch (error) {
    handleDatabaseError(error, 'getting all email templates');
  }
}

export async function createEmailTemplate(emailTemplate: CreateEmailTemplate): Promise<boolean> {
  try {
    const query = 'INSERT INTO email_templates (name, subject, message) VALUES (?, ?, ?)';
    const [insertResult] = await getDbPool().execute<ResultSetHeader>(query, [
      emailTemplate.name,
      emailTemplate.subject,
      emailTemplate.message,
    ]);
    return insertResult.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'creating an email template');
  }
}

export async function updateEmailTemplate(emailTemplate: UpdateEmailTemplate): Promise<boolean> {
  try {
    const query = 'UPDATE email_templates SET name = ?, subject = ?, message = ? WHERE id = ?';
    const [updateResult] = await getDbPool().execute<ResultSetHeader>(query, [
      emailTemplate.name,
      emailTemplate.subject,
      emailTemplate.message,
      emailTemplate.id,
    ]);
    return updateResult.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'updating an email template');
  }
}

export async function deleteEmailTemplate(templateId: number): Promise<boolean> {
  try {
    const query = 'DELETE FROM email_templates WHERE id = ?';
    const [deleteResult] = await getDbPool().execute<ResultSetHeader>(query, [templateId]);
    return deleteResult.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'deleting an email template');
  }
}

export async function getAllEmailsCount(): Promise<number> {
  try {
    const countQuery = 'SELECT COUNT(*) as total FROM emails';
    const [countResult] = await getDbPool().execute<RowDataPacket[]>(countQuery);
    return countResult[0].total;
  } catch (error) {
    handleDatabaseError(error, `getting emails count`);
  }
}

export async function getAllEmails(limit: number = 50, offset: number = 0): Promise<Email[]> {
  try {
    const query = `SELECT * FROM emails ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [emails] = await getDbPool().execute<EmailRow[]>(query);

    return emails.map(transformEmailRow);
  } catch (error) {
    handleDatabaseError(error, `getting emails`);
  }
}

export async function getEmail(id: number): Promise<Email | null> {
  try {
    const query = `SELECT * FROM emails WHERE id = ?`;
    const [emails] = await getDbPool().execute<EmailRow[]>(query, [id]);

    if (emails.length === 0) return null;

    return transformEmailRow(emails[0]);
  } catch (error) {
    handleDatabaseError(error, `get email`);
  }
}

export async function createEmail(email: CreateEmailRow): Promise<number> {
  try {
    const query =
      'INSERT INTO emails (subject, message, sent_to_all, account_count, scheduled_date, sent_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const [insertResult] = await getDbPool().execute<ResultSetHeader>(query, [
      email.subject,
      email.message,
      email.sent_to_all ? 1 : 0,
      email.account_count,
      TimestampUtil.toMySQLDatetime(email.scheduled_date),
      TimestampUtil.toMySQLDatetime(email.sent_date),
      email.status,
    ]);
    return insertResult.insertId;
  } catch (error) {
    handleDatabaseError(error, 'creating an email');
  }
}

export async function updateEmail(email: UpdateEmailRow): Promise<boolean> {
  try {
    const query =
      'UPDATE emails SET subject = ?, message = ?, sent_to_all = ?, account_count = ?, scheduled_date = ?, sent_date = ?, status = ? WHERE id = ?';
    const [updateResult] = await getDbPool().execute<ResultSetHeader>(query, [
      email.subject,
      email.message,
      email.sent_to_all ? 1 : 0,
      email.account_count,
      TimestampUtil.toMySQLDatetime(email.scheduled_date),
      TimestampUtil.toMySQLDatetime(email.sent_date),
      email.status,
      email.id,
    ]);
    return updateResult.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'updating an email');
  }
}

export async function updateEmailStatus(id: number, sentDate: string | null, status: EmailStatus): Promise<boolean> {
  try {
    const query = 'UPDATE emails SET sent_date = ?, status = ? WHERE id = ?';
    const [updateResult] = await getDbPool().execute<ResultSetHeader>(query, [
      TimestampUtil.toMySQLDatetime(sentDate),
      status,
      id,
    ]);
    return updateResult.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'updating an email status');
  }
}

export async function deleteEmail(id: number): Promise<boolean> {
  try {
    const query = 'DELETE FROM emails WHERE id = ?';
    const [deleteResult] = await getDbPool().execute<ResultSetHeader>(query, [id]);
    return deleteResult.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'deleting an email');
  }
}

export async function getEmailRecipients(emailId: number): Promise<AccountReference[]> {
  try {
    const query = `SELECT account_id, account_name, email FROM email_recipient_details WHERE email_id = ?`;
    const [results] = await getDbPool().execute<AccountReferenceRow[]>(query, [emailId]);
    return results.map(transformAccountReferenceRow);
  } catch (error) {
    handleDatabaseError(error, 'getting email recipients');
  }
}

export async function createEmailRecipient(recipient: CreateEmailRecipient) {
  try {
    const query =
      'INSERT INTO email_recipients (email_id, account_id, status, sent_at, error_message) VALUES (?, ?, ?, ?, ?)';
    const [insertResult] = await getDbPool().execute<ResultSetHeader>(query, [
      recipient.email_id,
      recipient.account_id,
      recipient.status,
      TimestampUtil.toMySQLDatetime(recipient.sent_at),
      recipient.error_message,
    ]);
    return insertResult.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'creating an email recipient');
  }
}

export async function updateEmailRecipientStatus(
  email_id: number,
  account_id: number,
  sentDate: string,
  status: EmailStatus,
): Promise<boolean> {
  try {
    const query = 'UPDATE email_recipients SET sent_at = ?, status = ? WHERE email_id = ? AND account_id = ?';
    const [updateResult] = await getDbPool().execute<ResultSetHeader>(query, [
      TimestampUtil.toMySQLDatetime(sentDate),
      status,
      email_id,
      account_id,
    ]);
    return updateResult.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'updating an email recipient status');
  }
}

export async function updateEmailRecipientStatusFailure(
  email_id: number,
  account_id: number,
  error: string,
): Promise<boolean> {
  try {
    const query = `UPDATE email_recipients SET status = 'failed', error_message = ? WHERE email_id = ? AND account_id = ?`;
    const [updateResult] = await getDbPool().execute<ResultSetHeader>(query, [error, email_id, account_id]);
    return updateResult.affectedRows > 0;
  } catch (error) {
    handleDatabaseError(error, 'updating an email recipient status for failure');
  }
}

export async function createEmailRecipients(recipients: CreateEmailRecipient[]): Promise<boolean> {
  try {
    if (recipients.length === 0) {
      return true;
    }

    const placeholders = recipients.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const query = `INSERT INTO email_recipients (email_id, account_id, status, sent_at, error_message) VALUES ${placeholders}`;

    const flatValues = recipients.flatMap((recipient) => [
      recipient.email_id,
      recipient.account_id,
      recipient.status,
      TimestampUtil.toMySQLDatetime(recipient.sent_at),
      recipient.error_message,
    ]);

    const [insertResult] = await getDbPool().execute<ResultSetHeader>(query, flatValues);
    return insertResult.affectedRows === recipients.length;
  } catch (error) {
    handleDatabaseError(error, 'creating email recipients');
  }
}
