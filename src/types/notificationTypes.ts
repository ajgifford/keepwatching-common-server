import { AccountNotification, AdminNotification, NotificationType } from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2';

export interface CurrentNotificationRow extends RowDataPacket {
  notification_id: number;
  title: string;
  message: string;
  start_date: Date;
  end_date: Date;
  type: NotificationType;
  dismissed: number;
  has_been_read: number;
}

export interface NotificationRow extends RowDataPacket {
  notification_id: number;
  title: string;
  message: string;
  start_date: Date;
  end_date: Date;
  send_to_all: number;
  account_id: number | null;
  type: NotificationType;
}

export function transformAccountNotificationRow(notificationRow: CurrentNotificationRow): AccountNotification {
  return {
    id: notificationRow.notification_id,
    title: notificationRow.title,
    message: notificationRow.message,
    startDate: notificationRow.start_date,
    endDate: notificationRow.end_date,
    type: notificationRow.type,
    dismissed: Boolean(notificationRow.dismissed),
    read: Boolean(notificationRow.has_been_read),
  };
}

export function transformAdminNotificationRow(notificationRow: NotificationRow): AdminNotification {
  return {
    id: notificationRow.notification_id,
    title: notificationRow.title,
    message: notificationRow.message,
    startDate: notificationRow.start_date,
    endDate: notificationRow.end_date,
    type: notificationRow.type,
    sendToAll: Boolean(notificationRow.send_to_all),
    accountId: notificationRow.account_id,
  };
}
