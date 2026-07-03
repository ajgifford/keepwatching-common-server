import { setupDatabaseTest } from '../helpers/dbTestSetup';
import { getAvailableRecapPeriods, getRecapStats } from '@db/statistics/recapRepository';

describe('recapRepository', () => {
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const mocks = setupDatabaseTest();
    mockPool = mocks.mockPool;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Query call order inside getRecapStats: episodeSummary, movieSummary, topShow, topMovie,
  // busiestDay, showGenres, movieGenres, watchDates, activityBuckets
  function mockRecapQueries(overrides: {
    episodeSummary?: any[];
    movieSummary?: any[];
    topShow?: any[];
    topMovie?: any[];
    busiestDay?: any[];
    showGenres?: any[];
    movieGenres?: any[];
    watchDates?: any[];
    activityBuckets?: any[];
  }) {
    mockPool.execute
      .mockResolvedValueOnce([overrides.episodeSummary ?? []])
      .mockResolvedValueOnce([overrides.movieSummary ?? []])
      .mockResolvedValueOnce([overrides.topShow ?? []])
      .mockResolvedValueOnce([overrides.topMovie ?? []])
      .mockResolvedValueOnce([overrides.busiestDay ?? []])
      .mockResolvedValueOnce([overrides.showGenres ?? []])
      .mockResolvedValueOnce([overrides.movieGenres ?? []])
      .mockResolvedValueOnce([overrides.watchDates ?? []])
      .mockResolvedValueOnce([overrides.activityBuckets ?? []]);
  }

  describe('getRecapStats', () => {
    it('should return zeroed/null stats when there is no watch activity', async () => {
      mockRecapQueries({});

      const result = await getRecapStats(123, 'year', 2026, undefined, '2026-01-01', '2026-12-31');

      expect(result).toEqual({
        profileId: 123,
        period: 'year',
        year: 2026,
        month: undefined,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        hoursWatched: 0,
        episodesWatched: 0,
        moviesWatched: 0,
        topGenres: [],
        topShow: null,
        topMovie: null,
        longestStreak: null,
        busiestBingeDay: null,
        firstWatchDate: null,
        activityBreakdown: Array.from({ length: 12 }, (_, i) => ({ period: i + 1, episodesWatched: 0 })),
      });
    });

    it('should aggregate episode and movie counts and hours watched', async () => {
      mockRecapQueries({
        episodeSummary: [{ episodes_watched: 10, total_runtime_minutes: 300, first_watch_date: '2026-07-02' }],
        movieSummary: [{ movies_watched: 2, total_runtime_minutes: 240, first_watch_date: '2026-07-10' }],
      });

      const result = await getRecapStats(123, 'month', 2026, 7, '2026-07-01', '2026-07-31');

      expect(result.episodesWatched).toBe(10);
      expect(result.moviesWatched).toBe(2);
      // (300 + 240) minutes / 60 = 9 hours
      expect(result.hoursWatched).toBe(9);
      expect(result.firstWatchDate).toBe('2026-07-02');
      expect(result.month).toBe(7);
    });

    it('should numerically add SUM() results even when mysql2 returns them as DECIMAL strings', async () => {
      // mysql2 returns SUM() over an INT column as a DECIMAL string (e.g. "12106"), not a JS number.
      // Naively adding two of these with `+` string-concatenates instead of summing.
      mockRecapQueries({
        episodeSummary: [
          { episodes_watched: 241, total_runtime_minutes: '12106' as any, first_watch_date: '2026-02-01' },
        ],
        movieSummary: [{ movies_watched: 11, total_runtime_minutes: '1302' as any, first_watch_date: '2026-01-03' }],
      });

      const result = await getRecapStats(123, 'year', 2026, undefined, '2026-01-01', '2026-12-31');

      // (12106 + 1302) minutes / 60 = 223.47 -> 223 hours, NOT the ~2,000,000 hours you'd get from
      // string concatenation ("12106" + "1302" = "121061302").
      expect(result.hoursWatched).toBe(223);
    });

    it('should pick the earlier of episode/movie first watch dates', async () => {
      mockRecapQueries({
        episodeSummary: [{ episodes_watched: 1, total_runtime_minutes: 30, first_watch_date: '2026-07-15' }],
        movieSummary: [{ movies_watched: 1, total_runtime_minutes: 120, first_watch_date: '2026-07-02' }],
      });

      const result = await getRecapStats(123, 'month', 2026, 7, '2026-07-01', '2026-07-31');

      expect(result.firstWatchDate).toBe('2026-07-02');
    });

    it('should return the top show by episodes watched', async () => {
      mockRecapQueries({
        topShow: [{ show_id: 7, title: 'Breaking Bad', episodes_watched: 12 }],
      });

      const result = await getRecapStats(123, 'year', 2026, undefined, '2026-01-01', '2026-12-31');

      expect(result.topShow).toEqual({ showId: 7, title: 'Breaking Bad', episodesWatched: 12 });
    });

    it('should return the top movie', async () => {
      mockRecapQueries({
        topMovie: [{ movie_id: 3, title: 'Inception' }],
      });

      const result = await getRecapStats(123, 'year', 2026, undefined, '2026-01-01', '2026-12-31');

      expect(result.topMovie).toEqual({ movieId: 3, title: 'Inception' });
    });

    it('should return the busiest binge day', async () => {
      mockRecapQueries({
        busiestDay: [{ watch_date: '2026-07-04', episodes_watched: 11 }],
      });

      const result = await getRecapStats(123, 'year', 2026, undefined, '2026-01-01', '2026-12-31');

      expect(result.busiestBingeDay).toEqual({ date: '2026-07-04', episodesWatched: 11 });
    });

    it('should tally show and movie genres together and cap to the top 5', async () => {
      mockRecapQueries({
        showGenres: [{ genre: 'Drama' }, { genre: 'Drama' }, { genre: 'Comedy' }],
        movieGenres: [
          { genre: 'Drama' },
          { genre: 'Action' },
          { genre: 'Horror' },
          { genre: 'Sci-Fi' },
          { genre: 'Romance' },
        ],
      });

      const result = await getRecapStats(123, 'year', 2026, undefined, '2026-01-01', '2026-12-31');

      expect(result.topGenres[0]).toEqual({ genre: 'Drama', count: 3 });
      expect(result.topGenres).toHaveLength(5);
    });

    it('should calculate the longest streak within the range', async () => {
      mockRecapQueries({
        watchDates: [
          { watch_date: '2026-07-01' },
          { watch_date: '2026-07-02' },
          { watch_date: '2026-07-03' },
          { watch_date: '2026-07-10' },
        ],
      });

      const result = await getRecapStats(123, 'year', 2026, undefined, '2026-01-01', '2026-12-31');

      expect(result.longestStreak).toEqual({ days: 3, startDate: '2026-07-01', endDate: '2026-07-03' });
    });

    it('should return a fully-populated day-by-day breakdown for a monthly recap', async () => {
      mockRecapQueries({
        activityBuckets: [
          { bucket: 2, episodes_watched: 3 },
          { bucket: 15, episodes_watched: 7 },
        ],
      });

      const result = await getRecapStats(123, 'month', 2026, 6, '2026-06-01', '2026-06-30');

      expect(result.activityBreakdown).toHaveLength(30);
      expect(result.activityBreakdown[0]).toEqual({ period: 1, episodesWatched: 0 });
      expect(result.activityBreakdown[1]).toEqual({ period: 2, episodesWatched: 3 });
      expect(result.activityBreakdown[14]).toEqual({ period: 15, episodesWatched: 7 });
      expect(result.activityBreakdown[29]).toEqual({ period: 30, episodesWatched: 0 });
    });

    it('should use 28 days for a non-leap February', async () => {
      mockRecapQueries({});

      const result = await getRecapStats(123, 'month', 2026, 2, '2026-02-01', '2026-02-28');

      expect(result.activityBreakdown).toHaveLength(28);
    });

    it('should return a fully-populated month-by-month breakdown for a yearly recap', async () => {
      mockRecapQueries({
        activityBuckets: [
          { bucket: 1, episodes_watched: 12 },
          { bucket: 12, episodes_watched: 40 },
        ],
      });

      const result = await getRecapStats(123, 'year', 2026, undefined, '2026-01-01', '2026-12-31');

      expect(result.activityBreakdown).toHaveLength(12);
      expect(result.activityBreakdown[0]).toEqual({ period: 1, episodesWatched: 12 });
      expect(result.activityBreakdown[5]).toEqual({ period: 6, episodesWatched: 0 });
      expect(result.activityBreakdown[11]).toEqual({ period: 12, episodesWatched: 40 });
    });

    it('should use the correct bucket granularity (DAY vs MONTH) in the activity query', async () => {
      mockRecapQueries({});
      await getRecapStats(123, 'month', 2026, 6, '2026-06-01', '2026-06-30');
      const monthlyCall = mockPool.execute.mock.calls[8];
      expect(monthlyCall[0]).toEqual(expect.stringContaining('DAY(ewh.watched_at)'));

      jest.clearAllMocks();
      mockRecapQueries({});
      await getRecapStats(123, 'year', 2026, undefined, '2026-01-01', '2026-12-31');
      const yearlyCall = mockPool.execute.mock.calls[8];
      expect(yearlyCall[0]).toEqual(expect.stringContaining('MONTH(ewh.watched_at)'));
    });

    it('should pass the profile ID and date range to each query', async () => {
      mockRecapQueries({});

      await getRecapStats(456, 'year', 2026, undefined, '2026-01-01', '2026-12-31');

      for (const call of mockPool.execute.mock.calls) {
        expect(call[1]).toEqual([456, '2026-01-01', '2026-12-31']);
      }
    });

    it('should exclude prior-watch history from every query', async () => {
      mockRecapQueries({});

      await getRecapStats(123, 'year', 2026, undefined, '2026-01-01', '2026-12-31');

      for (const call of mockPool.execute.mock.calls) {
        expect(call[0]).toEqual(expect.stringContaining('is_prior_watch = FALSE'));
      }
    });
  });

  describe('getAvailableRecapPeriods', () => {
    it('should return empty years/months when there is no activity', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await getAvailableRecapPeriods(123);

      expect(result).toEqual({ years: [], months: [] });
    });

    it('should return distinct sorted years and (year, month) pairs', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2027-01-15T00:00:00Z'));
      mockPool.execute.mockResolvedValueOnce([
        [
          { y: 2026, m: 7 },
          { y: 2025, m: 12 },
          { y: 2026, m: 7 },
          { y: 2026, m: 1 },
        ],
      ]);

      const result = await getAvailableRecapPeriods(123);

      expect(result.years).toEqual([2025, 2026]);
      expect(result.months).toEqual([
        { year: 2025, month: 12 },
        { year: 2026, month: 1 },
        { year: 2026, month: 7 },
      ]);

      jest.useRealTimers();
    });

    it('should exclude the current, still-in-progress month from the months list', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-15T00:00:00Z'));
      mockPool.execute.mockResolvedValueOnce([
        [
          { y: 2025, m: 6 },
          { y: 2026, m: 6 },
          { y: 2026, m: 7 },
        ],
      ]);

      const result = await getAvailableRecapPeriods(123);

      expect(result.months).toEqual([
        { year: 2025, month: 6 },
        { year: 2026, month: 6 },
      ]);

      jest.useRealTimers();
    });

    it('should exclude the current, still-in-progress year from the years list outside of December', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-15T00:00:00Z'));
      mockPool.execute.mockResolvedValueOnce([
        [
          { y: 2025, m: 6 },
          { y: 2026, m: 6 },
        ],
      ]);

      const result = await getAvailableRecapPeriods(123);

      expect(result.years).toEqual([2025]);

      jest.useRealTimers();
    });

    it('should include the current year in the years list once December starts', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-12-02T00:00:00Z'));
      mockPool.execute.mockResolvedValueOnce([
        [
          { y: 2025, m: 6 },
          { y: 2026, m: 6 },
        ],
      ]);

      const result = await getAvailableRecapPeriods(123);

      expect(result.years).toEqual([2025, 2026]);

      jest.useRealTimers();
    });
  });
});
