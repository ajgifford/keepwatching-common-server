import { WatchStatus } from '@ajgifford/keepwatching-types';
import * as showsDb from '@db/showsDb';
import { getDbPool } from '@utils/db';
import { ResultSetHeader } from 'mysql2';

jest.mock('@utils/db', () => {
  const mockPool = {
    execute: jest.fn(),
    getConnection: jest.fn(),
  };
  return {
    getDbPool: jest.fn(() => mockPool),
  };
});

describe('showWatchStatusRepository', () => {
  let mockPool: {
    execute: jest.Mock;
    getConnection: jest.Mock;
  };
  let mockConnection: {
    execute: jest.Mock;
    beginTransaction: jest.Mock;
    commit: jest.Mock;
    rollback: jest.Mock;
    release: jest.Mock;
  };

  beforeEach(() => {
    mockConnection = {
      execute: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    mockPool = getDbPool() as any;
    mockPool.execute.mockReset();
    mockPool.getConnection.mockReset();
    mockPool.getConnection.mockResolvedValue(mockConnection);
  });

  describe('saveFavorite()', () => {
    it('should add show to profile favorites without children', async () => {
      mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      await showsDb.saveFavorite(123, 12345, false);

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT IGNORE INTO show_watch_status (profile_id, show_id, status) VALUES (?,?,?)',
        [123, 12345, WatchStatus.NOT_WATCHED],
      );
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    it('should add show to profile favorites with seasons and episodes', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]) // Insert show_watch_status
        .mockResolvedValueOnce([
          [
            { id: 1, release_date: '2024-05-05' },
            { id: 2, release_date: '2025-05-02' },
          ],
        ]) // Get seasons
        .mockResolvedValueOnce([{ affectedRows: 2 } as ResultSetHeader]) // Batch insert seasons
        .mockResolvedValueOnce([
          [
            { id: 1, air_date: '2024-05-05' },
            { id: 2, air_date: '2024-05-12' },
            { id: 3, air_date: '2025-05-02' },
            { id: 4, air_date: '2024-05-09' },
          ],
        ]) // Get episodes
        .mockResolvedValueOnce([{ affectedRows: 10 } as ResultSetHeader]); // Batch insert episodes

      await showsDb.saveFavorite(123, 12345, true);

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT IGNORE INTO show_watch_status (profile_id, show_id, status) VALUES (?,?,?)',
        [123, 12345, WatchStatus.NOT_WATCHED],
      );
      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT id, release_date FROM seasons WHERE show_id = ?', [
        12345,
      ]);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT IGNORE INTO season_watch_status (status, profile_id, season_id) VALUES (?,?,?),(?,?,?)',
        [WatchStatus.NOT_WATCHED, 123, 1, WatchStatus.NOT_WATCHED, 123, 2],
      );
      expect(mockConnection.execute).toHaveBeenCalledWith(
        `SELECT id, air_date FROM episodes WHERE season_id IN (?,?)`,
        [1, 2],
      );
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT IGNORE INTO episode_watch_status (status, profile_id, episode_id) VALUES (?,?,?),(?,?,?),(?,?,?),(?,?,?)',
        [
          WatchStatus.NOT_WATCHED,
          123,
          1,
          WatchStatus.NOT_WATCHED,
          123,
          2,
          WatchStatus.NOT_WATCHED,
          123,
          3,
          WatchStatus.NOT_WATCHED,
          123,
          4,
        ],
      );
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    it('should handle case when show has no seasons', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]) // Insert show_watch_status
        .mockResolvedValueOnce([[]]); // Empty seasons response

      await showsDb.saveFavorite(123, 12345, true);

      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT IGNORE INTO show_watch_status (profile_id, show_id, status) VALUES (?,?,?)',
        [123, 12345, WatchStatus.NOT_WATCHED],
      );
      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT id, release_date FROM seasons WHERE show_id = ?', [
        12345,
      ]);
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const error = new Error('Database error');
      mockConnection.execute.mockRejectedValueOnce(error);

      await expect(showsDb.saveFavorite(123, 12345, true)).rejects.toThrow('Database error');

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  describe('removeFavorite()', () => {
    it('should remove show and related content from profile favorites', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([[{ id: 1 }, { id: 2 }]]) // Get seasons
        .mockResolvedValueOnce([{ affectedRows: 10 } as ResultSetHeader]) // Delete episode watch statuses
        .mockResolvedValueOnce([{ affectedRows: 2 } as ResultSetHeader]) // Delete season watch statuses
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]); // Delete show watch status

      await showsDb.removeFavorite(123, 12345);

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT id, release_date FROM seasons WHERE show_id = ?', [
        12345,
      ]);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'DELETE FROM episode_watch_status WHERE profile_id = ? AND episode_id IN (SELECT id FROM episodes WHERE season_id IN (?,?))',
        [123, 1, 2],
      );
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'DELETE FROM season_watch_status WHERE profile_id = ? AND season_id IN (?,?)',
        [123, 1, 2],
      );
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'DELETE FROM show_watch_status WHERE profile_id = ? AND show_id = ?',
        [123, 12345],
      );
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    it('should handle case when show has no seasons', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([[]]) // Empty seasons
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]); // Delete show watch status

      await showsDb.removeFavorite(123, 12345);

      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT id, release_date FROM seasons WHERE show_id = ?', [
        12345,
      ]);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'DELETE FROM show_watch_status WHERE profile_id = ? AND show_id = ?',
        [123, 12345],
      );
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const error = new Error('Database error');
      mockConnection.execute.mockRejectedValueOnce(error);

      await expect(showsDb.removeFavorite(123, 12345)).rejects.toThrow('Database error');

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });
});
