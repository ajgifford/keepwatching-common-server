import { getAccountsWithNotificationPreference } from '../db/preferencesDb';
import { appLogger } from '../logger/logger';
import { notificationsService } from '../services/notificationsService';
import { ProfileAccountMapping } from '@ajgifford/keepwatching-types';

/**
 * Creates notifications for accounts when a new season is added to a show
 * This is a shared utility used by both showService and adminShowService
 *
 * @param showTitle - Title of the show that got a new season
 * @param seasonNumber - The season number that was added
 * @param profileAccountMappings - Mapping of profile IDs and their account IDs that have this show
 * @returns Promise that resolves when notifications are created
 */
export async function createNewSeasonNotifications(
  showTitle: string,
  seasonNumber: number,
  profileAccountMappings: ProfileAccountMapping[],
): Promise<void> {
  try {
    // Get unique account IDs (multiple profiles in same account should only get one notification)
    const uniqueAccountIds = [...new Set(profileAccountMappings.map((mapping) => mapping.accountId))];

    // Filter out accounts that have explicitly opted out of new season alerts.
    // Accounts with no preference row keep the default (true) and are included.
    const optedOutIds = new Set(await getAccountsWithNotificationPreference('newSeasonAlerts', false));
    const accountIdsToNotify = uniqueAccountIds.filter((id) => !optedOutIds.has(id));

    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // Notification expires in 30 days

    // Create a notification for each account that wants season alerts
    for (const accountId of accountIdsToNotify) {
      await notificationsService.addNotification({
        title: `New Season Available`,
        message: `Season ${seasonNumber} of "${showTitle}" has been added to your watchlist.`,
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        sendToAll: false,
        accountId: accountId,
        type: 'tv',
      });
    }

    appLogger.info(
      `Created new season notifications for ${showTitle} (Season ${seasonNumber}) to ${accountIdsToNotify.length} of ${uniqueAccountIds.length} accounts`,
    );
  } catch (error) {
    // Log error but don't throw - notification failure shouldn't stop the update process
    appLogger.error(`Failed to create new season notifications for ${showTitle}`, { error });
  }
}
