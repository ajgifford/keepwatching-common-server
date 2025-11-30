import * as config from '@config/config';
import { appLogger, cliLogger } from '@logger/logger';
import { updateMovies, updatePeople, updateShows } from '@services/contentUpdatesService';
import { emailService } from '@services/emailService';
import { errorService } from '@services/errorService';
import { redisPubSubService } from '@services/redisPubSubService';
import {
  getJobSchedule,
  getJobsStatus,
  initScheduledJobs,
  manuallyExecuteJob,
  pauseJobs,
  resumeJobs,
  runEmailDigestJob,
  runMoviesUpdateJob,
  runPeopleUpdateJob,
  runPerformanceArchiveJob,
  runShowsUpdateJob,
  shutdownJobs,
  updateJobSchedule,
} from '@services/scheduledJobsService';
import { archiveDailyPerformance } from '@utils/performanceArchiveUtil';
import parser from 'cron-parser';
import cron from 'node-cron';

// Mock high-level dependencies that scheduledJobsService directly uses
jest.mock('@config/config');
jest.mock('@utils/performanceArchiveUtil', () => ({
  archiveDailyPerformance: jest.fn(),
}));
jest.mock('@logger/logger', () => ({
  appLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));
jest.mock('@services/contentUpdatesService', () => ({
  updateMovies: jest.fn(),
  updatePeople: jest.fn(),
  updateShows: jest.fn(),
}));
jest.mock('@services/emailService', () => ({
  emailService: {
    sendWeeklyDigests: jest.fn(),
  },
}));
jest.mock('@services/redisPubSubService', () => ({
  redisPubSubService: {
    publishShowsUpdate: jest.fn(),
    publishMoviesUpdate: jest.fn(),
    publishPeopleUpdate: jest.fn(),
    publishEmailDigest: jest.fn(),
    publishPerformanceArchive: jest.fn(),
  },
}));
jest.mock('@services/errorService');
jest.mock('node-cron');
jest.mock('cron-parser');

describe('scheduledJobsService', () => {
  // Mock implementations
  let mockScheduledTask: {
    start: jest.Mock;
    stop: jest.Mock;
  };

  let mockCronSchedule: jest.Mock;
  let mockCronValidate: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock scheduled task
    mockScheduledTask = {
      start: jest.fn(),
      stop: jest.fn(),
    };

    // Setup cron mocks
    mockCronSchedule = jest.fn().mockReturnValue(mockScheduledTask);
    mockCronValidate = jest.fn().mockReturnValue(true);

    (cron.schedule as jest.Mock) = mockCronSchedule;
    (cron.validate as jest.Mock) = mockCronValidate;

    // Setup config mocks with default values
    (config.getShowsUpdateSchedule as jest.Mock).mockReturnValue('0 2 * * *');
    (config.getMoviesUpdateSchedule as jest.Mock).mockReturnValue('0 1 7,14,21,28 * *');
    (config.getPersonUpdateSchedule as jest.Mock).mockReturnValue('0 3 * * *');
    (config.getEmailSchedule as jest.Mock).mockReturnValue('0 9 * * 0');
    (config.getPerformanceArchiveSchedule as jest.Mock).mockReturnValue('59 23 * * *');
    (config.isEmailEnabled as jest.Mock).mockReturnValue(true);

    // Setup content update service mocks
    (updateShows as jest.Mock).mockResolvedValue(undefined);
    (updateMovies as jest.Mock).mockResolvedValue(undefined);
    (updatePeople as jest.Mock).mockResolvedValue(undefined);

    // Setup email service mock
    (emailService.sendWeeklyDigests as jest.Mock).mockResolvedValue(undefined);

    // Setup performance archive mock
    (archiveDailyPerformance as jest.Mock).mockResolvedValue(undefined);

    // Setup error service mock - should pass through the error that was given to it
    (errorService.handleError as jest.Mock).mockImplementation((error) => error);

    // Setup cron-parser mock
    const mockInterval = {
      next: jest.fn().mockReturnValue({
        toDate: jest.fn().mockReturnValue(new Date('2025-04-01T02:00:00Z')),
      }),
    };
    (parser.parse as jest.Mock).mockReturnValue(mockInterval);

    // Setup logger mocks
    (cliLogger.info as jest.Mock).mockImplementation(() => {});
    (cliLogger.error as jest.Mock).mockImplementation(() => {});
    (cliLogger.warn as jest.Mock).mockImplementation(() => {});
    (appLogger.info as jest.Mock).mockImplementation(() => {});
    (appLogger.error as jest.Mock).mockImplementation(() => {});
  });

  describe('initScheduledJobs', () => {
    it('should validate all cron expressions before scheduling', async () => {
      await initScheduledJobs();

      expect(mockCronValidate).toHaveBeenCalledWith('0 2 * * *');
      expect(mockCronValidate).toHaveBeenCalledWith('0 1 7,14,21,28 * *');
      expect(mockCronValidate).toHaveBeenCalledWith('0 3 * * *');
      expect(mockCronValidate).toHaveBeenCalledWith('0 9 * * 0');
      expect(mockCronValidate).toHaveBeenCalledWith('59 23 * * *');
    });

    it('should throw error if shows update cron expression is invalid', async () => {
      mockCronValidate.mockReturnValue(false);

      await expect(initScheduledJobs()).rejects.toThrow('Invalid CRON expression for shows update');

      expect(cliLogger.error).toHaveBeenCalledWith('Invalid CRON expression for shows update: 0 2 * * *');
    });

    it('should throw error if movies update cron expression is invalid', async () => {
      mockCronValidate
        .mockReturnValueOnce(true) // shows valid
        .mockReturnValueOnce(false); // movies invalid

      await expect(initScheduledJobs()).rejects.toThrow('Invalid CRON expression for movies update');
    });

    it('should throw error if people update cron expression is invalid', async () => {
      mockCronValidate
        .mockReturnValueOnce(true) // shows valid
        .mockReturnValueOnce(true) // movies valid
        .mockReturnValueOnce(false); // people invalid

      await expect(initScheduledJobs()).rejects.toThrow('Invalid CRON expression for people update');
    });

    it('should schedule all five jobs when email is enabled', async () => {
      await initScheduledJobs();

      expect(mockCronSchedule).toHaveBeenCalledTimes(5);
      expect(mockCronSchedule).toHaveBeenCalledWith('0 2 * * *', expect.any(Function));
      expect(mockCronSchedule).toHaveBeenCalledWith('0 1 7,14,21,28 * *', expect.any(Function));
      expect(mockCronSchedule).toHaveBeenCalledWith('0 3 * * *', expect.any(Function));
      expect(mockCronSchedule).toHaveBeenCalledWith('0 9 * * 0', expect.any(Function));
      expect(mockCronSchedule).toHaveBeenCalledWith('59 23 * * *', expect.any(Function));
    });

    it('should start all scheduled jobs', async () => {
      await initScheduledJobs();

      expect(mockScheduledTask.start).toHaveBeenCalledTimes(5);
    });

    it('should skip email job when email is disabled', async () => {
      (config.isEmailEnabled as jest.Mock).mockReturnValue(false);

      await initScheduledJobs();

      expect(mockCronSchedule).toHaveBeenCalledTimes(4);
      expect(mockCronSchedule).not.toHaveBeenCalledWith('0 9 * * 0', expect.any(Function));
      expect(cliLogger.info).toHaveBeenCalledWith('Email service is disabled, skipping email digest scheduling');
    });

    it('should throw error if email cron is invalid when email is enabled', async () => {
      mockCronValidate
        .mockReturnValueOnce(true) // shows valid
        .mockReturnValueOnce(true) // movies valid
        .mockReturnValueOnce(true) // people valid
        .mockReturnValueOnce(false) // email invalid
        .mockReturnValueOnce(true); // performanceArchive valid

      await expect(initScheduledJobs()).rejects.toThrow('Invalid CRON expression for email digest');
    });

    it('should not validate email cron when email is disabled', async () => {
      (config.isEmailEnabled as jest.Mock).mockReturnValue(false);

      await initScheduledJobs();

      expect(mockCronValidate).toHaveBeenCalledTimes(4); // Only shows, movies, people, performanceArchive
    });

    it('should throw error if performance archive cron expression is invalid', async () => {
      mockCronValidate
        .mockReturnValueOnce(true) // shows valid
        .mockReturnValueOnce(true) // movies valid
        .mockReturnValueOnce(true) // people valid
        .mockReturnValueOnce(true) // email valid
        .mockReturnValueOnce(false); // performanceArchive invalid

      await expect(initScheduledJobs()).rejects.toThrow('Invalid CRON expression for performance archive');
    });

    it('should log initialization success', async () => {
      await initScheduledJobs();

      expect(cliLogger.info).toHaveBeenCalledWith('Job Scheduler Initialized');
      expect(cliLogger.info).toHaveBeenCalledWith('Shows update scheduled with CRON: 0 2 * * *');
      expect(cliLogger.info).toHaveBeenCalledWith('Movies update scheduled with CRON: 0 1 7,14,21,28 * *');
      expect(cliLogger.info).toHaveBeenCalledWith('People update scheduled with CRON: 0 3 * * *');
    });
  });

  describe('runShowsUpdateJob', () => {
    it('should execute shows update and invoke callback on success', async () => {
      await initScheduledJobs();

      const result = await runShowsUpdateJob();

      expect(result).toBe(true);
      expect(updateShows).toHaveBeenCalledTimes(1);
      expect(redisPubSubService.publishShowsUpdate).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Starting the show change job');
      expect(cliLogger.info).toHaveBeenCalledWith('Shows update job completed successfully');
      expect(appLogger.info).toHaveBeenCalledWith('Shows update job started');
      expect(appLogger.info).toHaveBeenCalledWith('Shows update job completed successfully');
    });

    it('should handle errors and not invoke callback on failure', async () => {
      const testError = new Error('Shows update failed');
      (updateShows as jest.Mock).mockRejectedValueOnce(testError);

      await initScheduledJobs();
      const result = await runShowsUpdateJob();

      expect(result).toBe(false);
      expect(redisPubSubService.publishShowsUpdate).not.toHaveBeenCalled();
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to complete show update job', testError);
      expect(appLogger.error).toHaveBeenCalled();
    });

    it('should prevent concurrent execution', async () => {
      (updateShows as jest.Mock).mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const firstCall = runShowsUpdateJob();
      const secondCall = runShowsUpdateJob();

      await firstCall;
      const secondResult = await secondCall;

      expect(secondResult).toBe(false);
      expect(cliLogger.warn).toHaveBeenCalledWith('Shows update job already running, skipping this execution');
      expect(updateShows).toHaveBeenCalledTimes(1);
    });

    it('should track last run time and status', async () => {
      await runShowsUpdateJob();

      const status = getJobsStatus();
      expect(status.showsUpdate.lastRunTime).not.toBeNull();
      expect(status.showsUpdate.lastRunStatus).toBe('success');
      expect(status.showsUpdate.isRunning).toBe(false);
    });

    it('should reset isRunning flag even if update throws', async () => {
      (updateShows as jest.Mock).mockRejectedValueOnce(new Error('Failed'));

      await runShowsUpdateJob();

      const status = getJobsStatus();
      expect(status.showsUpdate.isRunning).toBe(false);
      expect(status.showsUpdate.lastRunStatus).toBe('failed');
    });

    it('should work without callback being initialized', async () => {
      const result = await runShowsUpdateJob();

      expect(result).toBe(true);
      expect(updateShows).toHaveBeenCalledTimes(1);
    });
  });

  describe('runMoviesUpdateJob', () => {
    it('should execute movies update and invoke callback on success', async () => {
      await initScheduledJobs();

      const result = await runMoviesUpdateJob();

      expect(result).toBe(true);
      expect(updateMovies).toHaveBeenCalledTimes(1);
      expect(redisPubSubService.publishMoviesUpdate).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Starting the movie change job');
      expect(appLogger.info).toHaveBeenCalledWith('Movies update job started');
    });

    it('should handle errors gracefully', async () => {
      const testError = new Error('Movies update failed');
      (updateMovies as jest.Mock).mockRejectedValueOnce(testError);

      const result = await runMoviesUpdateJob();

      expect(result).toBe(false);
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to complete movie update job', testError);
    });

    it('should prevent concurrent execution', async () => {
      (updateMovies as jest.Mock).mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const firstCall = runMoviesUpdateJob();
      const secondCall = runMoviesUpdateJob();

      await firstCall;
      const secondResult = await secondCall;

      expect(secondResult).toBe(false);
      expect(cliLogger.warn).toHaveBeenCalledWith('Movies update job already running, skipping this execution');
    });
  });

  describe('runPeopleUpdateJob', () => {
    it('should execute people update and invoke callback on success', async () => {
      await initScheduledJobs();

      const result = await runPeopleUpdateJob();

      expect(result).toBe(true);
      expect(updatePeople).toHaveBeenCalledTimes(1);
      expect(redisPubSubService.publishPeopleUpdate).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Starting the people change job');
      expect(appLogger.info).toHaveBeenCalledWith('People update job started');
    });

    it('should handle errors gracefully', async () => {
      const testError = new Error('People update failed');
      (updatePeople as jest.Mock).mockRejectedValueOnce(testError);

      const result = await runPeopleUpdateJob();

      expect(result).toBe(false);
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to complete people update job', testError);
    });

    it('should work when callback is not provided', async () => {
      await initScheduledJobs();

      const result = await runPeopleUpdateJob();

      expect(result).toBe(true);
      expect(updatePeople).toHaveBeenCalledTimes(1);
    });

    it('should prevent concurrent execution', async () => {
      (updatePeople as jest.Mock).mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const firstCall = runPeopleUpdateJob();
      const secondCall = runPeopleUpdateJob();

      await firstCall;
      const secondResult = await secondCall;

      expect(secondResult).toBe(false);
      expect(cliLogger.warn).toHaveBeenCalledWith('People update job already running, skipping this execution');
    });
  });

  describe('runPerformanceArchiveJob', () => {
    it('should execute performance archive and invoke callback on success', async () => {
      await initScheduledJobs();

      const result = await runPerformanceArchiveJob();

      expect(result).toBe(true);
      expect(archiveDailyPerformance).toHaveBeenCalledTimes(1);
      expect(redisPubSubService.publishPerformanceArchive).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Starting the performance archive job');
      expect(appLogger.info).toHaveBeenCalledWith('Performance archive job started');
    });

    it('should handle errors gracefully', async () => {
      const testError = new Error('Performance archive failed');
      (archiveDailyPerformance as jest.Mock).mockRejectedValueOnce(testError);

      const result = await runPerformanceArchiveJob();

      expect(result).toBe(false);
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to complete performance archive job', testError);
      expect(appLogger.error).toHaveBeenCalledWith('Performance archive job failed', {
        error: testError,
      });
    });

    it('should prevent concurrent execution', async () => {
      (archiveDailyPerformance as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      const firstCall = runPerformanceArchiveJob();
      const secondCall = runPerformanceArchiveJob();

      await firstCall;
      const secondResult = await secondCall;

      expect(secondResult).toBe(false);
      expect(cliLogger.warn).toHaveBeenCalledWith('Performance archive job already running, skipping this execution');
    });

    it('should track last run time and status', async () => {
      await runPerformanceArchiveJob();

      const status = getJobsStatus();
      expect(status.performanceArchive.lastRunTime).not.toBeNull();
      expect(status.performanceArchive.lastRunStatus).toBe('success');
      expect(status.performanceArchive.isRunning).toBe(false);
    });

    it('should reset isRunning flag even if archive throws', async () => {
      (archiveDailyPerformance as jest.Mock).mockRejectedValueOnce(new Error('Failed'));

      await runPerformanceArchiveJob();

      const status = getJobsStatus();
      expect(status.performanceArchive.isRunning).toBe(false);
      expect(status.performanceArchive.lastRunStatus).toBe('failed');
    });
  });

  describe('runEmailDigestJob', () => {
    it('should skip execution when email is disabled', async () => {
      (config.isEmailEnabled as jest.Mock).mockReturnValue(false);

      const result = await runEmailDigestJob();

      expect(result).toBe(false);
      expect(emailService.sendWeeklyDigests).not.toHaveBeenCalled();
      expect(cliLogger.warn).toHaveBeenCalledWith('Email service is disabled, skipping email digest job');
    });

    it('should execute email digest and invoke callback on success', async () => {
      await initScheduledJobs();

      const result = await runEmailDigestJob();

      expect(result).toBe(true);
      expect(emailService.sendWeeklyDigests).toHaveBeenCalledTimes(1);
      expect(redisPubSubService.publishEmailDigest).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Starting the weekly email digest job');
      expect(appLogger.info).toHaveBeenCalledWith('Weekly email digest job started');
    });

    it('should handle errors gracefully', async () => {
      const testError = new Error('Email digest failed');
      (emailService.sendWeeklyDigests as jest.Mock).mockRejectedValueOnce(testError);

      const result = await runEmailDigestJob();

      expect(result).toBe(false);
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to complete weekly email digest job', testError);
      expect(appLogger.error).toHaveBeenCalledWith('Weekly email digest job failed', {
        error: testError,
      });
    });

    it('should prevent concurrent execution', async () => {
      (emailService.sendWeeklyDigests as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      const firstCall = runEmailDigestJob();
      const secondCall = runEmailDigestJob();

      await firstCall;
      const secondResult = await secondCall;

      expect(secondResult).toBe(false);
      expect(cliLogger.warn).toHaveBeenCalledWith('Email digest job already running, skipping this execution');
    });

    it('should work when callback is not provided', async () => {
      await initScheduledJobs();

      const result = await runEmailDigestJob();

      expect(result).toBe(true);
      expect(emailService.sendWeeklyDigests).toHaveBeenCalledTimes(1);
    });
  });

  describe('getJobsStatus', () => {
    it('should return status for all jobs with default values', () => {
      const status = getJobsStatus();

      expect(status).toHaveProperty('showsUpdate');
      expect(status).toHaveProperty('moviesUpdate');
      expect(status).toHaveProperty('peopleUpdate');
      expect(status).toHaveProperty('emailDigest');
      expect(status).toHaveProperty('performanceArchive');

      // Check structure of each job status
      Object.values(status).forEach((jobStatus) => {
        expect(jobStatus).toHaveProperty('lastRunTime');
        expect(jobStatus).toHaveProperty('lastRunStatus');
        expect(jobStatus).toHaveProperty('isRunning');
        expect(jobStatus).toHaveProperty('nextRunTime');
        expect(jobStatus).toHaveProperty('cronExpression');
      });
    });

    it('should calculate next run time from cron expression', async () => {
      await initScheduledJobs();

      const status = getJobsStatus();

      expect(parser.parse).toHaveBeenCalledWith('0 2 * * *');
      expect(parser.parse).toHaveBeenCalledWith('0 1 7,14,21,28 * *');
      expect(parser.parse).toHaveBeenCalledWith('0 3 * * *');
      expect(parser.parse).toHaveBeenCalledWith('0 9 * * 0');
      expect(parser.parse).toHaveBeenCalledWith('59 23 * * *');

      expect(status.showsUpdate.nextRunTime).toEqual('2025-04-01T02:00:00.000Z');
    });

    it('should return null for nextRunTime when cron expression is empty', () => {
      // Get status before initScheduledJobs is called
      // This test validates the default state before initialization
      // We need to clear any state from previous tests by resetting the module
      jest.resetModules();

      // Re-import to get fresh module state
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getJobsStatus: freshGetJobsStatus } = require('@services/scheduledJobsService');
      const status = freshGetJobsStatus();

      expect(status.showsUpdate.cronExpression).toBe('');
      expect(status.showsUpdate.nextRunTime).toBeNull();
    });

    it('should handle errors when parsing cron expression', async () => {
      await initScheduledJobs();
      (parser.parse as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid cron');
      });

      const status = getJobsStatus();

      expect(status.showsUpdate.nextRunTime).toBeNull();
      expect(cliLogger.error).toHaveBeenCalled();
    });

    it('should reflect current job execution state', async () => {
      (updateShows as jest.Mock).mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const executionPromise = runShowsUpdateJob();

      // Check status while job is running
      const runningStatus = getJobsStatus();
      expect(runningStatus.showsUpdate.isRunning).toBe(true);

      await executionPromise;

      // Check status after job completes
      const completedStatus = getJobsStatus();
      expect(completedStatus.showsUpdate.isRunning).toBe(false);
      expect(completedStatus.showsUpdate.lastRunStatus).toBe('success');
      expect(completedStatus.showsUpdate.lastRunTime).not.toBeNull();
    });
  });

  describe('pauseJobs and resumeJobs', () => {
    it('should pause all scheduled jobs', async () => {
      await initScheduledJobs();

      pauseJobs();

      expect(mockScheduledTask.stop).toHaveBeenCalledTimes(5);
      expect(cliLogger.info).toHaveBeenCalledWith('All scheduled jobs paused');
    });

    it('should resume all scheduled jobs when email is enabled', async () => {
      await initScheduledJobs();
      jest.clearAllMocks();

      resumeJobs();

      expect(mockScheduledTask.start).toHaveBeenCalledTimes(5);
      expect(cliLogger.info).toHaveBeenCalledWith('All scheduled jobs resumed');
    });

    it('should not resume email job when email is disabled', async () => {
      (config.isEmailEnabled as jest.Mock).mockReturnValue(false);
      await initScheduledJobs();
      jest.clearAllMocks();

      resumeJobs();

      expect(mockScheduledTask.start).toHaveBeenCalledTimes(4); // Only shows, movies, people, performanceArchive
    });

    it('should handle pause/resume when jobs are not initialized', () => {
      expect(() => {
        pauseJobs();
        resumeJobs();
      }).not.toThrow();

      expect(cliLogger.info).toHaveBeenCalledWith('All scheduled jobs paused');
      expect(cliLogger.info).toHaveBeenCalledWith('All scheduled jobs resumed');
    });
  });

  describe('shutdownJobs', () => {
    it('should stop all jobs and log shutdown', async () => {
      await initScheduledJobs();
      jest.clearAllMocks();

      await shutdownJobs();

      expect(mockScheduledTask.stop).toHaveBeenCalledTimes(5);
      expect(cliLogger.info).toHaveBeenCalledWith('All scheduled jobs paused');
      expect(cliLogger.info).toHaveBeenCalledWith('Job scheduler shutdown complete');
    });

    it('should handle shutdown when jobs are not initialized', async () => {
      await expect(shutdownJobs()).resolves.not.toThrow();

      expect(cliLogger.info).toHaveBeenCalledWith('Job scheduler shutdown complete');
    });
  });

  describe('scheduled job execution via cron', () => {
    it('should execute shows update job when cron triggers', async () => {
      await initScheduledJobs();

      // Get the function passed to cron.schedule for shows update
      const cronCallback = mockCronSchedule.mock.calls[0][1];

      // Execute the cron callback
      await cronCallback();

      expect(updateShows).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in cron callback without crashing', async () => {
      (updateShows as jest.Mock).mockRejectedValueOnce(new Error('Cron execution failed'));

      await initScheduledJobs();

      const cronCallback = mockCronSchedule.mock.calls[0][1];

      // This should not throw
      await expect(cronCallback()).resolves.not.toThrow();

      expect(cliLogger.error).toHaveBeenCalledWith('Failed to complete show update job', expect.any(Error));
    });
  });

  describe('manuallyExecuteJob', () => {
    it('should execute showsUpdate job when requested', async () => {
      const result = await manuallyExecuteJob('showsUpdate');

      expect(result).toBe(true);
      expect(updateShows).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Manually executing job: showsUpdate');
      expect(appLogger.info).toHaveBeenCalledWith('Manual execution requested for job: showsUpdate');
    });

    it('should execute moviesUpdate job when requested', async () => {
      const result = await manuallyExecuteJob('moviesUpdate');

      expect(result).toBe(true);
      expect(updateMovies).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Manually executing job: moviesUpdate');
    });

    it('should execute peopleUpdate job when requested', async () => {
      const result = await manuallyExecuteJob('peopleUpdate');

      expect(result).toBe(true);
      expect(updatePeople).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Manually executing job: peopleUpdate');
    });

    it('should execute emailDigest job when requested and email is enabled', async () => {
      const result = await manuallyExecuteJob('emailDigest');

      expect(result).toBe(true);
      expect(emailService.sendWeeklyDigests).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Manually executing job: emailDigest');
    });

    it('should execute performanceArchive job when requested', async () => {
      const result = await manuallyExecuteJob('performanceArchive');

      expect(result).toBe(true);
      expect(archiveDailyPerformance).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Manually executing job: performanceArchive');
    });

    it('should throw error for invalid job name', async () => {
      await expect(manuallyExecuteJob('invalidJob' as any)).rejects.toThrow('Invalid job name: invalidJob');
      expect(cliLogger.error).toHaveBeenCalledWith('Invalid job name: invalidJob');
    });

    it('should return false if emailDigest job fails when email is disabled', async () => {
      (config.isEmailEnabled as jest.Mock).mockReturnValue(false);

      const result = await manuallyExecuteJob('emailDigest');

      expect(result).toBe(false);
      expect(emailService.sendWeeklyDigests).not.toHaveBeenCalled();
    });

    it('should return false if job execution fails', async () => {
      (updateShows as jest.Mock).mockRejectedValueOnce(new Error('Job failed'));

      const result = await manuallyExecuteJob('showsUpdate');

      expect(result).toBe(false);
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to complete show update job', expect.any(Error));
    });
  });

  describe('updateJobSchedule', () => {
    beforeEach(async () => {
      await initScheduledJobs();
      jest.clearAllMocks();
    });

    it('should update schedule for showsUpdate job', () => {
      const newSchedule = '0 5 * * *';
      const result = updateJobSchedule('showsUpdate', newSchedule);

      expect(result).toBe(true);
      expect(mockScheduledTask.stop).toHaveBeenCalled();
      expect(mockCronSchedule).toHaveBeenCalledWith(newSchedule, expect.any(Function));
      expect(mockScheduledTask.start).toHaveBeenCalled();
      expect(cliLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Updated schedule for showsUpdate from "0 2 * * *" to "0 5 * * *"'),
      );
    });

    it('should update schedule for moviesUpdate job', () => {
      const newSchedule = '0 6 * * *';
      const result = updateJobSchedule('moviesUpdate', newSchedule);

      expect(result).toBe(true);
      expect(mockCronSchedule).toHaveBeenCalledWith(newSchedule, expect.any(Function));
    });

    it('should update schedule for peopleUpdate job', () => {
      const newSchedule = '0 7 * * *';
      const result = updateJobSchedule('peopleUpdate', newSchedule);

      expect(result).toBe(true);
      expect(mockCronSchedule).toHaveBeenCalledWith(newSchedule, expect.any(Function));
    });

    it('should update schedule for emailDigest job', () => {
      const newSchedule = '0 10 * * 0';
      const result = updateJobSchedule('emailDigest', newSchedule);

      expect(result).toBe(true);
      expect(mockCronSchedule).toHaveBeenCalledWith(newSchedule, expect.any(Function));
    });

    it('should update schedule for performanceArchive job', () => {
      const newSchedule = '0 2 * * *';
      const result = updateJobSchedule('performanceArchive', newSchedule);

      expect(result).toBe(true);
      expect(mockCronSchedule).toHaveBeenCalledWith(newSchedule, expect.any(Function));
    });

    it('should throw error for invalid job name', () => {
      expect(() => updateJobSchedule('invalidJob' as any, '0 5 * * *')).toThrow('Invalid job name: invalidJob');
      expect(cliLogger.error).toHaveBeenCalledWith('Invalid job name: invalidJob');
    });

    it('should throw error for invalid cron expression', () => {
      mockCronValidate.mockReturnValue(false);

      expect(() => updateJobSchedule('showsUpdate', 'invalid cron')).toThrow('Invalid CRON expression: invalid cron');
      expect(cliLogger.error).toHaveBeenCalledWith('Invalid CRON expression for showsUpdate: invalid cron');
    });

    it('should return false and log error if schedule update fails', () => {
      mockCronSchedule.mockImplementation(() => {
        throw new Error('Scheduling failed');
      });

      const result = updateJobSchedule('showsUpdate', '0 5 * * *');

      expect(result).toBe(false);
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to update schedule for showsUpdate', expect.any(Error));
      expect(appLogger.error).toHaveBeenCalledWith('Failed to update schedule for job: showsUpdate', {
        error: expect.any(Error),
      });
    });

    it('should execute the correct job function after schedule update', async () => {
      updateJobSchedule('showsUpdate', '0 5 * * *');

      // Get the new scheduled function
      const newCronCallback = mockCronSchedule.mock.calls[mockCronSchedule.mock.calls.length - 1][1];

      // Execute it
      await newCronCallback();

      expect(updateShows).toHaveBeenCalled();
    });
  });

  describe('getJobSchedule', () => {
    it('should return cron expression after initialization', async () => {
      await initScheduledJobs();

      expect(getJobSchedule('showsUpdate')).toBe('0 2 * * *');
      expect(getJobSchedule('moviesUpdate')).toBe('0 1 7,14,21,28 * *');
      expect(getJobSchedule('peopleUpdate')).toBe('0 3 * * *');
      expect(getJobSchedule('emailDigest')).toBe('0 9 * * 0');
      expect(getJobSchedule('performanceArchive')).toBe('59 23 * * *');
    });

    it('should return updated schedule after updateJobSchedule', async () => {
      await initScheduledJobs();

      updateJobSchedule('showsUpdate', '0 5 * * *');

      expect(getJobSchedule('showsUpdate')).toBe('0 5 * * *');
    });

    it('should throw error for invalid job name', () => {
      expect(() => getJobSchedule('invalidJob' as any)).toThrow('Invalid job name: invalidJob');
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple job executions with different outcomes', async () => {
      // First execution succeeds
      await runShowsUpdateJob();
      let status = getJobsStatus();
      expect(status.showsUpdate.lastRunStatus).toBe('success');

      // Second execution fails
      (updateShows as jest.Mock).mockRejectedValueOnce(new Error('Failed'));
      await runShowsUpdateJob();
      status = getJobsStatus();
      expect(status.showsUpdate.lastRunStatus).toBe('failed');

      // Third execution succeeds
      (updateShows as jest.Mock).mockResolvedValueOnce(undefined);
      await runShowsUpdateJob();
      status = getJobsStatus();
      expect(status.showsUpdate.lastRunStatus).toBe('success');
    });

    it('should maintain independent state for each job type', async () => {
      (updateShows as jest.Mock).mockResolvedValueOnce(undefined);
      (updateMovies as jest.Mock).mockRejectedValueOnce(new Error('Failed'));

      await runShowsUpdateJob();
      await runMoviesUpdateJob();

      const status = getJobsStatus();
      expect(status.showsUpdate.lastRunStatus).toBe('success');
      expect(status.moviesUpdate.lastRunStatus).toBe('failed');
    });

    it('should allow re-initialization with different schedules', async () => {
      // First initialization
      await initScheduledJobs();

      // Change schedules
      (config.getShowsUpdateSchedule as jest.Mock).mockReturnValue('0 4 * * *');
      (config.getMoviesUpdateSchedule as jest.Mock).mockReturnValue('0 2 1,15 * *');

      // Re-initialize
      await initScheduledJobs();

      expect(mockCronSchedule).toHaveBeenCalledWith('0 4 * * *', expect.any(Function));
      expect(mockCronSchedule).toHaveBeenCalledWith('0 2 1,15 * *', expect.any(Function));
    });
  });
});
