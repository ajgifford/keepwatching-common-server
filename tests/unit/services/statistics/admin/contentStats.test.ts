import * as contentPerformanceRepository from '@db/statistics/contentPerformanceRepository';
import { BadRequestError } from '@middleware/errorMiddleware';
import { CacheService } from '@services/cacheService';
import { errorService } from '@services/errorService';
import { adminStatisticsService } from '@services/statistics/adminStatisticsService';

jest.mock('@services/errorService');
jest.mock('@services/cacheService');
jest.mock('@db/statistics/contentPerformanceRepository');

describe('AdminStatisticsService - Content Stats', () => {
  const mockCacheService = {
    getOrSet: jest.fn(),
    invalidate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(CacheService, 'getInstance').mockReturnValue(mockCacheService as any);

    Object.defineProperty(adminStatisticsService, 'cache', {
      value: mockCacheService,
      writable: true,
    });
  });

  describe('getContentPopularity', () => {
    const mockPopularShows = [
      {
        content_id: 1,
        title: 'Popular Show 1',
        account_count: 100,
        profile_count: 150,
        total_watch_count: 200,
        completion_rate: 75.5,
        release_year: 2020,
      },
      {
        content_id: 2,
        title: 'Popular Show 2',
        account_count: 80,
        profile_count: 120,
        total_watch_count: 150,
        completion_rate: 65.0,
        release_year: null,
      },
    ];

    const mockPopularMovies = [
      {
        content_id: 101,
        title: 'Popular Movie 1',
        account_count: 90,
        profile_count: 140,
        total_watch_count: 180,
        completion_rate: 85.0,
        release_year: 2021,
      },
      {
        content_id: 102,
        title: 'Popular Movie 2',
        account_count: 70,
        profile_count: 110,
        total_watch_count: 130,
        completion_rate: 70.5,
        release_year: 2022,
      },
    ];

    it('should return content popularity from cache if available', async () => {
      const mockPopularity = {
        contentType: 'all',
        resultCount: 4,
        popularContent: [
          { contentId: 1, title: 'Show 1', contentType: 'show', profileCount: 150 },
          { contentId: 101, title: 'Movie 1', contentType: 'movie', profileCount: 140 },
        ],
      };

      mockCacheService.getOrSet.mockResolvedValue(mockPopularity);

      const result = await adminStatisticsService.getContentPopularity('all', 20);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'admin_content_popularity_all_20',
        expect.any(Function),
        1800,
      );
      expect(result).toEqual(mockPopularity);
    });

    it('should fetch and transform show popularity on cache miss', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (contentPerformanceRepository.getPopularShows as jest.Mock).mockResolvedValue(mockPopularShows);

      const result = await adminStatisticsService.getContentPopularity('show', 20);

      expect(contentPerformanceRepository.getPopularShows).toHaveBeenCalledWith(20);
      expect(contentPerformanceRepository.getPopularMovies).not.toHaveBeenCalled();
      expect(result.contentType).toBe('show');
      expect(result.resultCount).toBe(2);
      expect(result.popularContent).toHaveLength(2);

      expect(result.popularContent[0]).toEqual({
        contentId: 1,
        title: 'Popular Show 1',
        contentType: 'show',
        accountCount: 100,
        profileCount: 150,
        totalWatchCount: 200,
        completionRate: 75.5,
        releaseYear: 2020,
      });

      expect(result.popularContent[1].releaseYear).toBeUndefined(); // null converted to undefined
    });

    it('should fetch and transform movie popularity on cache miss', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (contentPerformanceRepository.getPopularMovies as jest.Mock).mockResolvedValue(mockPopularMovies);

      const result = await adminStatisticsService.getContentPopularity('movie', 20);

      expect(contentPerformanceRepository.getPopularMovies).toHaveBeenCalledWith(20);
      expect(contentPerformanceRepository.getPopularShows).not.toHaveBeenCalled();
      expect(result.contentType).toBe('movie');
      expect(result.resultCount).toBe(2);
      expect(result.popularContent).toHaveLength(2);
    });

    it('should fetch and combine both shows and movies for "all" content type', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (contentPerformanceRepository.getPopularShows as jest.Mock).mockResolvedValue(mockPopularShows);
      (contentPerformanceRepository.getPopularMovies as jest.Mock).mockResolvedValue(mockPopularMovies);

      const result = await adminStatisticsService.getContentPopularity('all', 20);

      expect(contentPerformanceRepository.getPopularShows).toHaveBeenCalledWith(20);
      expect(contentPerformanceRepository.getPopularMovies).toHaveBeenCalledWith(20);
      expect(result.contentType).toBe('all');
      expect(result.resultCount).toBe(4);
      expect(result.popularContent).toHaveLength(4);
    });

    it('should sort combined content by profile count descending', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (contentPerformanceRepository.getPopularShows as jest.Mock).mockResolvedValue(mockPopularShows);
      (contentPerformanceRepository.getPopularMovies as jest.Mock).mockResolvedValue(mockPopularMovies);

      const result = await adminStatisticsService.getContentPopularity('all', 20);

      // Should be sorted: 150, 140, 120, 110
      expect(result.popularContent[0].profileCount).toBe(150); // Popular Show 1
      expect(result.popularContent[1].profileCount).toBe(140); // Popular Movie 1
      expect(result.popularContent[2].profileCount).toBe(120); // Popular Show 2
      expect(result.popularContent[3].profileCount).toBe(110); // Popular Movie 2
    });

    it('should limit results for "all" content type', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (contentPerformanceRepository.getPopularShows as jest.Mock).mockResolvedValue(mockPopularShows);
      (contentPerformanceRepository.getPopularMovies as jest.Mock).mockResolvedValue(mockPopularMovies);

      const result = await adminStatisticsService.getContentPopularity('all', 2);

      expect(result.resultCount).toBe(2);
      expect(result.popularContent).toHaveLength(2);
    });

    it('should use default parameters', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (contentPerformanceRepository.getPopularShows as jest.Mock).mockResolvedValue([]);
      (contentPerformanceRepository.getPopularMovies as jest.Mock).mockResolvedValue([]);

      await adminStatisticsService.getContentPopularity();

      expect(contentPerformanceRepository.getPopularShows).toHaveBeenCalledWith(20);
      expect(contentPerformanceRepository.getPopularMovies).toHaveBeenCalledWith(20);
    });

    it('should handle empty results', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (contentPerformanceRepository.getPopularShows as jest.Mock).mockResolvedValue([]);
      (contentPerformanceRepository.getPopularMovies as jest.Mock).mockResolvedValue([]);

      const result = await adminStatisticsService.getContentPopularity('all', 20);

      expect(result.resultCount).toBe(0);
      expect(result.popularContent).toHaveLength(0);
    });

    it('should handle repository errors', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const error = new Error('Database query failed');
      (contentPerformanceRepository.getPopularShows as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(adminStatisticsService.getContentPopularity('show', 20)).rejects.toThrow(
        'Handled: Database query failed',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getContentPopularity(show, 20)');
    });
  });

  describe('getTrendingContent', () => {
    const mockTrendingShows = [
      {
        content_id: 1,
        title: 'Trending Show 1',
        new_additions: 50,
        recent_watch_count: 200,
        previous_watch_count: 100,
      },
      {
        content_id: 2,
        title: 'Trending Show 2',
        new_additions: 30,
        recent_watch_count: 80,
        previous_watch_count: 100,
      },
    ];

    const mockTrendingMovies = [
      {
        content_id: 101,
        title: 'Trending Movie 1',
        new_additions: 40,
        recent_watch_count: 150,
        previous_watch_count: 50,
      },
      {
        content_id: 102,
        title: 'Trending Movie 2',
        new_additions: 20,
        recent_watch_count: 90,
        previous_watch_count: 100,
      },
    ];

    it('should return trending content from cache if available', async () => {
      const mockTrending = {
        periodDays: 30,
        resultCount: 4,
        trendingContent: [{ contentId: 1, title: 'Show 1', contentType: 'show', recentWatchCount: 200 }],
      };

      mockCacheService.getOrSet.mockResolvedValue(mockTrending);

      const result = await adminStatisticsService.getTrendingContent(30);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith('admin_trending_content_30', expect.any(Function), 1800);
      expect(result).toEqual(mockTrending);
    });

    it('should fetch and calculate trending content on cache miss', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (contentPerformanceRepository.getTrendingShows as jest.Mock).mockResolvedValue(mockTrendingShows);
      (contentPerformanceRepository.getTrendingMovies as jest.Mock).mockResolvedValue(mockTrendingMovies);

      const result = await adminStatisticsService.getTrendingContent(30);

      expect(contentPerformanceRepository.getTrendingShows).toHaveBeenCalledWith(30, 10);
      expect(contentPerformanceRepository.getTrendingMovies).toHaveBeenCalledWith(30, 10);
      expect(result.periodDays).toBe(30);
      expect(result.resultCount).toBe(4);
      expect(result.trendingContent).toHaveLength(4);
    });

    it('should calculate trend percentage correctly', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (contentPerformanceRepository.getTrendingShows as jest.Mock).mockResolvedValue(mockTrendingShows);
      (contentPerformanceRepository.getTrendingMovies as jest.Mock).mockResolvedValue(mockTrendingMovies);

      const result = await adminStatisticsService.getTrendingContent(30);

      // Show 1: (200 - 100) / 100 * 100 = 100%
      expect(result.trendingContent.find((c) => c.contentId === 1)?.trendPercentage).toBe(100);

      // Show 2: (80 - 100) / 100 * 100 = -20%
      expect(result.trendingContent.find((c) => c.contentId === 2)?.trendPercentage).toBe(-20);

      // Movie 1: (150 - 50) / 50 * 100 = 200%
      expect(result.trendingContent.find((c) => c.contentId === 101)?.trendPercentage).toBe(200);

      // Movie 2: (90 - 100) / 100 * 100 = -10%
      expect(result.trendingContent.find((c) => c.contentId === 102)?.trendPercentage).toBe(-10);
    });

    it('should determine trend direction correctly', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (contentPerformanceRepository.getTrendingShows as jest.Mock).mockResolvedValue(mockTrendingShows);
      (contentPerformanceRepository.getTrendingMovies as jest.Mock).mockResolvedValue(mockTrendingMovies);

      const result = await adminStatisticsService.getTrendingContent(30);

      // Show 1: 200 > 100 * 1.1 = rising
      expect(result.trendingContent.find((c) => c.contentId === 1)?.trendDirection).toBe('rising');

      // Show 2: 80 < 100 * 0.9 = falling
      expect(result.trendingContent.find((c) => c.contentId === 2)?.trendDirection).toBe('falling');

      // Movie 1: 150 > 50 * 1.1 = rising
      expect(result.trendingContent.find((c) => c.contentId === 101)?.trendDirection).toBe('rising');

      // Movie 2: 90 is between 100 * 0.9 (90) and 100 * 1.1 (110) = stable
      expect(result.trendingContent.find((c) => c.contentId === 102)?.trendDirection).toBe('stable');
    });

    it('should handle zero previous watch count', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockWithZeroPrevious = [
        {
          content_id: 1,
          title: 'New Show',
          new_additions: 100,
          recent_watch_count: 150,
          previous_watch_count: 0,
        },
        {
          content_id: 2,
          title: 'No Activity Show',
          new_additions: 0,
          recent_watch_count: 0,
          previous_watch_count: 0,
        },
      ];

      (contentPerformanceRepository.getTrendingShows as jest.Mock).mockResolvedValue(mockWithZeroPrevious);
      (contentPerformanceRepository.getTrendingMovies as jest.Mock).mockResolvedValue([]);

      const result = await adminStatisticsService.getTrendingContent(30);

      // Should return 100% for new content with activity
      expect(result.trendingContent[0].trendPercentage).toBe(100);
      expect(result.trendingContent[0].trendDirection).toBe('rising');

      // Should return 0% for no activity
      expect(result.trendingContent[1].trendPercentage).toBe(0);
    });

    it('should sort by recent watch count descending', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (contentPerformanceRepository.getTrendingShows as jest.Mock).mockResolvedValue(mockTrendingShows);
      (contentPerformanceRepository.getTrendingMovies as jest.Mock).mockResolvedValue(mockTrendingMovies);

      const result = await adminStatisticsService.getTrendingContent(30);

      // Should be sorted: 200, 150, 90, 80
      expect(result.trendingContent[0].recentWatchCount).toBe(200);
      expect(result.trendingContent[1].recentWatchCount).toBe(150);
      expect(result.trendingContent[2].recentWatchCount).toBe(90);
      expect(result.trendingContent[3].recentWatchCount).toBe(80);
    });

    it('should use default days parameter', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (contentPerformanceRepository.getTrendingShows as jest.Mock).mockResolvedValue([]);
      (contentPerformanceRepository.getTrendingMovies as jest.Mock).mockResolvedValue([]);

      await adminStatisticsService.getTrendingContent();

      expect(contentPerformanceRepository.getTrendingShows).toHaveBeenCalledWith(30, 10);
      expect(contentPerformanceRepository.getTrendingMovies).toHaveBeenCalledWith(30, 10);
    });

    it('should handle repository errors', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const error = new Error('Database query failed');
      (contentPerformanceRepository.getTrendingShows as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(adminStatisticsService.getTrendingContent(60)).rejects.toThrow('Handled: Database query failed');

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getTrendingContent(60)');
    });
  });

  describe('getContentEngagement', () => {
    const mockShowEngagement = {
      content_id: 1,
      title: 'Test Show',
      total_profiles: 100,
      completed_profiles: 60,
      watching_profiles: 25,
      not_started_profiles: 10,
      abandoned_profiles: 5,
      avg_days_to_complete: 45.5,
      avg_progress: 75.25,
    };

    const mockMovieEngagement = {
      content_id: 101,
      title: 'Test Movie',
      total_profiles: 80,
      completed_profiles: 70,
      watching_profiles: 5,
      not_started_profiles: 3,
      abandoned_profiles: 2,
      avg_days_to_complete: 5.5,
      avg_progress: 87.5,
    };

    it('should return show engagement from cache if available', async () => {
      const mockEngagement = {
        contentId: 1,
        title: 'Test Show',
        contentType: 'show',
        totalAccounts: 0,
        totalProfiles: 100,
        completedProfiles: 60,
        watchingProfiles: 25,
        notStartedProfiles: 10,
        abandonedProfiles: 5,
        completionRate: 60.0,
        abandonmentRate: 5.0,
        averageDaysToComplete: 46,
        averageProgress: 75.25,
      };

      mockCacheService.getOrSet.mockResolvedValue(mockEngagement);

      const result = await adminStatisticsService.getContentEngagement(1, 'show');

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'admin_content_show_1_engagement',
        expect.any(Function),
        1800,
      );
      expect(result).toEqual(mockEngagement);
    });

    it('should fetch and calculate show engagement on cache miss', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (contentPerformanceRepository.getShowEngagement as jest.Mock).mockResolvedValue(mockShowEngagement);

      const result = await adminStatisticsService.getContentEngagement(1, 'show');

      expect(contentPerformanceRepository.getShowEngagement).toHaveBeenCalledWith(1);
      expect(contentPerformanceRepository.getMovieEngagement).not.toHaveBeenCalled();

      expect(result.contentId).toBe(1);
      expect(result.title).toBe('Test Show');
      expect(result.contentType).toBe('show');
      expect(result.completionRate).toBe(60.0); // 60/100 * 100
      expect(result.abandonmentRate).toBe(5.0); // 5/100 * 100
      expect(result.averageDaysToComplete).toBe(46); // Rounded from 45.5
      expect(result.averageProgress).toBe(75.25);
    });

    it('should fetch and calculate movie engagement on cache miss', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (contentPerformanceRepository.getMovieEngagement as jest.Mock).mockResolvedValue(mockMovieEngagement);

      const result = await adminStatisticsService.getContentEngagement(101, 'movie');

      expect(contentPerformanceRepository.getMovieEngagement).toHaveBeenCalledWith(101);
      expect(contentPerformanceRepository.getShowEngagement).not.toHaveBeenCalled();

      expect(result.contentId).toBe(101);
      expect(result.title).toBe('Test Movie');
      expect(result.contentType).toBe('movie');
      expect(result.completionRate).toBe(87.5); // 70/80 * 100
      expect(result.abandonmentRate).toBe(2.5); // 2/80 * 100
      expect(result.averageDaysToComplete).toBe(6); // Rounded from 5.5
    });

    it('should throw BadRequestError when content not found', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      (contentPerformanceRepository.getShowEngagement as jest.Mock).mockResolvedValue(null);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw err;
      });

      await expect(adminStatisticsService.getContentEngagement(999, 'show')).rejects.toThrow(BadRequestError);
      await expect(adminStatisticsService.getContentEngagement(999, 'show')).rejects.toThrow('show 999 not found');
    });

    it('should handle zero total profiles', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockEngagementZero = {
        content_id: 1,
        title: 'No Engagement Show',
        total_profiles: 0,
        completed_profiles: 0,
        watching_profiles: 0,
        not_started_profiles: 0,
        abandoned_profiles: 0,
        avg_days_to_complete: null,
        avg_progress: 0,
      };

      (contentPerformanceRepository.getShowEngagement as jest.Mock).mockResolvedValue(mockEngagementZero);

      const result = await adminStatisticsService.getContentEngagement(1, 'show');

      expect(result.completionRate).toBe(0);
      expect(result.abandonmentRate).toBe(0);
      expect(result.averageDaysToComplete).toBe(0);
    });

    it('should handle null average days to complete', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const mockEngagementNullAvg = {
        ...mockShowEngagement,
        avg_days_to_complete: null,
      };

      (contentPerformanceRepository.getShowEngagement as jest.Mock).mockResolvedValue(mockEngagementNullAvg);

      const result = await adminStatisticsService.getContentEngagement(1, 'show');

      expect(result.averageDaysToComplete).toBe(0);
    });

    it('should handle repository errors', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, fn) => fn());

      const error = new Error('Database query failed');
      (contentPerformanceRepository.getShowEngagement as jest.Mock).mockRejectedValue(error);
      (errorService.handleError as jest.Mock).mockImplementation((err) => {
        throw new Error(`Handled: ${err.message}`);
      });

      await expect(adminStatisticsService.getContentEngagement(1, 'show')).rejects.toThrow(
        'Handled: Database query failed',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getContentEngagement(1, show)');
    });
  });
});
