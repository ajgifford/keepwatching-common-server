import { StatusChange, StatusUpdateResult } from '../../../src/types/watchStatusTypes';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import { WatchStatusDbService } from '@db/watchStatusDb';
import { errorService } from '@services/errorService';
import { showService } from '@services/showService';
import {
  WatchStatusService,
  createWatchStatusService,
  resetWatchStatusService,
  watchStatusService,
} from '@services/watchStatusService';
import { type Mock, MockedObject, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@db/watchStatusDb');
vi.mock('@services/errorService');
vi.mock('@services/showService');

describe('WatchStatusService', () => {
  let service: WatchStatusService;
  let mockDbService: MockedObject<WatchStatusDbService>;
  let mockCheckAchievements: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    resetWatchStatusService();

    // Mock the db service
    mockDbService = {
      updateEpisodeWatchStatus: vi.fn(),
      updateSeasonWatchStatus: vi.fn(),
      updateShowWatchStatus: vi.fn(),
      checkAndUpdateShowWatchStatus: vi.fn(),
      checkAndUpdateMovieWatchStatus: vi.fn(),
    } as any;

    // Mock checkAchievements
    mockCheckAchievements = vi.fn().mockResolvedValue(undefined);

    // Create a new instance for each test with mocked dependencies
    service = createWatchStatusService({
      dbService: mockDbService,
      checkAchievements: mockCheckAchievements,
    });
  });

  afterEach(() => {
    resetWatchStatusService();
    vi.resetModules();
  });

  describe('constructor', () => {
    it('should create an instance with WatchStatusDbService', () => {
      const newService = createWatchStatusService();
      expect(newService).toBeInstanceOf(WatchStatusService);
      expect((newService as any).dbService).toBeInstanceOf(WatchStatusDbService);
    });
  });

  describe('updateEpisodeWatchStatus', () => {
    const accountId = 1;
    const profileId = 123;
    const episodeId = 456;
    const status = WatchStatus.WATCHED;

    const mockDbResult: StatusUpdateResult = {
      success: true,
      changes: [
        {
          entityType: 'episode',
          entityId: episodeId,
          from: WatchStatus.NOT_WATCHED,
          to: WatchStatus.WATCHED,
          timestamp: new Date(),
          reason: 'User action',
        },
        {
          entityType: 'show',
          entityId: 789,
          from: WatchStatus.NOT_WATCHED,
          to: WatchStatus.WATCHING,
          timestamp: new Date(),
          reason: 'Episode status changed',
        },
      ],
      affectedRows: 2,
    };

    it('should successfully update episode watch status', async () => {
      mockDbService.updateEpisodeWatchStatus.mockResolvedValue(mockDbResult);
      (showService.invalidateProfileCache as Mock).mockResolvedValue(undefined);

      const result = await service.updateEpisodeWatchStatus(accountId, profileId, episodeId, status);

      expect(mockDbService.updateEpisodeWatchStatus).toHaveBeenCalledWith(profileId, episodeId, status);
      expect(showService.invalidateProfileCache).toHaveBeenCalledWith(accountId, profileId);
      expect(result).toEqual({
        success: true,
        changes: mockDbResult.changes,
        affectedRows: 2,
        message: 'Updated status for 1 episode, 1 show',
      });
    });

    it('should invalidate profile cache when show changes occur', async () => {
      mockDbService.updateEpisodeWatchStatus.mockResolvedValue(mockDbResult);

      await service.updateEpisodeWatchStatus(accountId, profileId, episodeId, status);

      expect(showService.invalidateProfileCache).toHaveBeenCalledWith(accountId, profileId);
    });

    it('should throw DatabaseError when db service returns unsuccessful result', async () => {
      const unsuccessfulResult: StatusUpdateResult = {
        success: false,
        changes: [],
        affectedRows: 0,
      };

      mockDbService.updateEpisodeWatchStatus.mockResolvedValue(unsuccessfulResult);

      (errorService.handleError as Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(service.updateEpisodeWatchStatus(accountId, profileId, episodeId, status)).rejects.toThrow(
        'Handled: Failed to update episode watch status',
      );

      expect(showService.invalidateProfileCache).not.toHaveBeenCalled();
    });

    it('should handle errors from db service', async () => {
      const mockError = new Error('Database connection failed');
      mockDbService.updateEpisodeWatchStatus.mockRejectedValue(mockError);

      (errorService.handleError as Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(service.updateEpisodeWatchStatus(accountId, profileId, episodeId, status)).rejects.toThrow(
        'Handled: Database connection failed',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `updateEpisodeWatchStatus(${profileId}, ${episodeId}, ${status})`,
      );
    });
  });

  describe('updateSeasonWatchStatus', () => {
    const accountId = 1;
    const profileId = 123;
    const seasonId = 456;
    const status = WatchStatus.WATCHED;

    const mockDbResult: StatusUpdateResult = {
      success: true,
      changes: [
        {
          entityType: 'season',
          entityId: seasonId,
          from: WatchStatus.NOT_WATCHED,
          to: WatchStatus.WATCHED,
          timestamp: new Date(),
          reason: 'User action',
        },
        {
          entityType: 'episode',
          entityId: 789,
          from: WatchStatus.NOT_WATCHED,
          to: WatchStatus.WATCHED,
          timestamp: new Date(),
          reason: 'Season status changed',
        },
        {
          entityType: 'show',
          entityId: 999,
          from: WatchStatus.WATCHING,
          to: WatchStatus.WATCHED,
          timestamp: new Date(),
          reason: 'Season status changed',
        },
      ],
      affectedRows: 3,
    };

    it('should successfully update season watch status', async () => {
      mockDbService.updateSeasonWatchStatus.mockResolvedValue(mockDbResult);

      const result = await service.updateSeasonWatchStatus(accountId, profileId, seasonId, status);

      expect(mockDbService.updateSeasonWatchStatus).toHaveBeenCalledWith(profileId, seasonId, status);
      expect(showService.invalidateProfileCache).toHaveBeenCalledWith(accountId, profileId);
      expect(result).toEqual({
        success: true,
        changes: mockDbResult.changes,
        affectedRows: 3,
        message: 'Updated status for 1 season, 1 episode, 1 show',
      });
    });

    it('should invalidate profile cache when show changes occur', async () => {
      mockDbService.updateSeasonWatchStatus.mockResolvedValue(mockDbResult);

      await service.updateSeasonWatchStatus(accountId, profileId, seasonId, status);

      expect(showService.invalidateProfileCache).toHaveBeenCalledWith(accountId, profileId);
    });

    it('should not invalidate profile cache when no show changes occur', async () => {
      const mockResultWithoutShowChanges: StatusUpdateResult = {
        success: true,
        changes: [
          {
            entityType: 'season',
            entityId: seasonId,
            from: WatchStatus.NOT_WATCHED,
            to: WatchStatus.WATCHED,
            timestamp: new Date(),
            reason: 'User action',
          },
        ],
        affectedRows: 1,
      };

      mockDbService.updateSeasonWatchStatus.mockResolvedValue(mockResultWithoutShowChanges);

      await service.updateSeasonWatchStatus(accountId, profileId, seasonId, status);

      expect(showService.invalidateProfileCache).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError when db service returns unsuccessful result', async () => {
      const unsuccessfulResult: StatusUpdateResult = {
        success: false,
        changes: [],
        affectedRows: 0,
      };

      mockDbService.updateSeasonWatchStatus.mockResolvedValue(unsuccessfulResult);

      await expect(service.updateSeasonWatchStatus(accountId, profileId, seasonId, status)).rejects.toThrow(
        'Handled: Failed to update season watch status',
      );
    });

    it('should handle errors from db service', async () => {
      const mockError = new Error('Transaction failed');
      mockDbService.updateSeasonWatchStatus.mockRejectedValue(mockError);

      (errorService.handleError as Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(service.updateSeasonWatchStatus(accountId, profileId, seasonId, status)).rejects.toThrow(
        'Handled: Transaction failed',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `updateSeasonWatchStatus(${profileId}, ${seasonId}, ${status})`,
      );
    });
  });

  describe('updateShowWatchStatus', () => {
    const accountId = 1;
    const profileId = 123;
    const showId = 456;
    const status = WatchStatus.WATCHED;

    const mockDbResult: StatusUpdateResult = {
      success: true,
      changes: [
        {
          entityType: 'show',
          entityId: showId,
          from: WatchStatus.WATCHING,
          to: WatchStatus.WATCHED,
          timestamp: new Date(),
          reason: 'User action',
        },
        {
          entityType: 'season',
          entityId: 789,
          from: WatchStatus.NOT_WATCHED,
          to: WatchStatus.WATCHED,
          timestamp: new Date(),
          reason: 'Show status changed',
        },
        {
          entityType: 'episode',
          entityId: 999,
          from: WatchStatus.NOT_WATCHED,
          to: WatchStatus.WATCHED,
          timestamp: new Date(),
          reason: 'Show status changed',
        },
      ],
      affectedRows: 10,
    };

    it('should successfully update show watch status', async () => {
      mockDbService.updateShowWatchStatus.mockResolvedValue(mockDbResult);

      const result = await service.updateShowWatchStatus(accountId, profileId, showId, status);

      expect(mockDbService.updateShowWatchStatus).toHaveBeenCalledWith(profileId, showId, status);
      expect(showService.invalidateProfileCache).toHaveBeenCalledWith(accountId, profileId);
      expect(result).toEqual({
        success: true,
        changes: mockDbResult.changes,
        affectedRows: 10,
        message: 'Updated status for 1 show, 1 season, 1 episode',
      });
    });

    it('should always invalidate profile cache for show updates', async () => {
      mockDbService.updateShowWatchStatus.mockResolvedValue(mockDbResult);

      await service.updateShowWatchStatus(accountId, profileId, showId, status);

      expect(showService.invalidateProfileCache).toHaveBeenCalledWith(accountId, profileId);
    });

    it('should throw DatabaseError when db service returns unsuccessful result', async () => {
      const unsuccessfulResult: StatusUpdateResult = {
        success: false,
        changes: [],
        affectedRows: 0,
      };

      mockDbService.updateShowWatchStatus.mockResolvedValue(unsuccessfulResult);

      await expect(service.updateShowWatchStatus(accountId, profileId, showId, status)).rejects.toThrow(
        'Handled: Failed to update show watch status',
      );
    });

    it('should handle errors from db service', async () => {
      const mockError = new Error('Show not found');
      mockDbService.updateShowWatchStatus.mockRejectedValue(mockError);

      (errorService.handleError as Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(service.updateShowWatchStatus(accountId, profileId, showId, status)).rejects.toThrow(
        'Handled: Show not found',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `updateShowWatchStatus(${profileId}, ${showId}, ${status})`,
      );
    });
  });

  describe('checkAndUpdateShowStatus', () => {
    const accountId = 1;
    const profileId = 123;
    const showId = 456;

    it('should successfully check and update show status', async () => {
      const mockDbResult: StatusUpdateResult = {
        success: true,
        changes: [
          {
            entityType: 'show',
            entityId: showId,
            from: WatchStatus.UP_TO_DATE,
            to: WatchStatus.WATCHING,
            timestamp: new Date(),
            reason: 'New episodes available',
          },
        ],
        affectedRows: 1,
      };

      mockDbService.checkAndUpdateShowWatchStatus.mockResolvedValue(mockDbResult);

      const result = await service.checkAndUpdateShowStatus(accountId, profileId, showId);

      expect(mockDbService.checkAndUpdateShowWatchStatus).toHaveBeenCalledWith(profileId, showId);
      expect(showService.invalidateProfileCache).toHaveBeenCalledWith(accountId, profileId);
      expect(result).toEqual({
        success: true,
        changes: mockDbResult.changes,
        affectedRows: 1,
        message: 'Updated status for 1 show',
      });
    });

    it('should return success message when no update is needed', async () => {
      const mockDbResult: StatusUpdateResult = {
        success: true,
        changes: [],
        affectedRows: 0,
      };

      mockDbService.checkAndUpdateShowWatchStatus.mockResolvedValue(mockDbResult);

      const result = await service.checkAndUpdateShowStatus(accountId, profileId, showId);

      expect(result).toEqual({
        success: true,
        changes: [],
        affectedRows: 0,
        message: 'Show status is already correct',
      });
      expect(showService.invalidateProfileCache).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError when db service returns unsuccessful result', async () => {
      const unsuccessfulResult: StatusUpdateResult = {
        success: false,
        changes: [],
        affectedRows: 0,
      };

      mockDbService.checkAndUpdateShowWatchStatus.mockResolvedValue(unsuccessfulResult);

      await expect(service.checkAndUpdateShowStatus(accountId, profileId, showId)).rejects.toThrow(
        'Handled: Failed to recalculate and update show watch status',
      );
    });

    it('should handle errors from db service', async () => {
      const mockError = new Error('Status calculation failed');
      mockDbService.checkAndUpdateShowWatchStatus.mockRejectedValue(mockError);

      (errorService.handleError as Mock).mockImplementation((error) => {
        throw new Error(`Handled: ${error.message}`);
      });

      await expect(service.checkAndUpdateShowStatus(accountId, profileId, showId)).rejects.toThrow(
        'Handled: Status calculation failed',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(
        mockError,
        `checkAndUpdateShowStatus(${profileId}, ${showId})`,
      );
    });
  });

  describe('formatChangesMessage', () => {
    it('should format no changes correctly', () => {
      const result = (service as any).formatChangesMessage([]);
      expect(result).toBe('No status changes occurred');
    });

    it('should format single change correctly', () => {
      const changes: StatusChange[] = [
        {
          entityType: 'episode',
          entityId: 1,
          from: WatchStatus.NOT_WATCHED,
          to: WatchStatus.WATCHED,
          timestamp: new Date(),
          reason: 'User action',
        },
      ];

      const result = (service as any).formatChangesMessage(changes);
      expect(result).toBe('Updated status for 1 episode');
    });

    it('should format multiple changes of same type correctly', () => {
      const changes: StatusChange[] = [
        {
          entityType: 'episode',
          entityId: 1,
          from: WatchStatus.NOT_WATCHED,
          to: WatchStatus.WATCHED,
          timestamp: new Date(),
          reason: 'User action',
        },
        {
          entityType: 'episode',
          entityId: 2,
          from: WatchStatus.NOT_WATCHED,
          to: WatchStatus.WATCHED,
          timestamp: new Date(),
          reason: 'User action',
        },
      ];

      const result = (service as any).formatChangesMessage(changes);
      expect(result).toBe('Updated status for 2 episodes');
    });

    it('should format multiple changes of different types correctly', () => {
      const changes: StatusChange[] = [
        {
          entityType: 'show',
          entityId: 1,
          from: WatchStatus.NOT_WATCHED,
          to: WatchStatus.WATCHING,
          timestamp: new Date(),
          reason: 'Episode updated',
        },
        {
          entityType: 'season',
          entityId: 2,
          from: WatchStatus.NOT_WATCHED,
          to: WatchStatus.WATCHED,
          timestamp: new Date(),
          reason: 'User action',
        },
        {
          entityType: 'episode',
          entityId: 3,
          from: WatchStatus.NOT_WATCHED,
          to: WatchStatus.WATCHED,
          timestamp: new Date(),
          reason: 'User action',
        },
        {
          entityType: 'episode',
          entityId: 4,
          from: WatchStatus.NOT_WATCHED,
          to: WatchStatus.WATCHED,
          timestamp: new Date(),
          reason: 'User action',
        },
      ];

      const result = (service as any).formatChangesMessage(changes);
      expect(result).toBe('Updated status for 1 show, 1 season, 2 episodes');
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(watchStatusService).toBeInstanceOf(WatchStatusService);
    });

    it('should use the same singleton instance', () => {
      const instance1 = watchStatusService;
      const instance2 = watchStatusService;
      expect(instance1).toBe(instance2);
    });
  });
});
