import { setupDatabaseTest } from './helpers/dbTestSetup';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import * as watchlistDb from '@db/watchlistDb';
import { DatabaseError } from '@middleware/errorMiddleware';
import { ResultSetHeader } from 'mysql2';

describe('watchlistDb Module', () => {
  let mockExecute: jest.Mock;
  let mockConnection: any;
  let mockGetConnection: jest.Mock;

  const mockWatchlistRow = {
    id: 1,
    profile_id: 10,
    content_type: 'show' as const,
    content_id: 42,
    priority: 0,
    added_at: '2026-06-01T00:00:00.000Z',
    title: 'Breaking Bad',
    poster_image: '/poster.jpg',
    genres: 'Drama, Crime',
    streaming_services: 'Netflix',
    runtime: 47,
    current_watch_status: WatchStatus.NOT_WATCHED,
  };

  const expectedWatchlistItem = {
    id: 1,
    profileId: 10,
    contentType: 'show',
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
    jest.clearAllMocks();
    const mocks = setupDatabaseTest();
    mockExecute = mocks.mockExecute;
    mockConnection = mocks.mockConnection;
    mockGetConnection = mocks.mockGetConnection;

    mockConnection.beginTransaction = jest.fn().mockResolvedValue(undefined);
    mockConnection.commit = jest.fn().mockResolvedValue(undefined);
    mockConnection.rollback = jest.fn().mockResolvedValue(undefined);
  });

  describe('getWatchlistForProfile()', () => {
    it('should return mapped WatchlistItems for profileId', async () => {
      mockExecute.mockResolvedValueOnce([[mockWatchlistRow]]);

      const result = await watchlistDb.getWatchlistForProfile(10);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('WHERE wi.profile_id = ?'), [10]);
      expect(result).toEqual([expectedWatchlistItem]);
    });

    it('should map current_watch_status through to currentWatchStatus', async () => {
      const rowWithStatus = { ...mockWatchlistRow, current_watch_status: WatchStatus.WATCHING };
      mockExecute.mockResolvedValueOnce([[rowWithStatus]]);

      const result = await watchlistDb.getWatchlistForProfile(10);

      expect(result[0].currentWatchStatus).toBe(WatchStatus.WATCHING);
    });

    it('should default a null current_watch_status to NOT_WATCHED', async () => {
      const rowWithNullStatus = { ...mockWatchlistRow, current_watch_status: null as unknown as WatchStatus };
      mockExecute.mockResolvedValueOnce([[rowWithNullStatus]]);

      const result = await watchlistDb.getWatchlistForProfile(10);

      expect(result[0].currentWatchStatus).toBe(WatchStatus.NOT_WATCHED);
    });

    it('should default null genres and streaming_services to empty string', async () => {
      const rowWithNulls = { ...mockWatchlistRow, genres: null, streaming_services: null };
      mockExecute.mockResolvedValueOnce([[rowWithNulls]]);

      const result = await watchlistDb.getWatchlistForProfile(10);

      expect(result[0].genres).toBe('');
      expect(result[0].streamingServices).toBe('');
    });

    it('should default null runtime to null', async () => {
      const rowWithNullRuntime = { ...mockWatchlistRow, runtime: null };
      mockExecute.mockResolvedValueOnce([[rowWithNullRuntime]]);

      const result = await watchlistDb.getWatchlistForProfile(10);

      expect(result[0].runtime).toBeNull();
    });

    it('should return empty array when profile has no watchlist items', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await watchlistDb.getWatchlistForProfile(99);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Connection lost'));

      await expect(watchlistDb.getWatchlistForProfile(10)).rejects.toThrow(DatabaseError);
    });
  });

  describe('addWatchlistItem()', () => {
    it('should insert item and return the newly created WatchlistItem', async () => {
      mockExecute
        .mockResolvedValueOnce([{ insertId: 1 } as ResultSetHeader])
        .mockResolvedValueOnce([[mockWatchlistRow]]);

      const result = await watchlistDb.addWatchlistItem(5, 10, 'show', 42);

      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenNthCalledWith(1, expect.stringContaining('INSERT INTO watchlist_items'), [
        5,
        10,
        'show',
        42,
        10,
      ]);
      expect(result).toEqual(expectedWatchlistItem);
    });

    it('should throw DatabaseError when inserted item is not found in subsequent fetch', async () => {
      mockExecute
        .mockResolvedValueOnce([{ insertId: 999 } as ResultSetHeader])
        .mockResolvedValueOnce([[mockWatchlistRow]]); // row has id: 1, not 999

      await expect(watchlistDb.addWatchlistItem(5, 10, 'show', 42)).rejects.toThrow(DatabaseError);
    });

    it('should throw DatabaseError on INSERT failure', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Duplicate entry'));

      await expect(watchlistDb.addWatchlistItem(5, 10, 'show', 42)).rejects.toThrow(DatabaseError);
    });
  });

  describe('removeWatchlistItem()', () => {
    it('should execute DELETE with correct itemId and profileId', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await watchlistDb.removeWatchlistItem(1, 10);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM watchlist_items WHERE id = ? AND profile_id = ?'),
        [1, 10],
      );
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Connection lost'));

      await expect(watchlistDb.removeWatchlistItem(1, 10)).rejects.toThrow(DatabaseError);
    });
  });

  describe('updateWatchlistPriorities()', () => {
    it('should begin transaction, update each priority, and commit', async () => {
      const priorities = [
        { id: 1, priority: 0 },
        { id: 2, priority: 1 },
      ];
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await watchlistDb.updateWatchlistPriorities(10, priorities);

      expect(mockGetConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('UPDATE watchlist_items SET priority = ?'),
        [0, 1, 10],
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE watchlist_items SET priority = ?'),
        [1, 2, 10],
      );
      expect(mockConnection.commit).toHaveBeenCalledTimes(1);
      expect(mockConnection.rollback).not.toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should rollback and rethrow when an execute fails', async () => {
      const priorities = [{ id: 1, priority: 0 }];
      mockConnection.execute.mockRejectedValueOnce(new Error('Lock timeout'));

      await expect(watchlistDb.updateWatchlistPriorities(10, priorities)).rejects.toThrow(DatabaseError);

      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).not.toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should always release the connection even on error', async () => {
      mockConnection.execute.mockRejectedValueOnce(new Error('Unexpected error'));

      await expect(watchlistDb.updateWatchlistPriorities(10, [{ id: 1, priority: 0 }])).rejects.toThrow();

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });
  });
});
