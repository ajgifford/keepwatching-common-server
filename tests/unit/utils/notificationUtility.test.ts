import { ProfileAccountMapping } from '@ajgifford/keepwatching-types';
import * as preferencesDb from '@db/preferencesDb';
import * as notificationsService from '@services/notificationsService';
import { createNewSeasonNotifications } from '@utils/notificationUtility';

jest.mock('@db/preferencesDb');
jest.mock('@services/notificationsService');
jest.mock('@logger/logger', () => ({
  appLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

describe('notificationUtility', () => {
  const mockAddNotification = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (notificationsService.notificationsService as any) = { addNotification: mockAddNotification };
  });

  describe('createNewSeasonNotifications', () => {
    const showTitle = 'Test Show';
    const seasonNumber = 2;

    const mappings: ProfileAccountMapping[] = [
      { profileId: 1, accountId: 10 },
      { profileId: 2, accountId: 20 },
      { profileId: 3, accountId: 30 },
    ];

    it('notifies all accounts when none have opted out', async () => {
      jest.mocked(preferencesDb.getAccountsWithNotificationPreference).mockResolvedValueOnce([]);

      await createNewSeasonNotifications(showTitle, seasonNumber, mappings);

      expect(preferencesDb.getAccountsWithNotificationPreference).toHaveBeenCalledWith('newSeasonAlerts', false);
      expect(mockAddNotification).toHaveBeenCalledTimes(3);
      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Season Available',
          message: `Season ${seasonNumber} of "${showTitle}" has been added to your watchlist.`,
          sendToAll: false,
          accountId: 10,
          type: 'tv',
        }),
      );
    });

    it('skips accounts that have opted out of new season alerts', async () => {
      // Account 20 has opted out
      jest.mocked(preferencesDb.getAccountsWithNotificationPreference).mockResolvedValueOnce([20]);

      await createNewSeasonNotifications(showTitle, seasonNumber, mappings);

      expect(mockAddNotification).toHaveBeenCalledTimes(2);
      const notifiedIds = mockAddNotification.mock.calls.map((call) => call[0].accountId);
      expect(notifiedIds).toContain(10);
      expect(notifiedIds).toContain(30);
      expect(notifiedIds).not.toContain(20);
    });

    it('sends no notifications when all accounts have opted out', async () => {
      jest.mocked(preferencesDb.getAccountsWithNotificationPreference).mockResolvedValueOnce([10, 20, 30]);

      await createNewSeasonNotifications(showTitle, seasonNumber, mappings);

      expect(mockAddNotification).not.toHaveBeenCalled();
    });

    it('deduplicates accounts from multiple profile mappings', async () => {
      const mappingsWithDuplicate: ProfileAccountMapping[] = [
        { profileId: 1, accountId: 10 },
        { profileId: 2, accountId: 10 }, // same account, different profile
        { profileId: 3, accountId: 20 },
      ];
      jest.mocked(preferencesDb.getAccountsWithNotificationPreference).mockResolvedValueOnce([]);

      await createNewSeasonNotifications(showTitle, seasonNumber, mappingsWithDuplicate);

      // Account 10 appears twice in mappings but should only get one notification
      expect(mockAddNotification).toHaveBeenCalledTimes(2);
      const notifiedIds = mockAddNotification.mock.calls.map((call) => call[0].accountId);
      expect(notifiedIds.filter((id: number) => id === 10)).toHaveLength(1);
    });

    it('does not throw when notification creation fails', async () => {
      jest.mocked(preferencesDb.getAccountsWithNotificationPreference).mockResolvedValueOnce([]);
      mockAddNotification.mockRejectedValueOnce(new Error('DB error'));

      await expect(createNewSeasonNotifications(showTitle, seasonNumber, mappings)).resolves.not.toThrow();
    });

    it('handles empty profileAccountMappings gracefully', async () => {
      jest.mocked(preferencesDb.getAccountsWithNotificationPreference).mockResolvedValueOnce([]);

      await createNewSeasonNotifications(showTitle, seasonNumber, []);

      expect(mockAddNotification).not.toHaveBeenCalled();
    });
  });
});
