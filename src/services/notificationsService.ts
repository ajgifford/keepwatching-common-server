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
  public async getNotifications(accountId: number, includeDismissed: boolean = false): Promise<AccountNotification[]> {
    try {
      return await notificationsDb.getNotificationsForAccount(accountId, includeDismissed);
    } catch (error) {
      throw errorService.handleError(error, `getNotifications(${accountId}, ${includeDismissed})`);
    }
  }

  public async markNotificationRead(
    notificationId: number,
    accountId: number,
    hasBeenRead: boolean = true,
    includeDismissed: boolean = false,
  ): Promise<AccountNotification[]> {
    try {
      const updated = await notificationsDb.markNotificationRead(notificationId, accountId, hasBeenRead);
      if (!updated) {
        throw new NoAffectedRowsError(`No notification was marked ${hasBeenRead ? 'read' : 'unread'}`);
      }
      return await notificationsDb.getNotificationsForAccount(accountId, includeDismissed);
    } catch (error) {
      throw errorService.handleError(
        error,
        `markNotificationRead(${notificationId}, ${accountId}, ${hasBeenRead}, ${includeDismissed})`,
      );
    }
  }

  public async markAllNotificationsRead(
    accountId: number,
    hasBeenRead: boolean = true,
    includeDismissed: boolean = false,
  ): Promise<AccountNotification[]> {
    try {
      const updated = await notificationsDb.markAllNotificationsRead(accountId, hasBeenRead);
      if (!updated) {
        throw new NoAffectedRowsError(`No notifications were marked ${hasBeenRead ? 'read' : 'unread'}`);
      }
      return await notificationsDb.getNotificationsForAccount(accountId, includeDismissed);
    } catch (error) {
      throw errorService.handleError(
        error,
        `markAllNotificationsRead(${accountId}, ${hasBeenRead}, ${includeDismissed})`,
      );
    }
  }

  public async dismissNotification(
    notificationId: number,
    accountId: number,
    includeDismissed: boolean = false,
  ): Promise<AccountNotification[]> {
    try {
      const notificationDismissed = await notificationsDb.dismissNotification(notificationId, accountId);
      if (!notificationDismissed) {
        throw new NoAffectedRowsError('No notification was dismissed');
      }
      return await notificationsDb.getNotificationsForAccount(accountId, includeDismissed);
    } catch (error) {
      throw errorService.handleError(
        error,
        `dismissNotification(${notificationId}, ${accountId}, ${includeDismissed})`,
      );
    }
  }

  public async dismissAllNotifications(
    accountId: number,
    includeDismissed: boolean = false,
  ): Promise<AccountNotification[]> {
    try {
      const notificationsDismissed = await notificationsDb.dismissAllNotifications(accountId);
      if (!notificationsDismissed) {
        throw new NoAffectedRowsError('No notifications were dismissed');
      }
      return await notificationsDb.getNotificationsForAccount(accountId, includeDismissed);
    } catch (error) {
      throw errorService.handleError(error, `dismissAllNotifications(${accountId}, ${includeDismissed})`);
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
