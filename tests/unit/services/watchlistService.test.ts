import { WatchStatus } from '@ajgifford/keepwatching-types';
import * as watchlistDb from '@db/watchlistDb';
import { WatchlistService } from '@services/watchlistService';

jest.mock('@db/watchlistDb');

describe('watchlistService', () => {
  let service: WatchlistService;

  const mockItem = {
    id: 1,
    profileId: 10,
    contentType: 'show' as const,
    contentId: 42,
    priority: 0,
    addedAt: '2026-06-01T00:00:00.000Z',
    title: 'Breaking Bad',
    posterImage: '/poster.jpg',
    genres: 'Drama, Crime',
    streamingServices: 'Netflix',
    runtime: 47,
    currentWatchStatus: WatchStatus.NOT_WATCHED,
  };

  beforeEach(() => {
    service = new WatchlistService();
    jest.clearAllMocks();
  });

  describe('getWatchlist', () => {
    it('should return WatchlistItems for the given profileId', async () => {
      (watchlistDb.getWatchlistForProfile as jest.Mock).mockResolvedValue([mockItem]);

      const result = await service.getWatchlist(10);

      expect(watchlistDb.getWatchlistForProfile).toHaveBeenCalledWith(10);
      expect(result).toEqual([mockItem]);
    });

    it('should return empty array when no items exist', async () => {
      (watchlistDb.getWatchlistForProfile as jest.Mock).mockResolvedValue([]);

      const result = await service.getWatchlist(99);

      expect(result).toEqual([]);
    });

    it('should propagate errors from the DB layer', async () => {
      (watchlistDb.getWatchlistForProfile as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(service.getWatchlist(10)).rejects.toThrow();
    });
  });

  describe('addItem', () => {
    it('should call addWatchlistItem with correct params and return the new item', async () => {
      (watchlistDb.addWatchlistItem as jest.Mock).mockResolvedValue(mockItem);

      const result = await service.addItem(5, 10, 'show', 42);

      expect(watchlistDb.addWatchlistItem).toHaveBeenCalledWith(5, 10, 'show', 42);
      expect(result).toEqual(mockItem);
    });

    it('should work for movie content type', async () => {
      const movieItem = { ...mockItem, contentType: 'movie' as const, contentId: 99 };
      (watchlistDb.addWatchlistItem as jest.Mock).mockResolvedValue(movieItem);

      const result = await service.addItem(5, 10, 'movie', 99);

      expect(watchlistDb.addWatchlistItem).toHaveBeenCalledWith(5, 10, 'movie', 99);
      expect(result).toEqual(movieItem);
    });

    it('should propagate errors from the DB layer', async () => {
      (watchlistDb.addWatchlistItem as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(service.addItem(5, 10, 'show', 42)).rejects.toThrow();
    });
  });

  describe('removeItem', () => {
    it('should call removeWatchlistItem with correct itemId and profileId', async () => {
      (watchlistDb.removeWatchlistItem as jest.Mock).mockResolvedValue(undefined);

      await service.removeItem(1, 10);

      expect(watchlistDb.removeWatchlistItem).toHaveBeenCalledWith(1, 10);
    });

    it('should propagate errors from the DB layer', async () => {
      (watchlistDb.removeWatchlistItem as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(service.removeItem(1, 10)).rejects.toThrow();
    });
  });

  describe('updatePriorities', () => {
    it('should call updateWatchlistPriorities with profileId and priorities array', async () => {
      const priorities = [
        { id: 1, priority: 0 },
        { id: 2, priority: 1 },
      ];
      (watchlistDb.updateWatchlistPriorities as jest.Mock).mockResolvedValue(undefined);

      await service.updatePriorities(10, priorities);

      expect(watchlistDb.updateWatchlistPriorities).toHaveBeenCalledWith(10, priorities);
    });

    it('should propagate errors from the DB layer', async () => {
      (watchlistDb.updateWatchlistPriorities as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(service.updatePriorities(10, [{ id: 1, priority: 0 }])).rejects.toThrow();
    });
  });
});
