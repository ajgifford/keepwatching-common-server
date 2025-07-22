import * as notificationsDb from '../db/notificationsDb';
import { NoAffectedRowsError } from '../middleware/errorMiddleware';
import { errorService } from './errorService';
import {
  AccountNotification,
  AdminNotification,
  CreateNotificationRequest,
  UpdateNotificationRequest,
} from '@ajgifford/keepwatching-types';

export class NotificationsService {
  public async getNotifications(accountId: number): Promise<AccountNotification[]> {
    try {
      return await notificationsDb.getNotificationsForAccount(accountId);
    } catch (error) {
      throw errorService.handleError(error, `getNotifications(${accountId})`);
    }
  }

  public async dismissNotification(notificationId: number, accountId: number): Promise<AccountNotification[]> {
    try {
      const dismissed = await notificationsDb.dismissNotification(notificationId, accountId);
      if (!dismissed) {
        throw new NoAffectedRowsError('No notification was dismissed');
      }
      return await notificationsDb.getNotificationsForAccount(accountId);
    } catch (error) {
      throw errorService.handleError(error, `dismissNotification(${notificationId}, ${accountId})`);
    }
  }

  public async dismissAllNotifications(accountId: number): Promise<AccountNotification[]> {
    try {
      const dismissed = await notificationsDb.dismissAllNotifications(accountId);
      if (!dismissed) {
        throw new NoAffectedRowsError('No notifications were dismissed');
      }
      return await notificationsDb.getNotificationsForAccount(accountId);
    } catch (error) {
      throw errorService.handleError(error, `dismissNotification(${accountId})`);
    }
  }

  public async getAllNotifications(expired: boolean): Promise<AdminNotification[]> {
    try {
      return await notificationsDb.getAllNotifications(expired);
    } catch (error) {
      throw errorService.handleError(error, `getAllNotifications(${expired})`);
    }
  }

  public async addNotification(createNotificationRequest: CreateNotificationRequest): Promise<void> {
    try {
      await notificationsDb.addNotification(createNotificationRequest);
    } catch (error) {
      throw errorService.handleError(error, `addNotification(${JSON.stringify(createNotificationRequest)})`);
    }
  }

  public async updateNotification(updateNotificationRequest: UpdateNotificationRequest) {
    try {
      await notificationsDb.updateNotification(updateNotificationRequest);
    } catch (error) {
      throw errorService.handleError(error, `updateNotification(${JSON.stringify(updateNotificationRequest)})`);
    }
  }

  public async deleteNotification(notificationId: number): Promise<void> {
    try {
      await notificationsDb.deleteNotification(notificationId);
    } catch (error) {
      throw errorService.handleError(error, `deleteNotification(${notificationId})`);
    }
  }
}

export const notificationsService = new NotificationsService();
