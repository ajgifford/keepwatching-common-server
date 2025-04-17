import * as notificationsDb from '../db/notificationsDb';
import { AccountNotification, AdminNotification } from '../types/notificationTypes';
import { errorService } from './errorService';

export class NotificationsService {
  public async getNotifications(accountId: number): Promise<AccountNotification[]> {
    try {
      return await notificationsDb.getNotificationsForAccount(accountId);
    } catch (error) {
      throw errorService.handleError(error, `getNotifications(${accountId})`);
    }
  }

  public async dismissNotification(notificationId: number, accountId: number) {
    try {
      return await notificationsDb.dismissNotification(notificationId, accountId);
    } catch (error) {
      throw errorService.handleError(error, `dismissNotification(${notificationId}, ${accountId})`);
    }
  }

  public async getAllNotifications(expired: boolean): Promise<AdminNotification[]> {
    try {
      return await notificationsDb.getAllNotifications(expired);
    } catch (error) {
      throw errorService.handleError(error, `getAllNotifications(${expired})`);
    }
  }

  public async addNotification(
    message: string,
    startDate: string,
    endDate: string,
    sendToAll: boolean,
    accountId: number | null,
  ): Promise<void> {
    try {
      await notificationsDb.addNotification(
        notificationsDb.createAdminNotification(message, startDate, endDate, sendToAll, accountId),
      );
    } catch (error) {
      throw errorService.handleError(
        error,
        `addNotification(${message},${startDate},${endDate},${sendToAll},${accountId})`,
      );
    }
  }

  public async updateNotification(
    message: string,
    startDate: string,
    endDate: string,
    sendToAll: boolean,
    accountId: number | null,
    notificationId: number,
  ): Promise<AdminNotification> {
    try {
      return await notificationsDb.updateNotification(
        notificationsDb.createAdminNotification(message, startDate, endDate, sendToAll, accountId, notificationId),
      );
    } catch (error) {
      throw errorService.handleError(
        error,
        `updateNotification(${message},${startDate},${endDate},${sendToAll},${accountId},${notificationId})`,
      );
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
