/**
 * Migration script to update database with UP_TO_DATE status
 * and migrate existing WATCHED statuses for in-production shows
 *
 * Run with: yarn ts-node migrateWatchStatus.ts
 */
import * as dotenv from 'dotenv';

import { cliLogger } from './logger/logger';
import { getDbPool, resetDbPool } from './utils/db';
import { WatchStatusUtility } from './utils/watchStatusUtility';
import { RowDataPacket } from 'mysql2';
import { exit } from 'process';

// Load environment variables
dotenv.config();

async function main() {
  try {
    cliLogger.info('Starting watch status migration process...');
    resetDbPool();

    // Step 1: Check if tables have the UP_TO_DATE status
    const seasonHasStatus = await WatchStatusUtility.hasUpToDateStatus('season_watch_status');
    const showHasStatus = await WatchStatusUtility.hasUpToDateStatus('show_watch_status');

    if (!seasonHasStatus || !showHasStatus) {
      cliLogger.error('Migration failed: One or more tables do not have the UP_TO_DATE status');
      cliLogger.info('Please run the SQL migration first:');
      cliLogger.info('  - season_watch_status: ' + (seasonHasStatus ? 'OK' : 'MISSING'));
      cliLogger.info('  - show_watch_status: ' + (showHasStatus ? 'OK' : 'MISSING'));
      exit(1);
    }

    // Step 2: Migrate existing WATCHED statuses for in-production shows to UP_TO_DATE
    cliLogger.info('Migrating WATCHED statuses to UP_TO_DATE for in-production shows...');
    const results = await WatchStatusUtility.migrateWatchedToUpToDate();

    cliLogger.info('Migration completed successfully!');
    cliLogger.info(`Updated statuses:`);
    cliLogger.info(`  - Shows: ${results.shows}`);
    cliLogger.info(`  - Seasons: ${results.seasons}`);
    cliLogger.info(`Total updated: ${results.shows + results.seasons}`);

    // Step 3: Verify that the migration was successful with a simple query
    cliLogger.info('Verifying migration...');
    const verifyQuery = `
      SELECT 
        (SELECT COUNT(*) FROM show_watch_status WHERE status = 'UP_TO_DATE') as shows,
        (SELECT COUNT(*) FROM season_watch_status WHERE status = 'UP_TO_DATE') as seasons
    `;

    const [verifyResults] = await getDbPool().execute<RowDataPacket[]>(verifyQuery);
    cliLogger.info('Verification results:');
    cliLogger.info(`  - Shows with UP_TO_DATE: ${verifyResults[0].shows}`);
    cliLogger.info(`  - Seasons with UP_TO_DATE: ${verifyResults[0].seasons}`);

    cliLogger.info('Migration process completed!');
  } catch (error) {
    cliLogger.error('Migration failed with error:', error);
    exit(1);
  } finally {
    const pool = getDbPool();
    await pool.end();
  }
}

// Run the migration
main();
