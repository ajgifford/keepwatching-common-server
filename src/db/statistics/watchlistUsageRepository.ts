import {
  AvgCompletionRow,
  ChurnCountRow,
  CompletionCountsRow,
  CurrentQueueTotalsRow,
  QueuedItemRow,
  QueuedItemWithProfileRow,
  mapRowToQueuedItemAge,
  mapRowToQueuedItemAgeWithProfile,
} from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { AccountWatchlistUsageStats, ProfileWatchlistUsageStats } from '@ajgifford/keepwatching-types';

const TITLE_JOIN = `
  LEFT JOIN shows s ON wi.content_type = 'show' AND wi.content_id = s.id
  LEFT JOIN movies m ON wi.content_type = 'movie' AND wi.content_id = m.id
`;

const TITLE_CASE = `CASE wi.content_type WHEN 'show' THEN s.title WHEN 'movie' THEN m.title END AS title`;

function computeCompletionRate(completed: number, totalRemoved: number): number {
  return totalRemoved > 0 ? (completed / totalRemoved) * 100 : 0;
}

function churnCounts(rows: ChurnCountRow[]): { totalAdded: number; totalRemoved: number } {
  let totalAdded = 0;
  let totalRemoved = 0;
  for (const row of rows) {
    if (row.event_type === 'added') totalAdded = Number(row.cnt) || 0;
    if (row.event_type === 'removed') totalRemoved = Number(row.cnt) || 0;
  }
  return { totalAdded, totalRemoved };
}

/**
 * Get watchlist usage statistics for a single profile.
 *
 * @param profileId - ID of the profile
 * @returns Profile watchlist usage statistics
 */
export async function getProfileWatchlistUsageStats(profileId: number): Promise<ProfileWatchlistUsageStats> {
  return await DbMonitor.getInstance().executeWithTiming('getProfileWatchlistUsageStats', async () => {
    const pool = getDbPool();

    const [currentTotals, longestQueued, churn, completion, avgCompletion] = await Promise.all([
      pool.execute<CurrentQueueTotalsRow[]>(
        `SELECT COUNT(*) AS currently_queued_count,
                COALESCE(AVG(TIMESTAMPDIFF(DAY, added_at, NOW())), 0) AS avg_current_queue_days
         FROM watchlist_items
         WHERE profile_id = ?`,
        [profileId],
      ),
      pool.execute<QueuedItemRow[]>(
        `SELECT wi.content_type, wi.content_id, ${TITLE_CASE},
                TIMESTAMPDIFF(DAY, wi.added_at, NOW()) AS days_in_queue
         FROM watchlist_items wi
         ${TITLE_JOIN}
         WHERE wi.profile_id = ?
         ORDER BY wi.added_at ASC
         LIMIT 5`,
        [profileId],
      ),
      pool.execute<ChurnCountRow[]>(
        `SELECT event_type, COUNT(*) AS cnt
         FROM watchlist_item_events
         WHERE profile_id = ?
         GROUP BY event_type`,
        [profileId],
      ),
      pool.execute<CompletionCountsRow[]>(
        `SELECT
           SUM(CASE WHEN watch_status_at_removal IN ('WATCHED','UP_TO_DATE') THEN 1 ELSE 0 END) AS completed_count,
           SUM(CASE WHEN watch_status_at_removal IN ('NOT_WATCHED','WATCHING') THEN 1 ELSE 0 END) AS abandoned_count,
           COUNT(*) AS total_removed
         FROM watchlist_item_events
         WHERE profile_id = ? AND event_type = 'removed'`,
        [profileId],
      ),
      pool.execute<AvgCompletionRow[]>(
        `WITH ordered_events AS (
           SELECT
             event_type,
             watch_status_at_removal,
             occurred_at,
             LAG(event_type) OVER (
               PARTITION BY profile_id, content_type, content_id ORDER BY occurred_at, id
             ) AS prev_event_type,
             LAG(occurred_at) OVER (
               PARTITION BY profile_id, content_type, content_id ORDER BY occurred_at, id
             ) AS prev_occurred_at
           FROM watchlist_item_events
           WHERE profile_id = ?
         )
         SELECT AVG(TIMESTAMPDIFF(DAY, prev_occurred_at, occurred_at)) AS avg_days_to_completion
         FROM ordered_events
         WHERE event_type = 'removed'
           AND prev_event_type = 'added'
           AND watch_status_at_removal IN ('WATCHED', 'UP_TO_DATE')`,
        [profileId],
      ),
    ]);

    const { totalAdded, totalRemoved } = churnCounts(churn[0] as ChurnCountRow[]);
    const completedCount = Number(completion[0][0]?.completed_count) || 0;
    const abandonedCount = Number(completion[0][0]?.abandoned_count) || 0;
    const avgDaysToCompletion = avgCompletion[0][0]?.avg_days_to_completion;

    return {
      currentlyQueuedCount: Number(currentTotals[0][0].currently_queued_count) || 0,
      averageCurrentQueueDays: Number(currentTotals[0][0].avg_current_queue_days) || 0,
      totalAdded,
      totalRemoved,
      completedCount,
      abandonedCount,
      completionRate: computeCompletionRate(completedCount, totalRemoved),
      averageDaysToCompletion:
        avgDaysToCompletion === null || avgDaysToCompletion === undefined ? null : Number(avgDaysToCompletion),
      longestQueuedItems: (longestQueued[0] as QueuedItemRow[]).map(mapRowToQueuedItemAge),
    };
  });
}

/**
 * Get watchlist usage statistics aggregated across all profiles in an account.
 *
 * @param accountId - ID of the account
 * @returns Account-wide watchlist usage statistics
 */
export async function getAccountWatchlistUsageStats(accountId: number): Promise<AccountWatchlistUsageStats> {
  return await DbMonitor.getInstance().executeWithTiming('getAccountWatchlistUsageStats', async () => {
    const pool = getDbPool();

    const [currentTotals, longestQueued, churn, completion, avgCompletion] = await Promise.all([
      pool.execute<CurrentQueueTotalsRow[]>(
        `SELECT COUNT(*) AS currently_queued_count,
                COALESCE(AVG(TIMESTAMPDIFF(DAY, added_at, NOW())), 0) AS avg_current_queue_days
         FROM watchlist_items
         WHERE account_id = ?`,
        [accountId],
      ),
      pool.execute<QueuedItemWithProfileRow[]>(
        `SELECT wi.content_type, wi.content_id, ${TITLE_CASE}, p.name AS profile_name,
                TIMESTAMPDIFF(DAY, wi.added_at, NOW()) AS days_in_queue
         FROM watchlist_items wi
         JOIN profiles p ON p.profile_id = wi.profile_id
         ${TITLE_JOIN}
         WHERE wi.account_id = ?
         ORDER BY wi.added_at ASC
         LIMIT 5`,
        [accountId],
      ),
      pool.execute<ChurnCountRow[]>(
        `SELECT event_type, COUNT(*) AS cnt
         FROM watchlist_item_events
         WHERE account_id = ?
         GROUP BY event_type`,
        [accountId],
      ),
      pool.execute<CompletionCountsRow[]>(
        `SELECT
           SUM(CASE WHEN watch_status_at_removal IN ('WATCHED','UP_TO_DATE') THEN 1 ELSE 0 END) AS completed_count,
           SUM(CASE WHEN watch_status_at_removal IN ('NOT_WATCHED','WATCHING') THEN 1 ELSE 0 END) AS abandoned_count,
           COUNT(*) AS total_removed
         FROM watchlist_item_events
         WHERE account_id = ? AND event_type = 'removed'`,
        [accountId],
      ),
      pool.execute<AvgCompletionRow[]>(
        `WITH ordered_events AS (
           SELECT
             event_type,
             watch_status_at_removal,
             occurred_at,
             LAG(event_type) OVER (
               PARTITION BY profile_id, content_type, content_id ORDER BY occurred_at, id
             ) AS prev_event_type,
             LAG(occurred_at) OVER (
               PARTITION BY profile_id, content_type, content_id ORDER BY occurred_at, id
             ) AS prev_occurred_at
           FROM watchlist_item_events
           WHERE account_id = ?
         )
         SELECT AVG(TIMESTAMPDIFF(DAY, prev_occurred_at, occurred_at)) AS avg_days_to_completion
         FROM ordered_events
         WHERE event_type = 'removed'
           AND prev_event_type = 'added'
           AND watch_status_at_removal IN ('WATCHED', 'UP_TO_DATE')`,
        [accountId],
      ),
    ]);

    const { totalAdded, totalRemoved } = churnCounts(churn[0] as ChurnCountRow[]);
    const completedCount = Number(completion[0][0]?.completed_count) || 0;
    const abandonedCount = Number(completion[0][0]?.abandoned_count) || 0;
    const avgDaysToCompletion = avgCompletion[0][0]?.avg_days_to_completion;

    return {
      currentlyQueuedCount: Number(currentTotals[0][0].currently_queued_count) || 0,
      averageCurrentQueueDays: Number(currentTotals[0][0].avg_current_queue_days) || 0,
      totalAdded,
      totalRemoved,
      completedCount,
      abandonedCount,
      completionRate: computeCompletionRate(completedCount, totalRemoved),
      averageDaysToCompletion:
        avgDaysToCompletion === null || avgDaysToCompletion === undefined ? null : Number(avgDaysToCompletion),
      longestQueuedItems: (longestQueued[0] as QueuedItemWithProfileRow[]).map(mapRowToQueuedItemAgeWithProfile),
    };
  });
}
