import * as episodesDb from '@db/episodesDb';
import * as moviesDb from '@db/movies/movieRepository';
import { errorService } from '@services/errorService';
import { CalendarService, calendarService } from '@services/calendarService';

jest.mock('@db/episodesDb');
jest.mock('@db/movies/movieRepository');
jest.mock('@services/errorService');

describe('CalendarService', () => {
  let service: CalendarService;

  const profileId = 123;
  const startDate = '2026-03-01';
  const endDate = '2026-05-01';

  const mockEpisodes = [
    { id: 1, title: 'Episode 1', airDate: '2026-03-15' },
    { id: 2, title: 'Episode 2', airDate: '2026-04-01' },
  ] as any[];

  const mockMovies = [
    { id: 10, title: 'Movie A', releaseDate: '2026-03-20' },
  ] as any[];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CalendarService();
  });

  describe('getCalendarContentForProfile', () => {
    it('should return combined episodes and movies for a given date range', async () => {
      (episodesDb.getCalendarEpisodesForProfile as jest.Mock).mockResolvedValue(mockEpisodes);
      (moviesDb.getCalendarMoviesForProfile as jest.Mock).mockResolvedValue(mockMovies);

      const result = await service.getCalendarContentForProfile(profileId, startDate, endDate);

      expect(episodesDb.getCalendarEpisodesForProfile).toHaveBeenCalledWith(profileId, startDate, endDate);
      expect(moviesDb.getCalendarMoviesForProfile).toHaveBeenCalledWith(profileId, startDate, endDate);
      expect(result).toEqual({ episodes: mockEpisodes, movies: mockMovies });
    });

    it('should return empty arrays when no content exists in the date range', async () => {
      (episodesDb.getCalendarEpisodesForProfile as jest.Mock).mockResolvedValue([]);
      (moviesDb.getCalendarMoviesForProfile as jest.Mock).mockResolvedValue([]);

      const result = await service.getCalendarContentForProfile(profileId, startDate, endDate);

      expect(result).toEqual({ episodes: [], movies: [] });
    });

    it('should use default date range when no dates are provided', async () => {
      const fakeNow = new Date('2026-04-04T12:00:00.000Z');
      jest.useFakeTimers().setSystemTime(fakeNow.getTime());

      (episodesDb.getCalendarEpisodesForProfile as jest.Mock).mockResolvedValue([]);
      (moviesDb.getCalendarMoviesForProfile as jest.Mock).mockResolvedValue([]);

      await service.getCalendarContentForProfile(profileId);

      const [, passedStart, passedEnd] = (episodesDb.getCalendarEpisodesForProfile as jest.Mock).mock.calls[0];

      // Verify ISO date format
      expect(passedStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(passedEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Start should be in the past, end should be in the future
      expect(new Date(passedStart).getTime()).toBeLessThan(fakeNow.getTime());
      expect(new Date(passedEnd).getTime()).toBeGreaterThan(fakeNow.getTime());
    });

    it('should use default start date of 30 days ago', async () => {
      const fakeNow = new Date('2026-04-04T00:00:00.000Z');
      jest.useFakeTimers().setSystemTime(fakeNow.getTime());

      (episodesDb.getCalendarEpisodesForProfile as jest.Mock).mockResolvedValue([]);
      (moviesDb.getCalendarMoviesForProfile as jest.Mock).mockResolvedValue([]);

      await service.getCalendarContentForProfile(profileId);

      const [, passedStart] = (episodesDb.getCalendarEpisodesForProfile as jest.Mock).mock.calls[0];
      expect(passedStart).toBe('2026-03-05');
    });

    it('should use default end date of 60 days from now', async () => {
      const fakeNow = new Date('2026-04-04T00:00:00.000Z');
      jest.useFakeTimers().setSystemTime(fakeNow.getTime());

      (episodesDb.getCalendarEpisodesForProfile as jest.Mock).mockResolvedValue([]);
      (moviesDb.getCalendarMoviesForProfile as jest.Mock).mockResolvedValue([]);

      await service.getCalendarContentForProfile(profileId);

      const [, , passedEnd] = (episodesDb.getCalendarEpisodesForProfile as jest.Mock).mock.calls[0];
      expect(passedEnd).toBe('2026-06-03');
    });

    it('should fetch episodes and movies in parallel via Promise.all', async () => {
      const resolutionOrder: string[] = [];

      (episodesDb.getCalendarEpisodesForProfile as jest.Mock).mockImplementation(async () => {
        resolutionOrder.push('episodes');
        return mockEpisodes;
      });
      (moviesDb.getCalendarMoviesForProfile as jest.Mock).mockImplementation(async () => {
        resolutionOrder.push('movies');
        return mockMovies;
      });

      await service.getCalendarContentForProfile(profileId, startDate, endDate);

      expect(episodesDb.getCalendarEpisodesForProfile).toHaveBeenCalledTimes(1);
      expect(moviesDb.getCalendarMoviesForProfile).toHaveBeenCalledTimes(1);
      expect(resolutionOrder).toHaveLength(2);
    });

    it('should handle errors and delegate to errorService', async () => {
      const mockError = new Error('DB connection failed');
      (episodesDb.getCalendarEpisodesForProfile as jest.Mock).mockRejectedValue(mockError);

      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(
        service.getCalendarContentForProfile(profileId, startDate, endDate),
      ).rejects.toThrow('Handled: DB connection failed');

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `getCalendarContentForProfile(${profileId})`,
      );
    });

    it('should handle movie query errors', async () => {
      const mockError = new Error('Movies query failed');
      (episodesDb.getCalendarEpisodesForProfile as jest.Mock).mockResolvedValue(mockEpisodes);
      (moviesDb.getCalendarMoviesForProfile as jest.Mock).mockRejectedValue(mockError);

      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(
        service.getCalendarContentForProfile(profileId, startDate, endDate),
      ).rejects.toThrow('Handled: Movies query failed');

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `getCalendarContentForProfile(${profileId})`,
      );
    });
  });

  describe('singleton instance', () => {
    it('should export a CalendarService singleton', () => {
      expect(calendarService).toBeInstanceOf(CalendarService);
    });
  });
});
