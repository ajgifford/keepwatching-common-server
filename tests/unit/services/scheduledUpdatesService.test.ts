import { cliLogger, httpLogger } from '@logger/logger';
import { updateMovies, updateShows } from '@services/contentUpdatesService';
import {
  getJobsStatus,
  initScheduledJobs,
  pauseJobs,
  resumeJobs,
  runMoviesUpdateJob,
  runShowsUpdateJob,
  shutdownJobs,
} from '@services/scheduledUpdatesService';
import parser from 'cron-parser';
import CronJob from 'node-cron';

jest.mock('@logger/logger', () => ({
  cliLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  httpLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
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

describe('scheduledUpdatesService', () => {
  const originalEnv = process.env;
  let mockNotifyShowUpdates: jest.Mock;
  let mockNotifyMovieUpdates: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    process.env = { ...originalEnv };

    mockNotifyShowUpdates = jest.fn();
    mockNotifyMovieUpdates = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.useRealTimers();
  });

  describe('initScheduledJobs', () => {
    it('should initialize scheduled jobs with correct patterns', () => {
      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates);

      expect(CronJob.schedule).toHaveBeenCalledTimes(2);
      expect(CronJob.schedule).toHaveBeenCalledWith('0 2 * * *', expect.any(Function));
      expect(CronJob.schedule).toHaveBeenCalledWith('0 1 7,14,21,28 * *', expect.any(Function));

      expect(CronJob.schedule('0 2 * * *', expect.any(Function)).start).toHaveBeenCalled();
      expect(CronJob.schedule('0 1 7,14,21,28 * *', expect.any(Function)).start).toHaveBeenCalled();

      expect(cliLogger.info).toHaveBeenCalledWith('Job Scheduler Initialized');
    });

    it('should use custom cron schedules from environment variables', () => {
      process.env.SHOWS_UPDATE_SCHEDULE = '0 4 * * *';
      process.env.MOVIES_UPDATE_SCHEDULE = '0 3 1,15 * *';

      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates);

      expect(CronJob.schedule).toHaveBeenCalledWith('0 4 * * *', expect.any(Function));
      expect(CronJob.schedule).toHaveBeenCalledWith('0 3 1,15 * *', expect.any(Function));
    });

    it('should throw error if show cron expression is invalid', () => {
      (CronJob.validate as jest.Mock).mockImplementationOnce(() => false);

      expect(() => {
        initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates);
      }).toThrow();
    });

    it('should throw error if movie cron expression is invalid', () => {
      (CronJob.validate as jest.Mock)
        .mockImplementationOnce(() => true) // For shows
        .mockImplementationOnce(() => false); // For movies

      expect(() => {
        initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates);
      }).toThrow();
    });
  });

  describe('runShowsUpdateJob', () => {
    it('should run shows update job successfully', async () => {
      (updateShows as jest.Mock).mockResolvedValueOnce(undefined);

      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates);
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
      expect(httpLogger.error).toHaveBeenCalled();
    });

    it('should skip execution if job is already running', async () => {
      // First call to set isRunning = true
      const firstExecution = runShowsUpdateJob();

      // Second call should skip
      const secondExecution = runShowsUpdateJob();

      // Complete first job
      (updateShows as jest.Mock).mockResolvedValueOnce(undefined);
      await firstExecution;

      // Check second job
      const result = await secondExecution;
      expect(result).toBe(false);
      expect(updateShows).toHaveBeenCalledTimes(1); // Only called for first execution
      expect(cliLogger.warn).toHaveBeenCalledWith('Shows update job already running, skipping this execution');
    });
  });

  describe('runMoviesUpdateJob', () => {
    it('should run movies update job successfully', async () => {
      (updateMovies as jest.Mock).mockResolvedValueOnce(undefined);

      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates);
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
      expect(httpLogger.error).toHaveBeenCalled();
    });

    it('should skip execution if job is already running', async () => {
      // First call to set isRunning = true
      const firstExecution = runMoviesUpdateJob();

      // Second call should skip
      const secondExecution = runMoviesUpdateJob();

      // Complete first job
      (updateMovies as jest.Mock).mockResolvedValueOnce(undefined);
      await firstExecution;

      // Check second job
      const result = await secondExecution;
      expect(result).toBe(false);
      expect(updateMovies).toHaveBeenCalledTimes(1); // Only called for first execution
      expect(cliLogger.warn).toHaveBeenCalledWith('Movies update job already running, skipping this execution');
    });
  });

  describe('getJobsStatus', () => {
    it('should return correct job status information', () => {
      const status = getJobsStatus();

      expect(status).toHaveProperty('showsUpdate');
      expect(status).toHaveProperty('moviesUpdate');

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

      expect(parser.parse).toHaveBeenCalledTimes(2);
    });

    it('should handle error when calculating next run time', () => {
      (parser.parse as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid cron expression');
      });

      const status = getJobsStatus();

      expect(status.showsUpdate.nextRunTime).toBeNull();
      expect(status.moviesUpdate.nextRunTime).toBeNull();
      expect(cliLogger.error).toHaveBeenCalledTimes(2);
    });
  });

  describe('pauseJobs and resumeJobs', () => {
    it('should pause all scheduled jobs', () => {
      pauseJobs();

      const mockJobInstance = CronJob.schedule('', () => {}).stop;
      expect(mockJobInstance).toHaveBeenCalledTimes(2);
      expect(cliLogger.info).toHaveBeenCalledWith('All scheduled jobs paused');
    });

    it('should resume all scheduled jobs', () => {
      initScheduledJobs(mockNotifyShowUpdates, mockNotifyMovieUpdates);
      resumeJobs();

      const mockJobInstance = CronJob.schedule('', () => {}).start;
      expect(mockJobInstance).toHaveBeenCalledTimes(4); // 2 from init + 2 from resume
      expect(cliLogger.info).toHaveBeenCalledWith('All scheduled jobs resumed');
    });
  });

  describe('shutdownJobs', () => {
    it('should stop all jobs and log shutdown complete', () => {
      shutdownJobs();

      const mockJobInstance = CronJob.schedule('', () => {}).stop;
      expect(mockJobInstance).toHaveBeenCalledTimes(2);
      expect(cliLogger.info).toHaveBeenCalledWith('Job scheduler shutdown complete');
    });
  });
});
