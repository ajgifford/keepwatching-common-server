import {
  StatusChange,
  WatchStatusEpisode,
  WatchStatusSeason,
  WatchStatusShow,
} from '../../../src/types/watchStatusTypes';
import { WatchStatusManager } from '../../../src/utils/watchStatusManager';
import { SimpleWatchStatus, WatchStatus } from '@ajgifford/keepwatching-types';

describe('WatchStatusManager', () => {
  let watchStatusManager: WatchStatusManager;
  let mockStatusChangeListener: jest.Mock;

  beforeEach(() => {
    // Reset singleton instance for each test
    (WatchStatusManager as any).instance = undefined;
    watchStatusManager = WatchStatusManager.getInstance();
    mockStatusChangeListener = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when getInstance is called multiple times', () => {
      const instance1 = WatchStatusManager.getInstance();
      const instance2 = WatchStatusManager.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(WatchStatusManager);
    });
  });

  describe('Status Change Listener Management', () => {
    it('should allow subscribing to status change events', () => {
      expect(() => {
        watchStatusManager.onStatusChange(mockStatusChangeListener);
      }).not.toThrow();
    });

    it('should support multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      watchStatusManager.onStatusChange(listener1);
      watchStatusManager.onStatusChange(listener2);

      // Access private method for testing
      const emitMethod = (watchStatusManager as any).emitStatusChange;
      const mockChange: StatusChange = {
        entityType: 'episode',
        entityId: 1,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHED,
        timestamp: new Date(),
        reason: 'test',
      };

      emitMethod.call(watchStatusManager, mockChange);

      expect(listener1).toHaveBeenCalledWith(mockChange);
      expect(listener2).toHaveBeenCalledWith(mockChange);
    });
  });

  describe('calculateEpisodeStatus', () => {
    const mockEpisode: WatchStatusEpisode = {
      id: 1,
      seasonId: 1,
      airDate: new Date('2024-01-15'),
      watchStatus: WatchStatus.NOT_WATCHED,
    };

    it('should return UNAIRED for episodes that have not aired yet', () => {
      const futureEpisode = { ...mockEpisode, airDate: new Date('2025-12-31') };
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateEpisodeStatus(futureEpisode, now);

      expect(status).toBe(WatchStatus.UNAIRED);
    });

    it('should return WATCHED for aired episodes that are watched', () => {
      const watchedEpisode = { ...mockEpisode, watchStatus: WatchStatus.WATCHED as SimpleWatchStatus };
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateEpisodeStatus(watchedEpisode, now);

      expect(status).toBe(WatchStatus.WATCHED);
    });

    it('should return NOT_WATCHED for aired episodes that are not watched', () => {
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateEpisodeStatus(mockEpisode, now);

      expect(status).toBe(WatchStatus.NOT_WATCHED);
    });

    it('should use current date as default when now parameter is not provided', () => {
      const futureEpisode = { ...mockEpisode, airDate: new Date(Date.now() + 86400000) }; // Tomorrow

      const status = watchStatusManager.calculateEpisodeStatus(futureEpisode);

      expect(status).toBe(WatchStatus.UNAIRED);
    });
  });

  describe('calculateSeasonStatus', () => {
    const baseEpisode: Omit<WatchStatusEpisode, 'id' | 'airDate' | 'watchStatus'> = {
      seasonId: 1,
    };

    const createMockSeason = (
      episodes: WatchStatusEpisode[],
      airDate = new Date('2024-01-01'),
      watchStatus = WatchStatus.NOT_WATCHED,
    ): WatchStatusSeason => ({
      id: 1,
      showId: 1,
      airDate,
      episodes,
      watchStatus,
    });

    it('should return UNAIRED for seasons that have not aired yet', () => {
      const futureDate = new Date('2026-01-01');
      const season = createMockSeason([], futureDate);
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateSeasonStatus(season, now);

      expect(status).toBe(WatchStatus.UNAIRED);
    });

    it('should return UNAIRED when no episodes have aired', () => {
      const episodes: WatchStatusEpisode[] = [
        { ...baseEpisode, id: 1, airDate: new Date('2026-01-01'), watchStatus: WatchStatus.NOT_WATCHED },
        { ...baseEpisode, id: 2, airDate: new Date('2026-01-02'), watchStatus: WatchStatus.NOT_WATCHED },
      ];
      const season = createMockSeason(episodes);
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateSeasonStatus(season, now);

      expect(status).toBe(WatchStatus.UNAIRED);
    });

    it('should return NOT_WATCHED when no aired episodes are watched', () => {
      const episodes: WatchStatusEpisode[] = [
        { ...baseEpisode, id: 1, airDate: new Date('2024-01-01'), watchStatus: WatchStatus.NOT_WATCHED },
        { ...baseEpisode, id: 2, airDate: new Date('2024-01-02'), watchStatus: WatchStatus.NOT_WATCHED },
      ];
      const season = createMockSeason(episodes);
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateSeasonStatus(season, now);

      expect(status).toBe(WatchStatus.NOT_WATCHED);
    });

    it('should return WATCHING when some but not all aired episodes are watched', () => {
      const episodes: WatchStatusEpisode[] = [
        { ...baseEpisode, id: 1, airDate: new Date('2024-01-01'), watchStatus: WatchStatus.WATCHED },
        { ...baseEpisode, id: 2, airDate: new Date('2024-01-02'), watchStatus: WatchStatus.NOT_WATCHED },
        { ...baseEpisode, id: 3, airDate: new Date('2024-01-03'), watchStatus: WatchStatus.NOT_WATCHED },
      ];
      const season = createMockSeason(episodes);
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateSeasonStatus(season, now);

      expect(status).toBe(WatchStatus.WATCHING);
    });

    it('should return UP_TO_DATE when all aired episodes are watched but unaired episodes remain', () => {
      const episodes: WatchStatusEpisode[] = [
        { ...baseEpisode, id: 1, airDate: new Date('2024-01-01'), watchStatus: WatchStatus.WATCHED },
        { ...baseEpisode, id: 2, airDate: new Date('2024-01-02'), watchStatus: WatchStatus.WATCHED },
        { ...baseEpisode, id: 3, airDate: new Date('2026-01-01'), watchStatus: WatchStatus.NOT_WATCHED },
      ];
      const season = createMockSeason(episodes);
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateSeasonStatus(season, now);

      expect(status).toBe(WatchStatus.UP_TO_DATE);
    });

    it('should return WATCHED when all episodes are watched and none are unaired', () => {
      const episodes: WatchStatusEpisode[] = [
        { ...baseEpisode, id: 1, airDate: new Date('2024-01-01'), watchStatus: WatchStatus.WATCHED },
        { ...baseEpisode, id: 2, airDate: new Date('2024-01-02'), watchStatus: WatchStatus.WATCHED },
        { ...baseEpisode, id: 3, airDate: new Date('2024-01-03'), watchStatus: WatchStatus.WATCHED },
      ];
      const season = createMockSeason(episodes);
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateSeasonStatus(season, now);

      expect(status).toBe(WatchStatus.WATCHED);
    });

    it('should handle empty episodes array', () => {
      const season = createMockSeason([]);
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateSeasonStatus(season, now);

      expect(status).toBe(WatchStatus.UNAIRED);
    });
  });

  describe('calculateShowStatus', () => {
    const createMockShow = (
      seasons: WatchStatusSeason[],
      airDate = new Date('2024-01-01'),
      inProduction = false,
      watchStatus = WatchStatus.NOT_WATCHED,
    ): WatchStatusShow => ({
      id: 1,
      airDate,
      inProduction,
      seasons,
      watchStatus,
    });

    const createMockSeason = (
      id: number,
      airDate: Date,
      episodes: WatchStatusEpisode[] = [],
      watchStatus = WatchStatus.NOT_WATCHED,
    ): WatchStatusSeason => ({
      id,
      showId: 1,
      airDate,
      episodes,
      watchStatus,
    });

    it('should return UNAIRED for shows that have not aired yet', () => {
      const futureDate = new Date('2026-01-01');
      const show = createMockShow([], futureDate);
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateShowStatus(show, now);

      expect(status).toBe(WatchStatus.UNAIRED);
    });

    it('should return UNAIRED when no seasons have aired', () => {
      const seasons = [createMockSeason(1, new Date('2026-01-01')), createMockSeason(2, new Date('2026-02-01'))];
      const show = createMockShow(seasons);
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateShowStatus(show, now);

      expect(status).toBe(WatchStatus.UNAIRED);
    });

    it('should return NOT_WATCHED when all aired seasons are not watched', () => {
      const season1Episodes: WatchStatusEpisode[] = [
        { id: 1, seasonId: 1, airDate: new Date('2024-01-01'), watchStatus: WatchStatus.NOT_WATCHED },
        { id: 2, seasonId: 1, airDate: new Date('2024-01-08'), watchStatus: WatchStatus.NOT_WATCHED },
      ];
      const season2Episodes: WatchStatusEpisode[] = [
        { id: 3, seasonId: 2, airDate: new Date('2024-02-01'), watchStatus: WatchStatus.NOT_WATCHED },
        { id: 4, seasonId: 2, airDate: new Date('2024-02-08'), watchStatus: WatchStatus.NOT_WATCHED },
      ];
      const seasons = [
        createMockSeason(1, new Date('2024-01-01'), season1Episodes, WatchStatus.NOT_WATCHED),
        createMockSeason(2, new Date('2024-02-01'), season2Episodes, WatchStatus.NOT_WATCHED),
      ];
      const show = createMockShow(seasons);
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateShowStatus(show, now);

      expect(status).toBe(WatchStatus.NOT_WATCHED);
    });

    it('should return WATCHING when any season is currently being watched', () => {
      const season1Episodes: WatchStatusEpisode[] = [
        { id: 1, seasonId: 1, airDate: new Date('2024-01-01'), watchStatus: WatchStatus.WATCHED },
        { id: 2, seasonId: 1, airDate: new Date('2024-01-08'), watchStatus: WatchStatus.WATCHED },
      ];
      const season2Episodes: WatchStatusEpisode[] = [
        { id: 3, seasonId: 2, airDate: new Date('2024-02-01'), watchStatus: WatchStatus.WATCHED },
        { id: 4, seasonId: 2, airDate: new Date('2024-02-08'), watchStatus: WatchStatus.NOT_WATCHED },
      ];
      const seasons = [
        createMockSeason(1, new Date('2024-01-01'), season1Episodes, WatchStatus.WATCHED),
        createMockSeason(2, new Date('2024-02-01'), season2Episodes, WatchStatus.WATCHING),
      ];
      const show = createMockShow(seasons);
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateShowStatus(show, now);

      expect(status).toBe(WatchStatus.WATCHING);
    });

    it('should return WATCHING when mix of watched and not watched seasons', () => {
      const season1Episodes: WatchStatusEpisode[] = [
        { id: 1, seasonId: 1, airDate: new Date('2024-01-01'), watchStatus: WatchStatus.WATCHED },
        { id: 2, seasonId: 1, airDate: new Date('2024-01-08'), watchStatus: WatchStatus.WATCHED },
      ];
      const season2Episodes: WatchStatusEpisode[] = [
        { id: 3, seasonId: 2, airDate: new Date('2024-02-01'), watchStatus: WatchStatus.NOT_WATCHED },
        { id: 4, seasonId: 2, airDate: new Date('2024-02-08'), watchStatus: WatchStatus.NOT_WATCHED },
      ];
      const seasons = [
        createMockSeason(1, new Date('2024-01-01'), season1Episodes, WatchStatus.WATCHED),
        createMockSeason(2, new Date('2024-02-01'), season2Episodes, WatchStatus.NOT_WATCHED),
      ];
      const show = createMockShow(seasons);
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateShowStatus(show, now);

      expect(status).toBe(WatchStatus.WATCHING);
    });

    it('should return UP_TO_DATE when all seasons complete and show in production', () => {
      const season1Episodes: WatchStatusEpisode[] = [
        { id: 1, seasonId: 1, airDate: new Date('2024-01-01'), watchStatus: WatchStatus.WATCHED },
        { id: 2, seasonId: 1, airDate: new Date('2024-01-08'), watchStatus: WatchStatus.WATCHED },
      ];
      const season2Episodes: WatchStatusEpisode[] = [
        { id: 3, seasonId: 2, airDate: new Date('2024-02-01'), watchStatus: WatchStatus.WATCHED },
        { id: 4, seasonId: 2, airDate: new Date('2024-02-08'), watchStatus: WatchStatus.WATCHED },
        { id: 5, seasonId: 2, airDate: new Date('2026-01-01'), watchStatus: WatchStatus.NOT_WATCHED },
      ];
      const seasons = [
        createMockSeason(1, new Date('2024-01-01'), season1Episodes, WatchStatus.WATCHED),
        createMockSeason(2, new Date('2024-02-01'), season2Episodes, WatchStatus.UP_TO_DATE),
      ];
      const show = createMockShow(seasons, new Date('2024-01-01'), true);
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateShowStatus(show, now);

      expect(status).toBe(WatchStatus.UP_TO_DATE);
    });

    it('should return UP_TO_DATE when all seasons complete and future seasons exist', () => {
      const season1Episodes: WatchStatusEpisode[] = [
        { id: 1, seasonId: 1, airDate: new Date('2024-01-01'), watchStatus: WatchStatus.WATCHED },
        { id: 2, seasonId: 1, airDate: new Date('2024-01-08'), watchStatus: WatchStatus.WATCHED },
      ];
      const season2Episodes: WatchStatusEpisode[] = [
        { id: 3, seasonId: 2, airDate: new Date('2024-02-01'), watchStatus: WatchStatus.WATCHED },
        { id: 4, seasonId: 2, airDate: new Date('2024-02-08'), watchStatus: WatchStatus.WATCHED },
      ];
      const season3Episodes: WatchStatusEpisode[] = [
        { id: 5, seasonId: 3, airDate: new Date('2026-01-01'), watchStatus: WatchStatus.NOT_WATCHED },
      ];
      const seasons = [
        createMockSeason(1, new Date('2024-01-01'), season1Episodes, WatchStatus.WATCHED),
        createMockSeason(2, new Date('2024-02-01'), season2Episodes, WatchStatus.WATCHED),
        createMockSeason(3, new Date('2026-01-01'), season3Episodes, WatchStatus.NOT_WATCHED),
      ];
      const show = createMockShow(seasons, new Date('2024-01-01'), false);
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateShowStatus(show, now);

      expect(status).toBe(WatchStatus.UP_TO_DATE);
    });

    it('should return WATCHED when all seasons complete and show not in production with no future seasons', () => {
      const season1Episodes: WatchStatusEpisode[] = [
        { id: 1, seasonId: 1, airDate: new Date('2024-01-01'), watchStatus: WatchStatus.WATCHED },
        { id: 2, seasonId: 1, airDate: new Date('2024-01-08'), watchStatus: WatchStatus.WATCHED },
      ];
      const season2Episodes: WatchStatusEpisode[] = [
        { id: 3, seasonId: 2, airDate: new Date('2024-02-01'), watchStatus: WatchStatus.WATCHED },
        { id: 4, seasonId: 2, airDate: new Date('2024-02-08'), watchStatus: WatchStatus.WATCHED },
      ];
      const seasons = [
        createMockSeason(1, new Date('2024-01-01'), season1Episodes, WatchStatus.WATCHED),
        createMockSeason(2, new Date('2024-02-01'), season2Episodes, WatchStatus.WATCHED),
      ];
      const show = createMockShow(seasons, new Date('2024-01-01'), false);
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateShowStatus(show, now);

      expect(status).toBe(WatchStatus.WATCHED);
    });

    it('should handle shows with no seasons', () => {
      const show = createMockShow([]);
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateShowStatus(show, now);

      expect(status).toBe(WatchStatus.UNAIRED);
    });

    it('should handle shows with undefined seasons', () => {
      const show = createMockShow([], new Date('2024-01-01'), false);
      show.seasons = undefined as any; // Test the || [] fallback
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateShowStatus(show, now);

      expect(status).toBe(WatchStatus.UNAIRED);
    });

    it('should calculate season status when watchStatus is not set', () => {
      // Mock the calculateSeasonStatus method to test the fallback
      const mockCalculateSeasonStatus = jest
        .spyOn(watchStatusManager, 'calculateSeasonStatus')
        .mockReturnValue(WatchStatus.WATCHING);

      const episodes: WatchStatusEpisode[] = [
        { id: 1, seasonId: 1, airDate: new Date('2024-01-01'), watchStatus: WatchStatus.WATCHED },
      ];
      const seasons = [{ id: 1, showId: 1, airDate: new Date('2024-01-01'), episodes, watchStatus: undefined as any }];
      const show = createMockShow(seasons);
      const now = new Date('2025-06-21');

      const status = watchStatusManager.calculateShowStatus(show, now);

      expect(mockCalculateSeasonStatus).toHaveBeenCalledWith(seasons[0], now);
      expect(status).toBe(WatchStatus.WATCHING);

      mockCalculateSeasonStatus.mockRestore();
    });
  });

  describe('generateStatusSummary', () => {
    it('should generate a comprehensive status summary for a show', () => {
      const episodes: WatchStatusEpisode[] = [
        { id: 1, seasonId: 1, airDate: new Date('2024-01-01'), watchStatus: WatchStatus.WATCHED },
        { id: 2, seasonId: 1, airDate: new Date('2024-01-02'), watchStatus: WatchStatus.NOT_WATCHED },
      ];

      const seasons: WatchStatusSeason[] = [
        {
          id: 1,
          showId: 1,
          airDate: new Date('2024-01-01'),
          episodes,
          watchStatus: WatchStatus.WATCHING,
        },
      ];

      const show: WatchStatusShow = {
        id: 1,
        airDate: new Date('2024-01-01'),
        inProduction: true,
        seasons,
        watchStatus: WatchStatus.WATCHING,
      };

      const now = new Date('2025-06-21');
      const summary = watchStatusManager.generateStatusSummary(show, now);

      expect(summary).toContain('Show "1" - Status: WATCHING');
      expect(summary).toContain('Air Date: 2024-01-01T00:00:00.000Z');
      expect(summary).toContain('In Production: true');
      expect(summary).toContain('Seasons: 1');
      expect(summary).toContain('Season "1" - Status: WATCHING');
      expect(summary).toContain('Episodes: 2');
      expect(summary).toContain('Progress: 1/2 aired episodes watched');
    });

    it('should handle shows with no seasons', () => {
      const show: WatchStatusShow = {
        id: 1,
        airDate: new Date('2024-01-01'),
        inProduction: false,
        seasons: [],
        watchStatus: WatchStatus.UNAIRED,
      };

      const summary = watchStatusManager.generateStatusSummary(show);

      expect(summary).toContain('Show "1" - Status: UNAIRED');
      expect(summary).toContain('Seasons: 0');
      expect(summary).not.toContain('Season "');
    });

    it('should use current date as default when now parameter is not provided', () => {
      const show: WatchStatusShow = {
        id: 1,
        airDate: new Date('2024-01-01'),
        inProduction: false,
        seasons: [],
        watchStatus: WatchStatus.UNAIRED,
      };

      const summary = watchStatusManager.generateStatusSummary(show);

      expect(summary).toContain('Show "1"');
      expect(typeof summary).toBe('string');
    });

    it('should handle seasons with no episodes', () => {
      const seasons: WatchStatusSeason[] = [
        {
          id: 1,
          showId: 1,
          airDate: new Date('2024-01-01'),
          episodes: [],
          watchStatus: WatchStatus.UNAIRED,
        },
      ];

      const show: WatchStatusShow = {
        id: 1,
        airDate: new Date('2024-01-01'),
        inProduction: false,
        seasons,
        watchStatus: WatchStatus.UNAIRED,
      };

      const summary = watchStatusManager.generateStatusSummary(show);

      expect(summary).toContain('Episodes: 0');
      expect(summary).toContain('Progress: 0/0 aired episodes watched');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid dates gracefully in calculateEpisodeStatus', () => {
      const episodeWithInvalidDate: WatchStatusEpisode = {
        id: 1,
        seasonId: 1,
        airDate: new Date('invalid-date'),
        watchStatus: WatchStatus.NOT_WATCHED,
      };

      // Invalid dates become NaN, which should be handled
      expect(() => {
        watchStatusManager.calculateEpisodeStatus(episodeWithInvalidDate);
      }).not.toThrow();
    });

    it('should handle missing episodes array in season', () => {
      const seasonWithoutEpisodes = {
        id: 1,
        showId: 1,
        airDate: new Date('2024-01-01'),
        episodes: undefined as any,
        watchStatus: WatchStatus.NOT_WATCHED,
      };

      expect(() => {
        watchStatusManager.calculateSeasonStatus(seasonWithoutEpisodes);
      }).toThrow();
    });

    it('should handle empty status change listeners array', () => {
      const emitMethod = (watchStatusManager as any).emitStatusChange;
      const mockChange: StatusChange = {
        entityType: 'episode',
        entityId: 1,
        from: WatchStatus.NOT_WATCHED,
        to: WatchStatus.WATCHED,
        timestamp: new Date(),
        reason: 'test',
      };

      expect(() => {
        emitMethod.call(watchStatusManager, mockChange);
      }).not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should calculate correct status for a complex multi-season show', () => {
      // Season 1: All episodes watched
      const season1Episodes: WatchStatusEpisode[] = [
        { id: 1, seasonId: 1, airDate: new Date('2024-01-01'), watchStatus: WatchStatus.WATCHED },
        { id: 2, seasonId: 1, airDate: new Date('2024-01-08'), watchStatus: WatchStatus.WATCHED },
      ];

      // Season 2: Partially watched
      const season2Episodes: WatchStatusEpisode[] = [
        { id: 3, seasonId: 2, airDate: new Date('2024-02-01'), watchStatus: WatchStatus.WATCHED },
        { id: 4, seasonId: 2, airDate: new Date('2024-02-08'), watchStatus: WatchStatus.NOT_WATCHED },
      ];

      // Season 3: Future season
      const season3Episodes: WatchStatusEpisode[] = [
        { id: 5, seasonId: 3, airDate: new Date('2026-01-01'), watchStatus: WatchStatus.NOT_WATCHED },
      ];

      const seasons: WatchStatusSeason[] = [
        {
          id: 1,
          showId: 1,
          airDate: new Date('2024-01-01'),
          episodes: season1Episodes,
          watchStatus: WatchStatus.WATCHED,
        },
        {
          id: 2,
          showId: 1,
          airDate: new Date('2024-02-01'),
          episodes: season2Episodes,
          watchStatus: WatchStatus.WATCHING,
        },
        {
          id: 3,
          showId: 1,
          airDate: new Date('2026-01-01'),
          episodes: season3Episodes,
          watchStatus: WatchStatus.UNAIRED,
        },
      ];

      const show: WatchStatusShow = {
        id: 1,
        airDate: new Date('2024-01-01'),
        inProduction: true,
        seasons,
        watchStatus: WatchStatus.WATCHING,
      };

      const now = new Date('2025-06-21');

      // Test season statuses
      expect(watchStatusManager.calculateSeasonStatus(seasons[0], now)).toBe(WatchStatus.WATCHED);
      expect(watchStatusManager.calculateSeasonStatus(seasons[1], now)).toBe(WatchStatus.WATCHING);
      expect(watchStatusManager.calculateSeasonStatus(seasons[2], now)).toBe(WatchStatus.UNAIRED);

      // Test show status
      expect(watchStatusManager.calculateShowStatus(show, now)).toBe(WatchStatus.WATCHING);
    });

    it('should handle show transitioning from UP_TO_DATE to WATCHED when production ends', () => {
      const episodes: WatchStatusEpisode[] = [
        { id: 1, seasonId: 1, airDate: new Date('2024-01-01'), watchStatus: WatchStatus.WATCHED },
        { id: 2, seasonId: 1, airDate: new Date('2024-01-08'), watchStatus: WatchStatus.WATCHED },
      ];

      const seasons: WatchStatusSeason[] = [
        { id: 1, showId: 1, airDate: new Date('2024-01-01'), episodes, watchStatus: WatchStatus.WATCHED },
      ];

      // Show in production - should be UP_TO_DATE
      const showInProduction: WatchStatusShow = {
        id: 1,
        airDate: new Date('2024-01-01'),
        inProduction: true,
        seasons,
        watchStatus: WatchStatus.UP_TO_DATE,
      };

      // Show finished production - should be WATCHED
      const showFinished: WatchStatusShow = {
        id: 1,
        airDate: new Date('2024-01-01'),
        inProduction: false,
        seasons,
        watchStatus: WatchStatus.WATCHED,
      };

      const now = new Date('2025-06-21');

      expect(watchStatusManager.calculateShowStatus(showInProduction, now)).toBe(WatchStatus.UP_TO_DATE);
      expect(watchStatusManager.calculateShowStatus(showFinished, now)).toBe(WatchStatus.WATCHED);
    });
  });
});
