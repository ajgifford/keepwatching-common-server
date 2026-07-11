import {
  SeasonSkipTotalsRow,
  ShowSkipRow,
  ShowSkipWithProfileRow,
  mapRowToSkippedShow,
  mapRowToSkippedShowWithProfile,
} from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { AccountSkipRateStats, ProfileSkipRateStats } from '@ajgifford/keepwatching-types';

function computeSkipRate(totalTracked: number, totalSkipped: number): number {
  return totalTracked > 0 ? (totalSkipped / totalTracked) * 100 : 0;
}

/**
 * Get skip-rate statistics for a single profile.
 *
 * @param profileId - ID of the profile
 * @returns Profile skip-rate statistics
 */
export async function getProfileSkipRateStats(profileId: number): Promise<ProfileSkipRateStats> {
  return await DbMonitor.getInstance().executeWithTiming('getProfileSkipRateStats', async () => {
    const pool = getDbPool();

    const [totals, showRows] = await Promise.all([
      pool.execute<SeasonSkipTotalsRow[]>(
        `SELECT COUNT(*) AS total_seasons_tracked,
                SUM(CASE WHEN status = 'SKIPPED' THEN 1 ELSE 0 END) AS total_seasons_skipped
         FROM season_watch_status
         WHERE profile_id = ?`,
        [profileId],
      ),
      pool.execute<ShowSkipRow[]>(
        `SELECT s.id AS show_id, s.title AS show_title, COUNT(*) AS skipped_season_count
         FROM season_watch_status sws
         JOIN seasons se ON se.id = sws.season_id
         JOIN shows s ON s.id = se.show_id
         WHERE sws.profile_id = ? AND sws.status = 'SKIPPED'
         GROUP BY s.id, s.title
         ORDER BY skipped_season_count DESC
         LIMIT 10`,
        [profileId],
      ),
    ]);

    const totalSeasonsTracked = Number(totals[0][0].total_seasons_tracked) || 0;
    const totalSeasonsSkipped = Number(totals[0][0].total_seasons_skipped) || 0;

    return {
      totalSeasonsTracked,
      totalSeasonsSkipped,
      skipRate: computeSkipRate(totalSeasonsTracked, totalSeasonsSkipped),
      mostSkippedShows: (showRows[0] as ShowSkipRow[]).map(mapRowToSkippedShow),
    };
  });
}

/**
 * Get skip-rate statistics aggregated across all profiles in an account.
 *
 * @param accountId - ID of the account
 * @returns Account-wide skip-rate statistics
 */
export async function getAccountSkipRateStats(accountId: number): Promise<AccountSkipRateStats> {
  return await DbMonitor.getInstance().executeWithTiming('getAccountSkipRateStats', async () => {
    const pool = getDbPool();

    const [totals, showRows] = await Promise.all([
      pool.execute<SeasonSkipTotalsRow[]>(
        `SELECT COUNT(*) AS total_seasons_tracked,
                SUM(CASE WHEN sws.status = 'SKIPPED' THEN 1 ELSE 0 END) AS total_seasons_skipped
         FROM season_watch_status sws
         JOIN profiles p ON p.profile_id = sws.profile_id
         WHERE p.account_id = ?`,
        [accountId],
      ),
      pool.execute<ShowSkipWithProfileRow[]>(
        `SELECT s.id AS show_id, s.title AS show_title, COUNT(*) AS skipped_season_count, p.name AS profile_name
         FROM season_watch_status sws
         JOIN seasons se ON se.id = sws.season_id
         JOIN shows s ON s.id = se.show_id
         JOIN profiles p ON p.profile_id = sws.profile_id
         WHERE p.account_id = ? AND sws.status = 'SKIPPED'
         GROUP BY s.id, s.title, p.profile_id, p.name
         ORDER BY skipped_season_count DESC
         LIMIT 10`,
        [accountId],
      ),
    ]);

    const totalSeasonsTracked = Number(totals[0][0].total_seasons_tracked) || 0;
    const totalSeasonsSkipped = Number(totals[0][0].total_seasons_skipped) || 0;

    return {
      totalSeasonsTracked,
      totalSeasonsSkipped,
      skipRate: computeSkipRate(totalSeasonsTracked, totalSeasonsSkipped),
      mostSkippedShows: (showRows[0] as ShowSkipWithProfileRow[]).map(mapRowToSkippedShowWithProfile),
    };
  });
}
