import { AccountNotification, AdminNotification } from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2';

export interface CurrentNotificationRow extends RowDataPacket {
  notification_id: number;
  message: string;
  start_date: Date;
  end_date: Date;
  dismissed: number;
  read: number;
}

export interface NotificationRow extends RowDataPacket {
  notification_id: number;
  message: string;
  start_date: Date;
  end_date: Date;
  send_to_all: number;
}

export function transformAccountNotificationRow(notificationRow: CurrentNotificationRow): AccountNotification {
  return {
    id: notificationRow.notification_id,
    message: notificationRow.message,
    startDate: notificationRow.start_date,
    endDate: notificationRow.end_date,
    dismissed: Boolean(notificationRow.dismissed),
    read: Boolean(notificationRow.read),
  };
}

export function transformAdminNotificationRow(notificationRow: NotificationRow): AdminNotification {
  return {
    id: notificationRow.notification_id,
    message: notificationRow.message,
    startDate: notificationRow.start_date,
    endDate: notificationRow.end_date,
    sendToAll: Boolean(notificationRow.send_to_all),
    accountId: notificationRow.account_id,
  };
}
