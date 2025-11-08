import * as config from '@config/config';
import { appLogger, cliLogger } from '@logger/logger';
import { updateMovies, updatePeople, updateShows } from '@services/contentUpdatesService';
import { emailService } from '@services/emailService';
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
import CronJob from 'node-cron';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@logger/logger', () => ({
  cliLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  appLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@config/config', () => ({
  getShowsUpdateSchedule: vi.fn(() => '0 2 * * *'),
  getMoviesUpdateSchedule: vi.fn(() => '0 1 7,14,21,28 * *'),
  getPersonUpdateSchedule: vi.fn(() => '0 3 * * *'),
  getEmailSchedule: vi.fn(() => '0 9 * * 0'),
  isEmailEnabled: vi.fn(() => true),
}));

vi.mock('@services/contentUpdatesService', () => ({
  updateMovies: vi.fn(),
  updateShows: vi.fn(),
  updatePeople: vi.fn(),
}));

vi.mock('node-cron', () => {
  const mockJob = {
    start: vi.fn(),
    stop: vi.fn(),
  };

  return {
    default: {
      schedule: vi.fn(() => mockJob),
      validate: vi.fn(() => true),
    },
  };
});

vi.mock('cron-parser', () => ({
  default: {
    parse: vi.fn().mockReturnValue({
      next: vi.fn().mockReturnValue({
        toDate: vi.fn().mockReturnValue(new Date('2025-04-01T02:00:00Z')),
      }),
    }),
  },
}));

vi.mock('@services/emailService', () => ({
  emailService: {
    sendWeeklyDigests: vi.fn(),
  },
}));

describe('scheduledJobsService', () => {
  let mockNotifyShowUpdates: Mock;
  let mockNotifyMovieUpdates: Mock;
  let mockNotifyPeopleUpdates: Mock;
  let mockNotifyEmailDigest: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockNotifyShowUpdates = vi.fn();
    mockNotifyMovieUpdates = vi.fn();
    mockNotifyPeopleUpdates = vi.fn();
    mockNotifyEmailDigest = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initScheduledJobs', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      (config.isEmailEnabled as Mock).mockReturnValue(true);
    });

    it('should initialize scheduled jobs with correct patterns', () => {
      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyPeopleUpdates, mockNotifyEmailDigest);

      expect(CronJob.schedule).toHaveBeenCalledTimes(4);
      expect(CronJob.schedule).toHaveBeenCalledWith('0 2 * * *', expect.any(Function));
      expect(CronJob.schedule).toHaveBeenCalledWith('0 1 7,14,21,28 * *', expect.any(Function));
      expect(CronJob.schedule).toHaveBeenCalledWith('0 3 * * *', expect.any(Function));
      expect(CronJob.schedule).toHaveBeenCalledWith('0 9 * * 0', expect.any(Function));

      expect(CronJob.schedule('0 2 * * *', expect.any(Function)).start).toHaveBeenCalled();
      expect(CronJob.schedule('0 1 7,14,21,28 * *', expect.any(Function)).start).toHaveBeenCalled();
      expect(CronJob.schedule('0 3 * * *', expect.any(Function)).start).toHaveBeenCalled();
      expect(CronJob.schedule('0 9 * * 0', expect.any(Function)).start).toHaveBeenCalled();

      expect(cliLogger.info).toHaveBeenCalledWith('Job Scheduler Initialized');
    });

    it('should initialize update jobs but not email when disabled', () => {
      (config.isEmailEnabled as Mock).mockReturnValue(false);
      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyPeopleUpdates, mockNotifyEmailDigest);

      expect(CronJob.schedule).toHaveBeenCalledTimes(3);
      expect(CronJob.schedule).toHaveBeenCalledWith('0 2 * * *', expect.any(Function));
      expect(CronJob.schedule).toHaveBeenCalledWith('0 1 7,14,21,28 * *', expect.any(Function));
      expect(CronJob.schedule).toHaveBeenCalledWith('0 3 * * *', expect.any(Function));
      expect(CronJob.schedule).not.toHaveBeenCalledWith('0 9 * * 0', expect.any(Function));

      expect(CronJob.schedule('0 2 * * *', expect.any(Function)).start).toHaveBeenCalled();
      expect(CronJob.schedule('0 1 7,14,21,28 * *', expect.any(Function)).start).toHaveBeenCalled();
      expect(CronJob.schedule('0 3 * * *', expect.any(Function)).start).toHaveBeenCalled();

      expect(cliLogger.info).toHaveBeenCalledWith('Email service is disabled, skipping email digest scheduling');
      expect(cliLogger.info).toHaveBeenCalledWith('Job Scheduler Initialized');
    });

    it('should use custom cron schedules from environment variables', () => {
      (config.isEmailEnabled as Mock).mockReturnValue(true);
      (config.getShowsUpdateSchedule as Mock).mockReturnValue('0 4 * * *');
      (config.getMoviesUpdateSchedule as Mock).mockReturnValue('0 3 1,15 * *');
      (config.getEmailSchedule as Mock).mockReturnValue('0 8 * * 0');

      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyPeopleUpdates, mockNotifyEmailDigest);

      expect(CronJob.schedule).toHaveBeenCalledWith('0 4 * * *', expect.any(Function));
      expect(CronJob.schedule).toHaveBeenCalledWith('0 3 1,15 * *', expect.any(Function));
      expect(CronJob.schedule).toHaveBeenCalledWith('0 8 * * 0', expect.any(Function));
    });

    it('should throw error if show cron expression is invalid', () => {
      (CronJob.validate as Mock).mockImplementationOnce(() => false);

      expect(() => {
        initScheduledJobs(
          mockNotifyShowUpdates,
          mockNotifyMovieUpdates,
          mockNotifyPeopleUpdates,
          mockNotifyEmailDigest,
        );
      }).toThrow();
    });

    it('should throw error if movie cron expression is invalid', () => {
      (CronJob.validate as Mock)
        .mockImplementationOnce(() => true) // For shows
        .mockImplementationOnce(() => false); // For movies

      expect(() => {
        initScheduledJobs(
          mockNotifyShowUpdates,
          mockNotifyMovieUpdates,
          mockNotifyPeopleUpdates,
          mockNotifyEmailDigest,
        );
      }).toThrow();
    });

    it('should throw error if people cron expression is invalid', () => {
      (CronJob.validate as Mock)
        .mockImplementationOnce(() => true) // For shows
        .mockImplementationOnce(() => true) // For movies
        .mockImplementationOnce(() => false); // For people

      expect(() => {
        initScheduledJobs(
          mockNotifyShowUpdates,
          mockNotifyMovieUpdates,
          mockNotifyPeopleUpdates,
          mockNotifyEmailDigest,
        );
      }).toThrow();
    });
  });

  describe('runShowsUpdateJob', () => {
    beforeEach(() => {
      (config.isEmailEnabled as Mock).mockReturnValue(true);
    });

    it('should run shows update job successfully', async () => {
      (updateShows as Mock).mockResolvedValueOnce(undefined);

      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyPeopleUpdates, mockNotifyEmailDigest);
      const result = await runShowsUpdateJob();

      expect(result).toBe(true);
      expect(updateShows).toHaveBeenCalledTimes(1);
      expect(mockNotifyShowUpdates).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Starting the show change job');
      expect(cliLogger.info).toHaveBeenCalledWith('Shows update job completed successfully');
    });

    it('should handle errors during shows update job', async () => {
      const error = new Error('Update failed');
      (updateShows as Mock).mockRejectedValueOnce(error);

      const result = await runShowsUpdateJob();

      expect(result).toBe(false);
      expect(updateShows).toHaveBeenCalledTimes(1);
      expect(mockNotifyShowUpdates).not.toHaveBeenCalled();
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to complete show update job', error);
      expect(appLogger.error).toHaveBeenCalled();
    });

    it('should skip execution if job is already running', async () => {
      const firstExecution = runShowsUpdateJob();
      const secondExecution = runShowsUpdateJob();

      (updateShows as Mock).mockResolvedValueOnce(undefined);
      await firstExecution;

      const result = await secondExecution;
      expect(result).toBe(false);
      expect(updateShows).toHaveBeenCalledTimes(1); // Only called for first execution
      expect(cliLogger.warn).toHaveBeenCalledWith('Shows update job already running, skipping this execution');
    });
  });

  describe('runMoviesUpdateJob', () => {
    beforeEach(() => {
      (config.isEmailEnabled as Mock).mockReturnValue(true);
    });

    it('should run movies update job successfully', async () => {
      (updateMovies as Mock).mockResolvedValueOnce(undefined);

      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyPeopleUpdates, mockNotifyEmailDigest);
      const result = await runMoviesUpdateJob();

      expect(result).toBe(true);
      expect(updateMovies).toHaveBeenCalledTimes(1);
      expect(mockNotifyMovieUpdates).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Starting the movie change job');
      expect(cliLogger.info).toHaveBeenCalledWith('Movies update job completed successfully');
    });

    it('should handle errors during movies update job', async () => {
      const error = new Error('Update failed');
      (updateMovies as Mock).mockRejectedValueOnce(error);

      const result = await runMoviesUpdateJob();

      expect(result).toBe(false);
      expect(updateMovies).toHaveBeenCalledTimes(1);
      expect(mockNotifyMovieUpdates).not.toHaveBeenCalled();
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to complete movie update job', error);
      expect(appLogger.error).toHaveBeenCalled();
    });

    it('should skip execution if job is already running', async () => {
      const firstExecution = runMoviesUpdateJob();
      const secondExecution = runMoviesUpdateJob();

      (updateMovies as Mock).mockResolvedValueOnce(undefined);
      await firstExecution;

      const result = await secondExecution;
      expect(result).toBe(false);
      expect(updateMovies).toHaveBeenCalledTimes(1); // Only called for first execution
      expect(cliLogger.warn).toHaveBeenCalledWith('Movies update job already running, skipping this execution');
    });
  });

  describe('runPeopleUpdateJob', () => {
    beforeEach(() => {
      (config.isEmailEnabled as Mock).mockReturnValue(true);
    });

    it('should run people update job successfully', async () => {
      (updatePeople as Mock).mockResolvedValueOnce(undefined);

      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyPeopleUpdates, mockNotifyEmailDigest);
      const result = await runPeopleUpdateJob();

      expect(result).toBe(true);
      expect(updatePeople).toHaveBeenCalledTimes(1);
      expect(mockNotifyPeopleUpdates).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Starting the people change job');
      expect(cliLogger.info).toHaveBeenCalledWith('People update job completed successfully');
      expect(cliLogger.info).toHaveBeenCalledWith('Ending the people change job');
      expect(appLogger.info).toHaveBeenCalledWith('People update job started');
      expect(appLogger.info).toHaveBeenCalledWith('People update job completed successfully');
    });

    it('should handle errors during people update job', async () => {
      const error = new Error('Update failed');
      (updatePeople as Mock).mockRejectedValueOnce(error);

      const result = await runPeopleUpdateJob();

      expect(result).toBe(false);
      expect(updatePeople).toHaveBeenCalledTimes(1);
      expect(mockNotifyPeopleUpdates).not.toHaveBeenCalled();
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to complete people update job', error);
      expect(cliLogger.info).toHaveBeenCalledWith('Starting the people change job');
      expect(cliLogger.info).toHaveBeenCalledWith('Ending the people change job');
      expect(appLogger.info).toHaveBeenCalledWith('People update job started');
      expect(appLogger.error).toHaveBeenCalled();
    });

    it('should skip execution if job is already running', async () => {
      const firstExecution = runPeopleUpdateJob();
      const secondExecution = runPeopleUpdateJob();

      (updatePeople as Mock).mockResolvedValueOnce(undefined);
      await firstExecution;

      const result = await secondExecution;
      expect(result).toBe(false);
      expect(updatePeople).toHaveBeenCalledTimes(1); // Only called for first execution
      expect(cliLogger.warn).toHaveBeenCalledWith('People update job already running, skipping this execution');
    });

    it('should not call people updates callback when not provided', async () => {
      (updatePeople as Mock).mockResolvedValueOnce(undefined);

      // Initialize without people updates callback
      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, undefined, mockNotifyEmailDigest);
      const result = await runPeopleUpdateJob();

      expect(result).toBe(true);
      expect(updatePeople).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Starting the people change job');
      expect(cliLogger.info).toHaveBeenCalledWith('People update job completed successfully');
    });
  });

  describe('runEmailDigestJob', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should skip execution if email is not enabled', async () => {
      (config.isEmailEnabled as Mock).mockReturnValueOnce(false);
      expect(await runEmailDigestJob()).toEqual(false);
      expect(cliLogger.warn).toHaveBeenCalledWith('Email service is disabled, skipping email digest job');
    });

    it('should skip execution if job is already running', async () => {
      (config.isEmailEnabled as Mock).mockReturnValue(true);

      (emailService.sendWeeklyDigests as Mock).mockResolvedValue({});

      const firstExecution = runEmailDigestJob();
      const secondExecution = runEmailDigestJob();

      await firstExecution;
      const result = await secondExecution;

      expect(result).toBe(false);
      expect(emailService.sendWeeklyDigests).toHaveBeenCalledTimes(1); // Only called for first execution
      expect(cliLogger.warn).toHaveBeenCalledWith('Email digest job already running, skipping this execution');
    });

    it('should send the weekly digest', async () => {
      (config.isEmailEnabled as Mock).mockReturnValue(true);

      (emailService.sendWeeklyDigests as Mock).mockResolvedValue({});

      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, undefined, mockNotifyEmailDigest);
      const result = await runEmailDigestJob();

      expect(result).toBe(true);
      expect(emailService.sendWeeklyDigests).toHaveBeenCalledTimes(1);
      expect(mockNotifyEmailDigest).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Starting the weekly email digest job');
      expect(cliLogger.info).toHaveBeenCalledWith('Weekly email digest job completed successfully');
      expect(cliLogger.info).toHaveBeenCalledWith('Ending the weekly email digest job');
      expect(appLogger.info).toHaveBeenCalledWith('Weekly email digest job started');
      expect(appLogger.info).toHaveBeenCalledWith('Weekly email digest job completed successfully');
    });

    it('should handle errors from the email service', async () => {
      (config.isEmailEnabled as Mock).mockReturnValue(true);

      const error = new Error('Update failed');
      (emailService.sendWeeklyDigests as Mock).mockRejectedValue(error);

      const result = await runEmailDigestJob();

      expect(result).toBe(false);
      expect(cliLogger.info).toHaveBeenCalledWith('Starting the weekly email digest job');
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to complete weekly email digest job', error);
      expect(cliLogger.info).toHaveBeenCalledWith('Ending the weekly email digest job');
      expect(appLogger.info).toHaveBeenCalledWith('Weekly email digest job started');
      expect(appLogger.error).toHaveBeenCalledWith('Weekly email digest job failed', { error });
    });
  });

  describe('getJobsStatus', () => {
    it('should return correct job status information', () => {
      const status = getJobsStatus();

      expect(status).toHaveProperty('showsUpdate');
      expect(status).toHaveProperty('moviesUpdate');
      expect(status).toHaveProperty('peopleUpdate');
      expect(status).toHaveProperty('emailDigest');

      expect(status.showsUpdate).toHaveProperty('lastRunTime');
      expect(status.showsUpdate).toHaveProperty('lastRunStatus');
      expect(status.showsUpdate).toHaveProperty('isRunning');
      expect(status.showsUpdate).toHaveProperty('nextRunTime');
      expect(status.showsUpdate).toHaveProperty('cronExpression');

      expect(status.moviesUpdate).toHaveProperty('lastRunTime');
      expect(status.moviesUpdate).toHaveProperty('lastRunStatus');
      expect(status.moviesUpdate).toHaveProperty('isRunning');
      expect(status.moviesUpdate).toHaveProperty('nextRunTime');
      expect(status.moviesUpdate).toHaveProperty('cronExpression');

      expect(status.peopleUpdate).toHaveProperty('lastRunTime');
      expect(status.peopleUpdate).toHaveProperty('lastRunStatus');
      expect(status.peopleUpdate).toHaveProperty('isRunning');
      expect(status.peopleUpdate).toHaveProperty('nextRunTime');
      expect(status.peopleUpdate).toHaveProperty('cronExpression');

      expect(status.emailDigest).toHaveProperty('lastRunTime');
      expect(status.emailDigest).toHaveProperty('lastRunStatus');
      expect(status.emailDigest).toHaveProperty('isRunning');
      expect(status.emailDigest).toHaveProperty('nextRunTime');
      expect(status.emailDigest).toHaveProperty('cronExpression');

      expect(parser.parse).toHaveBeenCalledTimes(4);
    });

    it('should handle error when calculating next run time', () => {
      (parser.parse as Mock).mockImplementation(() => {
        throw new Error('Invalid cron expression');
      });

      const status = getJobsStatus();

      expect(status.showsUpdate.nextRunTime).toBeNull();
      expect(status.moviesUpdate.nextRunTime).toBeNull();
      expect(status.peopleUpdate.nextRunTime).toBeNull();
      expect(status.emailDigest.nextRunTime).toBeNull();
      expect(cliLogger.error).toHaveBeenCalledTimes(4);
    });
  });

  describe('pauseJobs and resumeJobs', () => {
    beforeEach(() => {
      (config.isEmailEnabled as Mock).mockReturnValue(true);
    });

    it('should pause all scheduled jobs', () => {
      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyPeopleUpdates, mockNotifyEmailDigest);

      const stopMock = vi.fn();
      (CronJob.schedule as Mock).mockReturnValue({ start: vi.fn(), stop: stopMock });

      pauseJobs();

      expect(cliLogger.info).toHaveBeenCalledWith('All scheduled jobs paused');
    });

    it('should resume all scheduled jobs', () => {
      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyPeopleUpdates, mockNotifyEmailDigest);

      const startMock = vi.fn();
      (CronJob.schedule as Mock).mockReturnValue({ start: startMock, stop: vi.fn() });

      resumeJobs();

      expect(cliLogger.info).toHaveBeenCalledWith('All scheduled jobs resumed');
    });
  });

  describe('shutdownJobs', () => {
    beforeEach(() => {
      (config.isEmailEnabled as Mock).mockReturnValue(true);
    });

    it('should stop all jobs and log shutdown complete', () => {
      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyPeopleUpdates, mockNotifyEmailDigest);

      shutdownJobs();

      expect(cliLogger.info).toHaveBeenCalledWith('Job scheduler shutdown complete');
    });
  });
});
