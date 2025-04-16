import { cliLogger, httpLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { updateMovies, updateShows } from './contentUpdatesService';
import { errorService } from './errorService';
import parser from 'cron-parser';
import CronJob from 'node-cron';

interface ScheduledJob {
  job: CronJob.ScheduledTask;
  cronExpression: string;
  lastRunTime: Date | null;
  lastRunStatus: 'success' | 'failed' | 'never_run';
  isRunning: boolean;
}

const jobs: Record<string, ScheduledJob> = {
  showsUpdate: {
    job: null as unknown as CronJob.ScheduledTask,
    cronExpression: '',
    lastRunTime: null,
    lastRunStatus: 'never_run',
    isRunning: false,
  },
  moviesUpdate: {
    job: null as unknown as CronJob.ScheduledTask,
    cronExpression: '',
    lastRunTime: null,
    lastRunStatus: 'never_run',
    isRunning: false,
  },
};

type NotificationCallback = () => void;
let showUpdatesCallback: NotificationCallback | null = null;
let movieUpdatesCallback: NotificationCallback | null = null;

// Get schedule from environment variables or use defaults
const getScheduleConfig = () => {
  return {
    // Default: Daily at 2 AM
    showsUpdateSchedule: process.env.SHOWS_UPDATE_SCHEDULE || '0 2 * * *',
    // Default: Weekly on 7th, 14th, 21st, 28th at 1 AM
    moviesUpdateSchedule: process.env.MOVIES_UPDATE_SCHEDULE || '0 1 7,14,21,28 * *',
  };
};

/**
 * Run the show update job
 * Extracted into a separate function to allow manual triggering
 */
export async function runShowsUpdateJob(): Promise<boolean> {
  if (jobs.showsUpdate.isRunning) {
    cliLogger.warn('Shows update job already running, skipping this execution');
    return false;
  }

  jobs.showsUpdate.isRunning = true;
  jobs.showsUpdate.lastRunTime = new Date();

  cliLogger.info('Starting the show change job');
  httpLogger.info('Shows update job started');

  try {
    await updateShows();

    if (showUpdatesCallback) {
      showUpdatesCallback();
    }

    jobs.showsUpdate.lastRunStatus = 'success';
    cliLogger.info('Shows update job completed successfully');
    httpLogger.info('Shows update job completed');
    return true;
  } catch (error) {
    jobs.showsUpdate.lastRunStatus = 'failed';
    cliLogger.error('Failed to complete show update job', error);
    httpLogger.error(ErrorMessages.ShowsChangeFail, { error });
    return false;
  } finally {
    jobs.showsUpdate.isRunning = false;
    cliLogger.info('Ending the show change job');
  }
}

/**
 * Run the movie update job
 * Extracted into a separate function to allow manual triggering
 */
export async function runMoviesUpdateJob(): Promise<boolean> {
  if (jobs.moviesUpdate.isRunning) {
    cliLogger.warn('Movies update job already running, skipping this execution');
    return false;
  }

  jobs.moviesUpdate.isRunning = true;
  jobs.moviesUpdate.lastRunTime = new Date();

  cliLogger.info('Starting the movie change job');
  httpLogger.info('Movies update job started');

  try {
    await updateMovies();

    if (movieUpdatesCallback) {
      movieUpdatesCallback();
    }

    jobs.moviesUpdate.lastRunStatus = 'success';
    cliLogger.info('Movies update job completed successfully');
    httpLogger.info('Movies update job completed');
    return true;
  } catch (error) {
    jobs.moviesUpdate.lastRunStatus = 'failed';
    cliLogger.error('Failed to complete movie update job', error);
    httpLogger.error(ErrorMessages.MoviesChangeFail, { error });
    return false;
  } finally {
    jobs.moviesUpdate.isRunning = false;
    cliLogger.info('Ending the movie change job');
  }
}

/**
 * Initialize scheduled jobs for content updates
 * @param notifyShowUpdates Callback to notify UI when shows are updated
 * @param notifyMovieUpdates Callback to notify UI when movies are updated
 */
export function initScheduledJobs(
  notifyShowUpdates: NotificationCallback,
  notifyMovieUpdates: NotificationCallback,
): void {
  showUpdatesCallback = notifyShowUpdates;
  movieUpdatesCallback = notifyMovieUpdates;

  const { showsUpdateSchedule, moviesUpdateSchedule } = getScheduleConfig();

  if (!CronJob.validate(showsUpdateSchedule)) {
    cliLogger.error(`Invalid CRON expression for shows update: ${showsUpdateSchedule}`);
    throw errorService.handleError(
      new Error(`Invalid CRON expression for shows update: ${showsUpdateSchedule}`),
      'initScheduledJobs',
    );
  }

  if (!CronJob.validate(moviesUpdateSchedule)) {
    cliLogger.error(`Invalid CRON expression for movies update: ${moviesUpdateSchedule}`);
    throw errorService.handleError(
      new Error(`Invalid CRON expression for movies update: ${moviesUpdateSchedule}`),
      'initScheduledJobs',
    );
  }

  jobs.showsUpdate.job = CronJob.schedule(showsUpdateSchedule, async () => {
    try {
      await runShowsUpdateJob();
    } catch (error) {
      cliLogger.error('Unhandled error in shows update job', error);
    }
  });
  jobs.showsUpdate.cronExpression = showsUpdateSchedule;

  jobs.moviesUpdate.job = CronJob.schedule(moviesUpdateSchedule, async () => {
    try {
      await runMoviesUpdateJob();
    } catch (error) {
      cliLogger.error('Unhandled error in movies update job', error);
    }
  });
  jobs.moviesUpdate.cronExpression = moviesUpdateSchedule;

  jobs.showsUpdate.job.start();
  jobs.moviesUpdate.job.start();

  cliLogger.info('Job Scheduler Initialized');
  cliLogger.info(`Shows update scheduled with CRON: ${showsUpdateSchedule}`);
  cliLogger.info(`Movies update scheduled with CRON: ${moviesUpdateSchedule}`);
}

/**
 * Calculate the next scheduled run time based on a cron expression
 * @param cronExpression The cron expression to parse
 * @returns The next date when the job will run, or null if it can't be determined
 */
function getNextScheduledRun(cronExpression: string): Date | null {
  try {
    if (!cronExpression) return null;

    const interval = parser.parse(cronExpression);
    return interval.next().toDate();
  } catch (error) {
    cliLogger.error(`Error parsing cron expression: ${cronExpression}`, error);
    return null;
  }
}

/**
 * Get the current status of scheduled jobs
 * Useful for admin dashboards and monitoring
 */
export function getJobsStatus(): Record<
  string,
  {
    lastRunTime: Date | null;
    lastRunStatus: string;
    isRunning: boolean;
    nextRunTime: Date | null;
    cronExpression: string;
  }
> {
  return {
    showsUpdate: {
      lastRunTime: jobs.showsUpdate.lastRunTime,
      lastRunStatus: jobs.showsUpdate.lastRunStatus,
      isRunning: jobs.showsUpdate.isRunning,
      nextRunTime: getNextScheduledRun(jobs.showsUpdate.cronExpression),
      cronExpression: jobs.showsUpdate.cronExpression,
    },
    moviesUpdate: {
      lastRunTime: jobs.moviesUpdate.lastRunTime,
      lastRunStatus: jobs.moviesUpdate.lastRunStatus,
      isRunning: jobs.moviesUpdate.isRunning,
      nextRunTime: getNextScheduledRun(jobs.moviesUpdate.cronExpression),
      cronExpression: jobs.moviesUpdate.cronExpression,
    },
  };
}

/**
 * Pause all scheduled jobs
 * Useful for maintenance windows
 */
export function pauseJobs(): void {
  if (jobs.showsUpdate.job) {
    jobs.showsUpdate.job.stop();
  }

  if (jobs.moviesUpdate.job) {
    jobs.moviesUpdate.job.stop();
  }

  cliLogger.info('All scheduled jobs paused');
}

/**
 * Resume all scheduled jobs
 */
export function resumeJobs(): void {
  if (jobs.showsUpdate.job) {
    jobs.showsUpdate.job.start();
  }

  if (jobs.moviesUpdate.job) {
    jobs.moviesUpdate.job.start();
  }

  cliLogger.info('All scheduled jobs resumed');
}

/**
 * Clean up resources when shutting down
 * Should be called when the application is shutting down
 */
export function shutdownJobs(): void {
  pauseJobs();
  cliLogger.info('Job scheduler shutdown complete');
}
