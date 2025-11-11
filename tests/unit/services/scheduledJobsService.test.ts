import * as config from '@config/config';
import { appLogger, cliLogger } from '@logger/logger';
import { updateMovies, updatePeople, updateShows } from '@services/contentUpdatesService';
import { emailService } from '@services/emailService';
import { errorService } from '@services/errorService';
import {
  getJobsStatus,
  initScheduledJobs,
  pauseJobs,
  resumeJobs,
  runEmailDigestJob,
  runMoviesUpdateJob,
  runPeopleUpdateJob,
  runShowsUpdateJob,
  shutdownJobs,
} from '@services/scheduledJobsService';
import parser from 'cron-parser';
import cron from 'node-cron';

// Mock high-level dependencies that scheduledJobsService directly uses
jest.mock('@config/config');
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
    (config.isEmailEnabled as jest.Mock).mockReturnValue(true);

    // Setup content update service mocks
    (updateShows as jest.Mock).mockResolvedValue(undefined);
    (updateMovies as jest.Mock).mockResolvedValue(undefined);
    (updatePeople as jest.Mock).mockResolvedValue(undefined);

    // Setup email service mock
    (emailService.sendWeeklyDigests as jest.Mock).mockResolvedValue(undefined);

    // Setup error service mock
    (errorService.handleError as jest.Mock).mockImplementation((error) => {
      throw error;
    });

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
    it('should validate all cron expressions before scheduling', () => {
      const mockCallbacks = {
        showUpdates: jest.fn(),
        movieUpdates: jest.fn(),
        peopleUpdates: jest.fn(),
        emailDigest: jest.fn(),
      };

      initScheduledJobs(
        mockCallbacks.showUpdates,
        mockCallbacks.movieUpdates,
        mockCallbacks.peopleUpdates,
        mockCallbacks.emailDigest,
      );

      expect(mockCronValidate).toHaveBeenCalledWith('0 2 * * *');
      expect(mockCronValidate).toHaveBeenCalledWith('0 1 7,14,21,28 * *');
      expect(mockCronValidate).toHaveBeenCalledWith('0 3 * * *');
      expect(mockCronValidate).toHaveBeenCalledWith('0 9 * * 0');
    });

    it('should throw error if shows update cron expression is invalid', () => {
      mockCronValidate.mockReturnValue(false);

      expect(() => {
        initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());
      }).toThrow('Invalid CRON expression for shows update');

      expect(cliLogger.error).toHaveBeenCalledWith('Invalid CRON expression for shows update: 0 2 * * *');
    });

    it('should throw error if movies update cron expression is invalid', () => {
      mockCronValidate
        .mockReturnValueOnce(true) // shows valid
        .mockReturnValueOnce(false); // movies invalid

      expect(() => {
        initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());
      }).toThrow('Invalid CRON expression for movies update');
    });

    it('should throw error if people update cron expression is invalid', () => {
      mockCronValidate
        .mockReturnValueOnce(true) // shows valid
        .mockReturnValueOnce(true) // movies valid
        .mockReturnValueOnce(false); // people invalid

      expect(() => {
        initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());
      }).toThrow('Invalid CRON expression for people update');
    });

    it('should schedule all four jobs when email is enabled', () => {
      initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());

      expect(mockCronSchedule).toHaveBeenCalledTimes(4);
      expect(mockCronSchedule).toHaveBeenCalledWith('0 2 * * *', expect.any(Function));
      expect(mockCronSchedule).toHaveBeenCalledWith('0 1 7,14,21,28 * *', expect.any(Function));
      expect(mockCronSchedule).toHaveBeenCalledWith('0 3 * * *', expect.any(Function));
      expect(mockCronSchedule).toHaveBeenCalledWith('0 9 * * 0', expect.any(Function));
    });

    it('should start all scheduled jobs', () => {
      initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());

      expect(mockScheduledTask.start).toHaveBeenCalledTimes(4);
    });

    it('should skip email job when email is disabled', () => {
      (config.isEmailEnabled as jest.Mock).mockReturnValue(false);

      initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());

      expect(mockCronSchedule).toHaveBeenCalledTimes(3);
      expect(mockCronSchedule).not.toHaveBeenCalledWith('0 9 * * 0', expect.any(Function));
      expect(cliLogger.info).toHaveBeenCalledWith('Email service is disabled, skipping email digest scheduling');
    });

    it('should throw error if email cron is invalid when email is enabled', () => {
      mockCronValidate
        .mockReturnValueOnce(true) // shows valid
        .mockReturnValueOnce(true) // movies valid
        .mockReturnValueOnce(true) // people valid
        .mockReturnValueOnce(false); // email invalid

      expect(() => {
        initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());
      }).toThrow('Invalid CRON expression for email digest');
    });

    it('should not validate email cron when email is disabled', () => {
      (config.isEmailEnabled as jest.Mock).mockReturnValue(false);

      initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());

      expect(mockCronValidate).toHaveBeenCalledTimes(3); // Only shows, movies, people
    });

    it('should log initialization success', () => {
      initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());

      expect(cliLogger.info).toHaveBeenCalledWith('Job Scheduler Initialized');
      expect(cliLogger.info).toHaveBeenCalledWith('Shows update scheduled with CRON: 0 2 * * *');
      expect(cliLogger.info).toHaveBeenCalledWith('Movies update scheduled with CRON: 0 1 7,14,21,28 * *');
      expect(cliLogger.info).toHaveBeenCalledWith('People update scheduled with CRON: 0 3 * * *');
    });
  });

  describe('runShowsUpdateJob', () => {
    it('should execute shows update and invoke callback on success', async () => {
      const mockCallback = jest.fn();
      initScheduledJobs(mockCallback, jest.fn(), jest.fn(), jest.fn());

      const result = await runShowsUpdateJob();

      expect(result).toBe(true);
      expect(updateShows).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Starting the show change job');
      expect(cliLogger.info).toHaveBeenCalledWith('Shows update job completed successfully');
      expect(appLogger.info).toHaveBeenCalledWith('Shows update job started');
      expect(appLogger.info).toHaveBeenCalledWith('Shows update job completed successfully');
    });

    it('should handle errors and not invoke callback on failure', async () => {
      const mockCallback = jest.fn();
      const testError = new Error('Shows update failed');
      (updateShows as jest.Mock).mockRejectedValueOnce(testError);

      initScheduledJobs(mockCallback, jest.fn(), jest.fn(), jest.fn());
      const result = await runShowsUpdateJob();

      expect(result).toBe(false);
      expect(mockCallback).not.toHaveBeenCalled();
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
      const mockCallback = jest.fn();
      initScheduledJobs(jest.fn(), mockCallback, jest.fn(), jest.fn());

      const result = await runMoviesUpdateJob();

      expect(result).toBe(true);
      expect(updateMovies).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledTimes(1);
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
      const mockCallback = jest.fn();
      initScheduledJobs(jest.fn(), jest.fn(), mockCallback, jest.fn());

      const result = await runPeopleUpdateJob();

      expect(result).toBe(true);
      expect(updatePeople).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledTimes(1);
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
      initScheduledJobs(jest.fn(), jest.fn(), undefined, jest.fn());

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

  describe('runEmailDigestJob', () => {
    it('should skip execution when email is disabled', async () => {
      (config.isEmailEnabled as jest.Mock).mockReturnValue(false);

      const result = await runEmailDigestJob();

      expect(result).toBe(false);
      expect(emailService.sendWeeklyDigests).not.toHaveBeenCalled();
      expect(cliLogger.warn).toHaveBeenCalledWith('Email service is disabled, skipping email digest job');
    });

    it('should execute email digest and invoke callback on success', async () => {
      const mockCallback = jest.fn();
      initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), mockCallback);

      const result = await runEmailDigestJob();

      expect(result).toBe(true);
      expect(emailService.sendWeeklyDigests).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledTimes(1);
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
      initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), undefined);

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

      // Check structure of each job status
      Object.values(status).forEach((jobStatus) => {
        expect(jobStatus).toHaveProperty('lastRunTime');
        expect(jobStatus).toHaveProperty('lastRunStatus');
        expect(jobStatus).toHaveProperty('isRunning');
        expect(jobStatus).toHaveProperty('nextRunTime');
        expect(jobStatus).toHaveProperty('cronExpression');
      });
    });

    it('should calculate next run time from cron expression', () => {
      initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());

      const status = getJobsStatus();

      expect(parser.parse).toHaveBeenCalledWith('0 2 * * *');
      expect(parser.parse).toHaveBeenCalledWith('0 1 7,14,21,28 * *');
      expect(parser.parse).toHaveBeenCalledWith('0 3 * * *');
      expect(parser.parse).toHaveBeenCalledWith('0 9 * * 0');

      expect(status.showsUpdate.nextRunTime).toEqual(new Date('2025-04-01T02:00:00Z'));
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

    it('should handle errors when parsing cron expression', () => {
      initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());
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
    it('should pause all scheduled jobs', () => {
      initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());

      pauseJobs();

      expect(mockScheduledTask.stop).toHaveBeenCalledTimes(4);
      expect(cliLogger.info).toHaveBeenCalledWith('All scheduled jobs paused');
    });

    it('should resume all scheduled jobs when email is enabled', () => {
      initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());
      jest.clearAllMocks();

      resumeJobs();

      expect(mockScheduledTask.start).toHaveBeenCalledTimes(4);
      expect(cliLogger.info).toHaveBeenCalledWith('All scheduled jobs resumed');
    });

    it('should not resume email job when email is disabled', () => {
      (config.isEmailEnabled as jest.Mock).mockReturnValue(false);
      initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());
      jest.clearAllMocks();

      resumeJobs();

      expect(mockScheduledTask.start).toHaveBeenCalledTimes(3); // Only shows, movies, people
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
    it('should stop all jobs and log shutdown', () => {
      initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());
      jest.clearAllMocks();

      shutdownJobs();

      expect(mockScheduledTask.stop).toHaveBeenCalledTimes(4);
      expect(cliLogger.info).toHaveBeenCalledWith('All scheduled jobs paused');
      expect(cliLogger.info).toHaveBeenCalledWith('Job scheduler shutdown complete');
    });

    it('should handle shutdown when jobs are not initialized', () => {
      expect(() => {
        shutdownJobs();
      }).not.toThrow();

      expect(cliLogger.info).toHaveBeenCalledWith('Job scheduler shutdown complete');
    });
  });

  describe('scheduled job execution via cron', () => {
    it('should execute shows update job when cron triggers', async () => {
      initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());

      // Get the function passed to cron.schedule for shows update
      const cronCallback = mockCronSchedule.mock.calls[0][1];

      // Execute the cron callback
      await cronCallback();

      expect(updateShows).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in cron callback without crashing', async () => {
      (updateShows as jest.Mock).mockRejectedValueOnce(new Error('Cron execution failed'));

      initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());

      const cronCallback = mockCronSchedule.mock.calls[0][1];

      // This should not throw
      await expect(cronCallback()).resolves.not.toThrow();

      expect(cliLogger.error).toHaveBeenCalledWith('Failed to complete show update job', expect.any(Error));
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

    it('should allow re-initialization with different schedules', () => {
      // First initialization
      initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());

      // Change schedules
      (config.getShowsUpdateSchedule as jest.Mock).mockReturnValue('0 4 * * *');
      (config.getMoviesUpdateSchedule as jest.Mock).mockReturnValue('0 2 1,15 * *');

      // Re-initialize
      initScheduledJobs(jest.fn(), jest.fn(), jest.fn(), jest.fn());

      expect(mockCronSchedule).toHaveBeenCalledWith('0 4 * * *', expect.any(Function));
      expect(mockCronSchedule).toHaveBeenCalledWith('0 2 1,15 * *', expect.any(Function));
    });
  });
});
