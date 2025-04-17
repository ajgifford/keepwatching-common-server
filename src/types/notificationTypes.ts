export interface AccountNotification {
  notification_id: number;
  message: string;
  start_date: Date;
  end_date: Date;
}

export interface AdminNotification {
  notification_id?: number;
  message: string;
  start_date: string;
  end_date: string;
  send_to_all: boolean;
  account_id: number | null;
}
