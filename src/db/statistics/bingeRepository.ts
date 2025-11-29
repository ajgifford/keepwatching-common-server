import { EpisodeWatchEvent } from '../../types/statisticsTypes';
import { getDbPool } from '../../utils/db';
import { DbMonitor } from '../../utils/dbMonitoring';
import { BingeWatchingStats } from '@ajgifford/keepwatching-types';

/**
 * Get binge-watching statistics for a profile
 * Identifies sessions where 3+ episodes of the same show were watched within 24 hours
 *
 * @param profileId - ID of the profile
 * @returns Binge-watching statistics
 */
export async function getBingeWatchingStats(profileId: number): Promise<BingeWatchingStats> {
  return await DbMonitor.getInstance().executeWithTiming('getBingeWatchingStats', async () => {
    // Get all watched episodes with show information
    const [episodes] = await getDbPool().execute<EpisodeWatchEvent[]>(
      `
      SELECT
        e.show_id,
        s.title as show_title,
        ews.episode_id,
        ews.updated_at as watched_at
      FROM episode_watch_status ews
      JOIN episodes e ON e.id = ews.episode_id
      JOIN shows s ON s.id = e.show_id
      WHERE ews.profile_id = ?
        AND ews.status = 'WATCHED'
      ORDER BY e.show_id, ews.updated_at
      `,
      [profileId],
    );

    if (episodes.length === 0) {
      return createEmptyBingeStats();
    }

    // Detect binge sessions
    interface BingeSession {
      showId: number;
      showTitle: string;
      episodeCount: number;
      startDate: Date;
    }

    const bingeSessions: BingeSession[] = [];
    const showBingeCount = new Map<number, { title: string; count: number }>();

    let currentSession: EpisodeWatchEvent[] = [];

    episodes.forEach((episode, index) => {
      if (currentSession.length === 0) {
        currentSession.push(episode);
        return;
      }

      const lastEpisode = currentSession[currentSession.length - 1];
      const timeDiff = new Date(episode.watched_at).getTime() - new Date(lastEpisode.watched_at).getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      // If same show and within 24 hours, add to current session
      if (episode.show_id === lastEpisode.show_id && hoursDiff <= 24) {
        currentSession.push(episode);
      } else {
        // Process completed session
        if (currentSession.length >= 3) {
          const session: BingeSession = {
            showId: currentSession[0].show_id,
            showTitle: currentSession[0].show_title,
            episodeCount: currentSession.length,
            startDate: new Date(currentSession[0].watched_at),
          };
          bingeSessions.push(session);

          // Update show binge count
          const existing = showBingeCount.get(session.showId) || { title: session.showTitle, count: 0 };
          existing.count++;
          showBingeCount.set(session.showId, existing);
        }

        // Start new session
        currentSession = [episode];
      }

      // Handle last episode
      if (index === episodes.length - 1 && currentSession.length >= 3) {
        const session: BingeSession = {
          showId: currentSession[0].show_id,
          showTitle: currentSession[0].show_title,
          episodeCount: currentSession.length,
          startDate: new Date(currentSession[0].watched_at),
        };
        bingeSessions.push(session);

        const existing = showBingeCount.get(session.showId) || { title: session.showTitle, count: 0 };
        existing.count++;
        showBingeCount.set(session.showId, existing);
      }
    });

    // Find longest binge session
    const longestSession =
      bingeSessions.length > 0
        ? bingeSessions.reduce((max, session) => (session.episodeCount > max.episodeCount ? session : max))
        : null;

    // Calculate average episodes per binge
    const totalEpisodes = bingeSessions.reduce((sum, session) => sum + session.episodeCount, 0);
    const averageEpisodesPerBinge = bingeSessions.length > 0 ? totalEpisodes / bingeSessions.length : 0;

    // Get top binged shows
    const topBingedShows = Array.from(showBingeCount.entries())
      .map(([showId, data]) => ({
        showId,
        showTitle: data.title,
        bingeSessionCount: data.count,
      }))
      .sort((a, b) => b.bingeSessionCount - a.bingeSessionCount)
      .slice(0, 5);

    return {
      bingeSessionCount: bingeSessions.length,
      averageEpisodesPerBinge: Math.round(averageEpisodesPerBinge * 10) / 10,
      longestBingeSession: longestSession
        ? {
            showTitle: longestSession.showTitle,
            episodeCount: longestSession.episodeCount,
            date: longestSession.startDate.toISOString().split('T')[0],
          }
        : {
            showTitle: '',
            episodeCount: 0,
            date: '',
          },
      topBingedShows,
    };
  });
}

/**
 * Create empty binge stats when no data is available
 */
function createEmptyBingeStats(): BingeWatchingStats {
  return {
    bingeSessionCount: 0,
    averageEpisodesPerBinge: 0,
    longestBingeSession: {
      showTitle: '',
      episodeCount: 0,
      date: '',
    },
    topBingedShows: [],
  };
}
