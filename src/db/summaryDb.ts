import { getDbPool } from '../utils/db';
import { DbMonitor } from '../utils/dbMonitoring';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { SummaryCounts } from '@ajgifford/keepwatching-types';
import { CountRow, SummaryCountRow } from 'src/types/summaryTypes';

export async function getSummaryCounts(): Promise<SummaryCounts> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getSummaryCounts', async () => {
      const query = `
      SELECT 'accounts' as entity, COUNT(*) as count FROM accounts
      UNION ALL
      SELECT 'profiles' as entity, COUNT(*) as count FROM profiles  
      UNION ALL
      SELECT 'shows' as entity, COUNT(*) as count FROM shows
      UNION ALL
      SELECT 'seasons' as entity, COUNT(*) as count FROM seasons
      UNION ALL
      SELECT 'episodes' as entity, COUNT(*) as count FROM episodes
      UNION ALL
      SELECT 'movies' as entity, COUNT(*) as count FROM movies
      UNION ALL
      SELECT 'people' as entity, COUNT(*) as count FROM people
      UNION ALL
      SELECT 'favoritedShows' as entity, COUNT(*) as count FROM show_watch_status
      UNION ALL
      SELECT 'favoritedMovies' as entity, COUNT(*) as count FROM movie_watch_status
    `;
      const [rows] = await getDbPool().execute<SummaryCountRow[]>(query);

      const counts = rows.reduce<SummaryCounts>((acc, row) => {
        acc[row.entity as keyof SummaryCounts] = row.count;
        return acc;
      }, {} as SummaryCounts);

      return counts;
    });
  } catch (error) {
    handleDatabaseError(error, 'getting summary counts');
  }
}

export async function getTableCount(tableName: string): Promise<number> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getTableCount', async () => {
      const query = 'SELECT COUNT(*) as count FROM ?';
      const [rows] = await getDbPool().execute<CountRow[]>(query, [tableName]);
      return rows[0].count;
    });
  } catch (error) {
    handleDatabaseError(error, 'getting summary counts');
  }
}
