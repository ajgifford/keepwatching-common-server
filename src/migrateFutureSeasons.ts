/**
 * Migration script to update watch status for future seasons
 * This script identifies seasons that represent future content and updates their watch status
 * from NOT_WATCHED to UP_TO_DATE if appropriate.
 *
 * Run with: yarn ts-node src/migrateFutureSeasons.ts
 */
import * as dotenv from 'dotenv';

import { cliLogger } from './logger/logger';
import { DatabaseError } from './middleware/errorMiddleware';
import { isFutureSeason } from './utils/contentUtility';
import { getDbPool, resetDbPool } from './utils/db';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { exit } from 'process';

// Load environment variables
dotenv.config();

interface SeasonRow extends RowDataPacket {
  season_id: number;
  show_id: number;
  season_number: number;
  name: string;
  release_date: string | null;
  number_of_episodes: number;
  profile_id: number;
  current_status: string;
  profile_name: string;
  show_title: string;
}

interface MigrationStats {
  totalSeasonsChecked: number;
  futureSeasonsFound: number;
  statusUpdatesApplied: number;
  profilesAffected: Set<number>;
  showsAffected: Set<number>;
  errors: number;
}

async function main() {
  const stats: MigrationStats = {
    totalSeasonsChecked: 0,
    futureSeasonsFound: 0,
    statusUpdatesApplied: 0,
    profilesAffected: new Set(),
    showsAffected: new Set(),
    errors: 0,
  };

  try {
    cliLogger.info('Starting future seasons watch status migration...');
    resetDbPool();

    // Step 1: Find all seasons with their watch status that might need updating
    const seasonsToCheck = await getFutureSeasonCandidates();
    stats.totalSeasonsChecked = seasonsToCheck.length;

    cliLogger.info(`Found ${seasonsToCheck.length} season watch status records to evaluate`);

    if (seasonsToCheck.length === 0) {
      cliLogger.info('No seasons found that need evaluation');
      return;
    }

    // Step 2: Process each season
    for (const season of seasonsToCheck) {
      try {
        const shouldBeUpToDate = await evaluateSeasonForMigration(season);

        if (shouldBeUpToDate) {
          stats.futureSeasonsFound++;

          // Only update if current status is NOT_WATCHED
          if (season.current_status === WatchStatus.NOT_WATCHED) {
            await updateSeasonWatchStatus(season.profile_id, season.season_id, WatchStatus.UP_TO_DATE);
            stats.statusUpdatesApplied++;
            stats.profilesAffected.add(season.profile_id);
            stats.showsAffected.add(season.show_id);

            cliLogger.info(
              `Updated season "${season.name}" (S${season.season_number}) of "${season.show_title}" ` +
                `for profile "${season.profile_name}" from NOT_WATCHED to UP_TO_DATE`,
            );
          } else {
            cliLogger.info(
              `Season "${season.name}" (S${season.season_number}) of "${season.show_title}" ` +
                `is future content but already has status: ${season.current_status}`,
            );
          }
        }
      } catch (error) {
        stats.errors++;
        cliLogger.error(`Error processing season ${season.season_id} for profile ${season.profile_id}:`, error);
      }
    }

    // Step 3: Report results
    await reportMigrationResults(stats);
  } catch (error) {
    cliLogger.error('Migration failed with error:', error);
    exit(1);
  } finally {
    const pool = getDbPool();
    await pool.end();
  }
}

/**
 * Get all season watch status records that could potentially be future seasons
 */
async function getFutureSeasonCandidates(): Promise<SeasonRow[]> {
  const query = `
    SELECT 
      sws.season_id,
      sws.profile_id,
      sws.status as current_status,
      s.show_id,
      s.season_number,
      s.name,
      s.release_date,
      s.number_of_episodes,
      p.name as profile_name,
      sh.title as show_title
    FROM season_watch_status sws
    JOIN seasons s ON sws.season_id = s.id
    JOIN profiles p ON sws.profile_id = p.profile_id
    JOIN shows sh ON s.show_id = sh.id
    WHERE sws.status IN ('NOT_WATCHED', 'UP_TO_DATE')
    ORDER BY sh.title, s.season_number, p.name
  `;

  const [rows] = await getDbPool().execute<SeasonRow[]>(query);
  return rows;
}

/**
 * Evaluate if a season should be considered future content and marked as UP_TO_DATE
 */
async function evaluateSeasonForMigration(season: SeasonRow): Promise<boolean> {
  // Use the utility function to determine if this is future content
  const isFuture = isFutureSeason(season.release_date, season.number_of_episodes);

  if (!isFuture) {
    return false;
  }

  // Additional check: ensure there are no aired episodes for this season
  const airedEpisodesCount = await getAiredEpisodesCount(season.season_id);

  // If there are aired episodes, the user should watch them (NOT_WATCHED is correct)
  if (airedEpisodesCount > 0) {
    return false;
  }

  return true;
}

/**
 * Get count of episodes that have already aired for a season
 */
async function getAiredEpisodesCount(seasonId: number): Promise<number> {
  const query = `
    SELECT COUNT(*) as aired_count
    FROM episodes
    WHERE season_id = ?
    AND (air_date IS NULL OR air_date <= CURRENT_DATE())
  `;

  const [rows] = await getDbPool().execute<(RowDataPacket & { aired_count: number })[]>(query, [seasonId]);
  return rows[0]?.aired_count || 0;
}

/**
 * Update a season's watch status
 */
async function updateSeasonWatchStatus(profileId: number, seasonId: number, status: string): Promise<void> {
  const query = `
    UPDATE season_watch_status 
    SET status = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE profile_id = ? AND season_id = ?
  `;

  const [result] = await getDbPool().execute<ResultSetHeader>(query, [status, profileId, seasonId]);

  if (result.affectedRows === 0) {
    throw new Error(`Failed to update season watch status for profile ${profileId}, season ${seasonId}`);
  }
}

/**
 * Report the results of the migration
 */
async function reportMigrationResults(stats: MigrationStats): Promise<void> {
  cliLogger.info('Migration completed successfully!');
  cliLogger.info('='.repeat(50));
  cliLogger.info(`📊 Migration Statistics:`);
  cliLogger.info(`  • Total season records checked: ${stats.totalSeasonsChecked}`);
  cliLogger.info(`  • Future seasons identified: ${stats.futureSeasonsFound}`);
  cliLogger.info(`  • Watch status updates applied: ${stats.statusUpdatesApplied}`);
  cliLogger.info(`  • Unique profiles affected: ${stats.profilesAffected.size}`);
  cliLogger.info(`  • Unique shows affected: ${stats.showsAffected.size}`);
  cliLogger.info(`  • Errors encountered: ${stats.errors}`);
  cliLogger.info('='.repeat(50));

  if (stats.statusUpdatesApplied > 0) {
    cliLogger.info('✅ Migration updated watch statuses for future seasons that had no available content');
    cliLogger.info('   These seasons are now marked as UP_TO_DATE instead of NOT_WATCHED');
  } else {
    cliLogger.info('ℹ️  No watch status updates were needed');
  }

  if (stats.errors > 0) {
    cliLogger.warn(`⚠️  ${stats.errors} errors were encountered during migration`);
  }

  // Optional: Show verification query
  cliLogger.info('\n🔍 To verify results, you can run this query:');
  cliLogger.info(`
    SELECT 
      sh.title as show_title,
      s.name as season_name,
      s.season_number,
      s.release_date,
      s.number_of_episodes,
      COUNT(DISTINCT p.profile_id) as profiles_with_up_to_date
    FROM seasons s
    JOIN shows sh ON s.show_id = sh.id
    JOIN season_watch_status sws ON s.id = sws.season_id
    JOIN profiles p ON sws.profile_id = p.profile_id
    WHERE sws.status = 'UP_TO_DATE'
    AND (s.release_date IS NULL OR s.release_date > CURRENT_DATE() OR s.number_of_episodes = 0)
    GROUP BY s.id
    ORDER BY sh.title, s.season_number;
  `);
}

/**
 * Dry run mode - shows what would be updated without making changes
 */
async function dryRun(): Promise<void> {
  const stats: MigrationStats = {
    totalSeasonsChecked: 0,
    futureSeasonsFound: 0,
    statusUpdatesApplied: 0,
    profilesAffected: new Set(),
    showsAffected: new Set(),
    errors: 0,
  };

  try {
    cliLogger.info('🔍 DRY RUN MODE - No changes will be made to the database');
    cliLogger.info('='.repeat(30));
    resetDbPool();

    const seasonsToCheck = await getFutureSeasonCandidates();
    stats.totalSeasonsChecked = seasonsToCheck.length;
    cliLogger.info(`Found ${seasonsToCheck.length} season watch status records to evaluate`);

    if (seasonsToCheck.length === 0) {
      cliLogger.info('No seasons found that need evaluation');
      return;
    }

    for (const season of seasonsToCheck) {
      try {
        const shouldBeUpToDate = await evaluateSeasonForMigration(season);

        if (shouldBeUpToDate) {
          stats.futureSeasonsFound++;

          if (season.current_status === WatchStatus.NOT_WATCHED) {
            stats.statusUpdatesApplied++;
            stats.profilesAffected.add(season.profile_id);
            stats.showsAffected.add(season.show_id);

            cliLogger.info(
              `WOULD UPDATE season "${season.name}" (S${season.season_number}) of "${season.show_title}" ` +
                `for profile "${season.profile_name}" from NOT_WATCHED to UP_TO_DATE`,
            );
          } else {
            cliLogger.info(
              `Season "${season.name}" (S${season.season_number}) of "${season.show_title}" ` +
                `is future content but already has status: ${season.current_status}`,
            );
          }
        }
      } catch (error) {
        stats.errors++;
        cliLogger.error(`Error processing season ${season.season_id} for profile ${season.profile_id}:`, error);
      }
    }

    await reportMigrationResults(stats);
    cliLogger.info('='.repeat(30));
    cliLogger.info(
      `📊 Dry Run Results: ${stats.statusUpdatesApplied} seasons would be updated from NOT_WATCHED to UP_TO_DATE`,
    );
    cliLogger.info('To apply these changes, run the script without the --dry-run flag');
  } catch (error) {
    cliLogger.error('Dry-run migration failed with error:', error);
    exit(1);
  } finally {
    const pool = getDbPool();
    await pool.end();
  }
}

// Check for dry run flag
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

if (isDryRun) {
  dryRun().catch((error) => {
    cliLogger.error('Dry run failed:', error);
    exit(1);
  });
} else {
  main().catch((error) => {
    cliLogger.error('Migration failed:', error);
    exit(1);
  });
}
