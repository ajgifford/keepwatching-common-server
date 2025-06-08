import * as config from '@config/config';
import { appLogger, cliLogger } from '@logger/logger';
import { updateMovies, updateShows } from '@services/contentUpdatesService';
import { getEmailService } from '@services/emailService';
import * as emailServiceModule from '@services/emailService';
import {
  getJobsStatus,
  initScheduledJobs,
  pauseJobs,
  resumeJobs,
  runEmailDigestJob,
  runMoviesUpdateJob,
  runShowsUpdateJob,
  shutdownJobs,
} from '@services/scheduledJobsService';
import parser from 'cron-parser';
import CronJob from 'node-cron';

jest.mock('@logger/logger', () => ({
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  appLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@config/config', () => ({
  getShowsUpdateSchedule: jest.fn().mockReturnValue('0 2 * * *'),
  getMoviesUpdateSchedule: jest.fn().mockReturnValue('0 1 7,14,21,28 * *'),
  getEmailSchedule: jest.fn().mockReturnValue('0 9 * * 0'),
  isEmailEnabled: jest.fn().mockReturnValue(true),
}));

jest.mock('@services/contentUpdatesService', () => ({
  updateMovies: jest.fn(),
  updateShows: jest.fn(),
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue({
    start: jest.fn(),
    stop: jest.fn(),
  }),
  validate: jest.fn().mockReturnValue(true),
}));

jest.mock('cron-parser', () => ({
  parse: jest.fn().mockReturnValue({
    next: jest.fn().mockReturnValue({
      toDate: jest.fn().mockReturnValue(new Date('2025-04-01T02:00:00Z')),
    }),
  }),
}));

jest.mock('@services/emailService', () => ({
  getEmailService: jest.fn(),
  sendWeeklyDigests: jest.fn(),
}));

describe('scheduledJobsService', () => {
  let mockNotifyShowUpdates: jest.Mock;
  let mockNotifyMovieUpdates: jest.Mock;
  let mockNotifyEmailDigest: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockNotifyShowUpdates = jest.fn();
    mockNotifyMovieUpdates = jest.fn();
    mockNotifyEmailDigest = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initScheduledJobs', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should initialize scheduled jobs with correct patterns', () => {
      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyEmailDigest);

      expect(CronJob.schedule).toHaveBeenCalledTimes(3);
      expect(CronJob.schedule).toHaveBeenCalledWith('0 2 * * *', expect.any(Function));
      expect(CronJob.schedule).toHaveBeenCalledWith('0 1 7,14,21,28 * *', expect.any(Function));
      expect(CronJob.schedule).toHaveBeenCalledWith('0 9 * * 0', expect.any(Function));

      expect(CronJob.schedule('0 2 * * *', expect.any(Function)).start).toHaveBeenCalled();
      expect(CronJob.schedule('0 1 7,14,21,28 * *', expect.any(Function)).start).toHaveBeenCalled();
      expect(CronJob.schedule('0 9 * * 0', expect.any(Function)).start).toHaveBeenCalled();

      expect(cliLogger.info).toHaveBeenCalledWith('Job Scheduler Initialized');
    });

    it('should initialize update jobs but not email when disabled', () => {
      (config.isEmailEnabled as jest.Mock).mockReturnValue(false);
      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyEmailDigest);

      expect(CronJob.schedule).toHaveBeenCalledTimes(2);
      expect(CronJob.schedule).toHaveBeenCalledWith('0 2 * * *', expect.any(Function));
      expect(CronJob.schedule).toHaveBeenCalledWith('0 1 7,14,21,28 * *', expect.any(Function));
      expect(CronJob.schedule).not.toHaveBeenCalledWith('0 9 * * 0', expect.any(Function));

      expect(CronJob.schedule('0 2 * * *', expect.any(Function)).start).toHaveBeenCalled();
      expect(CronJob.schedule('0 1 7,14,21,28 * *', expect.any(Function)).start).toHaveBeenCalled();

      expect(cliLogger.info).toHaveBeenCalledWith('Email service is disabled, skipping email digest scheduling');
      expect(cliLogger.info).toHaveBeenCalledWith('Job Scheduler Initialized');
    });

    it('should use custom cron schedules from environment variables', () => {
      (config.isEmailEnabled as jest.Mock).mockReturnValue(true);
      (config.getShowsUpdateSchedule as jest.Mock).mockReturnValueOnce('0 4 * * *');
      (config.getMoviesUpdateSchedule as jest.Mock).mockReturnValueOnce('0 3 1,15 * *');
      (config.getEmailSchedule as jest.Mock).mockReturnValueOnce('0 8 * * 0');

      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyEmailDigest);

      expect(CronJob.schedule).toHaveBeenCalledWith('0 4 * * *', expect.any(Function));
      expect(CronJob.schedule).toHaveBeenCalledWith('0 3 1,15 * *', expect.any(Function));
      expect(CronJob.schedule).toHaveBeenCalledWith('0 8 * * 0', expect.any(Function));
    });

    it('should throw error if show cron expression is invalid', () => {
      (CronJob.validate as jest.Mock).mockImplementationOnce(() => false);

      expect(() => {
        initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyEmailDigest);
      }).toThrow();
    });

    it('should throw error if movie cron expression is invalid', () => {
      (CronJob.validate as jest.Mock)
        .mockImplementationOnce(() => true) // For shows
        .mockImplementationOnce(() => false); // For movies

      expect(() => {
        initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyEmailDigest);
      }).toThrow();
    });
  });

  describe('runShowsUpdateJob', () => {
    it('should run shows update job successfully', async () => {
      (updateShows as jest.Mock).mockResolvedValueOnce(undefined);

      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyEmailDigest);
      const result = await runShowsUpdateJob();

      expect(result).toBe(true);
      expect(updateShows).toHaveBeenCalledTimes(1);
      expect(mockNotifyShowUpdates).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Starting the show change job');
      expect(cliLogger.info).toHaveBeenCalledWith('Shows update job completed successfully');
    });

    it('should handle errors during shows update job', async () => {
      const error = new Error('Update failed');
      (updateShows as jest.Mock).mockRejectedValueOnce(error);

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

      (updateShows as jest.Mock).mockResolvedValueOnce(undefined);
      await firstExecution;

      const result = await secondExecution;
      expect(result).toBe(false);
      expect(updateShows).toHaveBeenCalledTimes(1); // Only called for first execution
      expect(cliLogger.warn).toHaveBeenCalledWith('Shows update job already running, skipping this execution');
    });
  });

  describe('runMoviesUpdateJob', () => {
    it('should run movies update job successfully', async () => {
      (updateMovies as jest.Mock).mockResolvedValueOnce(undefined);

      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyEmailDigest);
      const result = await runMoviesUpdateJob();

      expect(result).toBe(true);
      expect(updateMovies).toHaveBeenCalledTimes(1);
      expect(mockNotifyMovieUpdates).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Starting the movie change job');
      expect(cliLogger.info).toHaveBeenCalledWith('Movies update job completed successfully');
    });

    it('should handle errors during movies update job', async () => {
      const error = new Error('Update failed');
      (updateMovies as jest.Mock).mockRejectedValueOnce(error);

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

      (updateMovies as jest.Mock).mockResolvedValueOnce(undefined);
      await firstExecution;

      const result = await secondExecution;
      expect(result).toBe(false);
      expect(updateMovies).toHaveBeenCalledTimes(1); // Only called for first execution
      expect(cliLogger.warn).toHaveBeenCalledWith('Movies update job already running, skipping this execution');
    });
  });

  describe('runEmailDigestJob', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should skip execution if email is not enabled', async () => {
      (config.isEmailEnabled as jest.Mock).mockReturnValueOnce(false);
      expect(await runEmailDigestJob()).toEqual(false);
      expect(cliLogger.warn).toHaveBeenCalledWith('Email service is disabled, skipping email digest job');
    });

    it('should skip execution if job is already running', async () => {
      (config.isEmailEnabled as jest.Mock).mockReturnValueOnce(true);

      (emailServiceModule.getEmailService as jest.Mock).mockReturnValue({
        sendWeeklyDigests: jest.fn(),
      });

      const firstExecution = runEmailDigestJob();
      const secondExecution = runEmailDigestJob();

      await firstExecution;
      const result = await secondExecution;

      expect(result).toBe(false);
      expect(getEmailService).toHaveBeenCalledTimes(1); // Only called for first execution
      expect(cliLogger.warn).toHaveBeenCalledWith('Email digest job already running, skipping this execution');
    });

    it('should send the weekly digest', async () => {
      (config.isEmailEnabled as jest.Mock).mockReturnValueOnce(true);

      (emailServiceModule.getEmailService as jest.Mock).mockReturnValue({
        sendWeeklyDigests: jest.fn(),
      });

      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyEmailDigest);
      const result = await runEmailDigestJob();

      expect(result).toBe(true);
      expect(getEmailService).toHaveBeenCalledTimes(1);
      expect(mockNotifyEmailDigest).toHaveBeenCalledTimes(1);
      expect(cliLogger.info).toHaveBeenCalledWith('Starting the weekly email digest job');
      expect(cliLogger.info).toHaveBeenCalledWith('Weekly email digest job completed successfully');
      expect(cliLogger.info).toHaveBeenCalledWith('Ending the weekly email digest job');
      expect(appLogger.info).toHaveBeenCalledWith('Weekly email digest job started');
      expect(appLogger.info).toHaveBeenCalledWith('Weekly email digest job completed');
    });

    it('should handle errors from the email service', async () => {
      (config.isEmailEnabled as jest.Mock).mockReturnValueOnce(true);

      const error = new Error('Update failed');
      const mockSendEmail = jest.fn().mockRejectedValue(error);

      (emailServiceModule.getEmailService as jest.Mock).mockReturnValue({
        sendWeeklyDigests: mockSendEmail,
      });

      const result = await runEmailDigestJob();

      expect(result).toBe(false);
      expect(getEmailService).toHaveBeenCalledTimes(1);
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

      expect(status.emailDigest).toHaveProperty('lastRunTime');
      expect(status.emailDigest).toHaveProperty('lastRunStatus');
      expect(status.emailDigest).toHaveProperty('isRunning');
      expect(status.emailDigest).toHaveProperty('nextRunTime');
      expect(status.emailDigest).toHaveProperty('cronExpression');

      expect(parser.parse).toHaveBeenCalledTimes(3);
    });

    it('should handle error when calculating next run time', () => {
      (parser.parse as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid cron expression');
      });

      const status = getJobsStatus();

      expect(status.showsUpdate.nextRunTime).toBeNull();
      expect(status.moviesUpdate.nextRunTime).toBeNull();
      expect(status.emailDigest.nextRunTime).toBeNull();
      expect(cliLogger.error).toHaveBeenCalledTimes(3);
    });
  });

  describe('pauseJobs and resumeJobs', () => {
    it('should pause all scheduled jobs', () => {
      pauseJobs();

      const mockJobInstance = CronJob.schedule('', () => {}).stop;
      expect(mockJobInstance).toHaveBeenCalledTimes(3);
      expect(cliLogger.info).toHaveBeenCalledWith('All scheduled jobs paused');
    });

    it('should resume all scheduled jobs', () => {
      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates, mockNotifyEmailDigest);
      resumeJobs();

      const mockJobInstance = CronJob.schedule('', () => {}).start;
      expect(mockJobInstance).toHaveBeenCalledTimes(6); // 3 from init + 3 from resume
      expect(cliLogger.info).toHaveBeenCalledWith('All scheduled jobs resumed');
    });
  });

  describe('shutdownJobs', () => {
    it('should stop all jobs and log shutdown complete', () => {
      shutdownJobs();

      const mockJobInstance = CronJob.schedule('', () => {}).stop;
      expect(mockJobInstance).toHaveBeenCalledTimes(3);
      expect(cliLogger.info).toHaveBeenCalledWith('Job scheduler shutdown complete');
    });
  });
});
