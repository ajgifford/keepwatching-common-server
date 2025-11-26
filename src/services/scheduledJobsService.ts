import {
  getEmailSchedule,
  getMoviesUpdateSchedule,
  getPersonUpdateSchedule,
  getShowsUpdateSchedule,
  isEmailEnabled,
} from '../config/config';
import { appLogger, cliLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { updateMovies, updatePeople, updateShows } from './contentUpdatesService';
import { emailService } from './emailService';
import { errorService } from './errorService';
import { redisPubSubService } from './redisPubSubService';
import parser from 'cron-parser';
import cron, { ScheduledTask } from 'node-cron';

interface ScheduledJob {
  job: ScheduledTask | null;
  cronExpression: string;
  lastRunTime: Date | null;
  lastRunStatus: 'success' | 'failed' | 'never_run';
  isRunning: boolean;
}

const jobs: Record<string, ScheduledJob> = {
  showsUpdate: {
    job: null,
    cronExpression: '',
    lastRunTime: null,
    lastRunStatus: 'never_run',
    isRunning: false,
  },
  moviesUpdate: {
    job: null,
    cronExpression: '',
    lastRunTime: null,
    lastRunStatus: 'never_run',
    isRunning: false,
  },
  peopleUpdate: {
    job: null,
    cronExpression: '',
    lastRunTime: null,
    lastRunStatus: 'never_run',
    isRunning: false,
  },
  emailDigest: {
    job: null,
    cronExpression: '',
    lastRunTime: null,
    lastRunStatus: 'never_run',
    isRunning: false,
  },
};

const getScheduleConfig = () => {
  return {
    showsUpdateSchedule: getShowsUpdateSchedule(),
    moviesUpdateSchedule: getMoviesUpdateSchedule(),
    peopleUpdateSchedule: getPersonUpdateSchedule(),
    emailSchedule: getEmailSchedule(),
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
  appLogger.info('Shows update job started');

  try {
    await updateShows();

    // Publish Redis event instead of calling callback
    await redisPubSubService.publishShowsUpdate('Shows update job completed successfully');

    jobs.showsUpdate.lastRunStatus = 'success';
    cliLogger.info('Shows update job completed successfully');
    appLogger.info('Shows update job completed successfully');
    return true;
  } catch (error) {
    jobs.showsUpdate.lastRunStatus = 'failed';
    cliLogger.error('Failed to complete show update job', error);
    appLogger.error(ErrorMessages.ShowsChangeFail, { error });
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
  appLogger.info('Movies update job started');

  try {
    await updateMovies();

    // Publish Redis event instead of calling callback
    await redisPubSubService.publishMoviesUpdate('Movies update job completed successfully');

    jobs.moviesUpdate.lastRunStatus = 'success';
    cliLogger.info('Movies update job completed successfully');
    appLogger.info('Movies update job completed successfully');
    return true;
  } catch (error) {
    jobs.moviesUpdate.lastRunStatus = 'failed';
    cliLogger.error('Failed to complete movie update job', error);
    appLogger.error(ErrorMessages.MoviesChangeFail, { error });
    return false;
  } finally {
    jobs.moviesUpdate.isRunning = false;
    cliLogger.info('Ending the movie change job');
  }
}

/**
 * Run the people update job
 * Extracted into a separate function to allow manual triggering
 */
export async function runPeopleUpdateJob(): Promise<boolean> {
  if (jobs.peopleUpdate.isRunning) {
    cliLogger.warn('People update job already running, skipping this execution');
    return false;
  }

  jobs.peopleUpdate.isRunning = true;
  jobs.peopleUpdate.lastRunTime = new Date();

  cliLogger.info('Starting the people change job');
  appLogger.info('People update job started');

  try {
    await updatePeople();

    // Publish Redis event instead of calling callback
    await redisPubSubService.publishPeopleUpdate('People update job completed successfully');

    jobs.peopleUpdate.lastRunStatus = 'success';
    cliLogger.info('People update job completed successfully');
    appLogger.info('People update job completed successfully');
    return true;
  } catch (error) {
    jobs.peopleUpdate.lastRunStatus = 'failed';
    cliLogger.error('Failed to complete people update job', error);
    appLogger.error(ErrorMessages.PeopleChangeFail, { error });
    return false;
  } finally {
    jobs.peopleUpdate.isRunning = false;
    cliLogger.info('Ending the people change job');
  }
}

/**
 * Run the weekly email digest job
 * Extracted into a separate function to allow manual triggering
 */
export async function runEmailDigestJob(): Promise<boolean> {
  if (!isEmailEnabled()) {
    cliLogger.warn('Email service is disabled, skipping email digest job');
    return false;
  }

  if (jobs.emailDigest.isRunning) {
    cliLogger.warn('Email digest job already running, skipping this execution');
    return false;
  }

  jobs.emailDigest.isRunning = true;
  jobs.emailDigest.lastRunTime = new Date();

  cliLogger.info('Starting the weekly email digest job');
  appLogger.info('Weekly email digest job started');

  try {
    await emailService.sendWeeklyDigests();

    // Publish Redis event instead of calling callback
    await redisPubSubService.publishEmailDigest('Email digest job completed successfully');

    jobs.emailDigest.lastRunStatus = 'success';
    cliLogger.info('Weekly email digest job completed successfully');
    appLogger.info('Weekly email digest job completed successfully');
    return true;
  } catch (error) {
    jobs.emailDigest.lastRunStatus = 'failed';
    cliLogger.error('Failed to complete weekly email digest job', error);
    appLogger.error('Weekly email digest job failed', { error });
    return false;
  } finally {
    jobs.emailDigest.isRunning = false;
    cliLogger.info('Ending the weekly email digest job');
  }
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
 * Initialize scheduled jobs for content updates and email digests
 * Jobs will publish events to Redis pub/sub when they complete
 */
export function initScheduledJobs(): void {
  const { showsUpdateSchedule, moviesUpdateSchedule, peopleUpdateSchedule, emailSchedule } = getScheduleConfig();

  if (!cron.validate(showsUpdateSchedule)) {
    cliLogger.error(`Invalid CRON expression for shows update: ${showsUpdateSchedule}`);
    throw errorService.handleError(
      new Error(`Invalid CRON expression for shows update: ${showsUpdateSchedule}`),
      'initScheduledJobs',
    );
  }

  if (!cron.validate(moviesUpdateSchedule)) {
    cliLogger.error(`Invalid CRON expression for movies update: ${moviesUpdateSchedule}`);
    throw errorService.handleError(
      new Error(`Invalid CRON expression for movies update: ${moviesUpdateSchedule}`),
      'initScheduledJobs',
    );
  }

  if (!cron.validate(peopleUpdateSchedule)) {
    cliLogger.error(`Invalid CRON expression for people update: ${peopleUpdateSchedule}`);
    throw errorService.handleError(
      new Error(`Invalid CRON expression for people update: ${peopleUpdateSchedule}`),
      'initScheduledJobs',
    );
  }

  if (isEmailEnabled() && !cron.validate(emailSchedule)) {
    cliLogger.error(`Invalid CRON expression for email digest: ${emailSchedule}`);
    throw errorService.handleError(
      new Error(`Invalid CRON expression for email digest: ${emailSchedule}`),
      'initScheduledJobs',
    );
  }

  jobs.showsUpdate.job = cron.schedule(showsUpdateSchedule, async () => {
    try {
      await runShowsUpdateJob();
    } catch (error) {
      cliLogger.error('Unhandled error in shows update job', error);
    }
  });
  jobs.showsUpdate.cronExpression = showsUpdateSchedule;

  jobs.moviesUpdate.job = cron.schedule(moviesUpdateSchedule, async () => {
    try {
      await runMoviesUpdateJob();
    } catch (error) {
      cliLogger.error('Unhandled error in movies update job', error);
    }
  });
  jobs.moviesUpdate.cronExpression = moviesUpdateSchedule;

  jobs.peopleUpdate.job = cron.schedule(peopleUpdateSchedule, async () => {
    try {
      await runPeopleUpdateJob();
    } catch (error) {
      cliLogger.error('Unhandled error in people update job', error);
    }
  });
  jobs.peopleUpdate.cronExpression = peopleUpdateSchedule;

  if (isEmailEnabled()) {
    jobs.emailDigest.job = cron.schedule(emailSchedule, async () => {
      try {
        await runEmailDigestJob();
      } catch (error) {
        cliLogger.error('Unhandled error in email digest job', error);
      }
    });
    jobs.emailDigest.cronExpression = emailSchedule;
    jobs.emailDigest.job.start();
    cliLogger.info(`Email digest scheduled with CRON: ${emailSchedule}`);
  } else {
    cliLogger.info('Email service is disabled, skipping email digest scheduling');
  }

  // Start all jobs
  jobs.showsUpdate.job.start();
  jobs.moviesUpdate.job.start();
  jobs.peopleUpdate.job.start();

  cliLogger.info('Job Scheduler Initialized');
  cliLogger.info(`Shows update scheduled with CRON: ${showsUpdateSchedule}`);
  cliLogger.info(`Movies update scheduled with CRON: ${moviesUpdateSchedule}`);
  cliLogger.info(`People update scheduled with CRON: ${peopleUpdateSchedule}`);
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
    peopleUpdate: {
      lastRunTime: jobs.peopleUpdate.lastRunTime,
      lastRunStatus: jobs.peopleUpdate.lastRunStatus,
      isRunning: jobs.peopleUpdate.isRunning,
      nextRunTime: getNextScheduledRun(jobs.peopleUpdate.cronExpression),
      cronExpression: jobs.peopleUpdate.cronExpression,
    },
    emailDigest: {
      lastRunTime: jobs.emailDigest.lastRunTime,
      lastRunStatus: jobs.emailDigest.lastRunStatus,
      isRunning: jobs.emailDigest.isRunning,
      nextRunTime: getNextScheduledRun(jobs.emailDigest.cronExpression),
      cronExpression: jobs.emailDigest.cronExpression,
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

  if (jobs.peopleUpdate.job) {
    jobs.peopleUpdate.job.stop();
  }

  if (jobs.emailDigest.job) {
    jobs.emailDigest.job.stop();
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

  if (jobs.peopleUpdate.job) {
    jobs.peopleUpdate.job.start();
  }

  if (jobs.emailDigest.job && isEmailEnabled()) {
    jobs.emailDigest.job.start();
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

/**
 * Valid job names for manual execution and schedule updates
 */
export type JobName = 'showsUpdate' | 'moviesUpdate' | 'peopleUpdate' | 'emailDigest';

/**
 * Manually execute a scheduled job by name
 * This allows administrators to trigger jobs on-demand
 * @param jobName The name of the job to execute
 * @returns Promise<boolean> - true if job executed successfully, false otherwise
 */
export async function manuallyExecuteJob(jobName: JobName): Promise<boolean> {
  if (!jobs[jobName]) {
    cliLogger.error(`Invalid job name: ${jobName}`);
    throw new Error(`Invalid job name: ${jobName}`);
  }

  cliLogger.info(`Manually executing job: ${jobName}`);
  appLogger.info(`Manual execution requested for job: ${jobName}`);

  switch (jobName) {
    case 'showsUpdate':
      return await runShowsUpdateJob();
    case 'moviesUpdate':
      return await runMoviesUpdateJob();
    case 'peopleUpdate':
      return await runPeopleUpdateJob();
    case 'emailDigest':
      return await runEmailDigestJob();
    default:
      cliLogger.error(`Unknown job name: ${jobName}`);
      return false;
  }
}

/**
 * Update the schedule for a specific job
 * This allows dynamic modification of job schedules without restarting the service
 * @param jobName The name of the job to update
 * @param newCronExpression The new cron expression
 * @returns boolean - true if schedule was updated successfully, false otherwise
 */
export function updateJobSchedule(jobName: JobName, newCronExpression: string): boolean {
  if (!jobs[jobName]) {
    cliLogger.error(`Invalid job name: ${jobName}`);
    throw new Error(`Invalid job name: ${jobName}`);
  }

  // Validate the new cron expression
  if (!cron.validate(newCronExpression)) {
    cliLogger.error(`Invalid CRON expression for ${jobName}: ${newCronExpression}`);
    throw new Error(`Invalid CRON expression: ${newCronExpression}`);
  }

  const oldExpression = jobs[jobName].cronExpression;

  try {
    // Stop the existing job if it exists
    if (jobs[jobName].job) {
      jobs[jobName].job!.stop();
    }

    // Create a new job with the updated schedule
    const jobFunction = async () => {
      try {
        switch (jobName) {
          case 'showsUpdate':
            await runShowsUpdateJob();
            break;
          case 'moviesUpdate':
            await runMoviesUpdateJob();
            break;
          case 'peopleUpdate':
            await runPeopleUpdateJob();
            break;
          case 'emailDigest':
            await runEmailDigestJob();
            break;
        }
      } catch (error) {
        cliLogger.error(`Unhandled error in ${jobName} job`, error);
      }
    };

    jobs[jobName].job = cron.schedule(newCronExpression, jobFunction);
    jobs[jobName].cronExpression = newCronExpression;
    jobs[jobName].job.start();

    cliLogger.info(`Updated schedule for ${jobName} from "${oldExpression}" to "${newCronExpression}"`);
    appLogger.info(`Schedule updated for job: ${jobName}`, {
      oldExpression,
      newCronExpression,
    });

    return true;
  } catch (error) {
    cliLogger.error(`Failed to update schedule for ${jobName}`, error);
    appLogger.error(`Failed to update schedule for job: ${jobName}`, { error });
    return false;
  }
}

/**
 * Get the schedule for a specific job
 * @param jobName The name of the job
 * @returns The cron expression for the job
 */
export function getJobSchedule(jobName: JobName): string {
  if (!jobs[jobName]) {
    throw new Error(`Invalid job name: ${jobName}`);
  }
  return jobs[jobName].cronExpression;
}
