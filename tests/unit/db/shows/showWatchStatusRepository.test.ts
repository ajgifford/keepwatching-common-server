import * as showsDb from '@db/showsDb';
import { getDbPool } from '@utils/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

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

      await showsDb.saveFavorite('123', 12345, false);

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT IGNORE INTO show_watch_status (profile_id, show_id) VALUES (?,?)',
        [123, 12345],
      );
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    it('should add show to profile favorites with seasons and episodes', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]) // Insert show_watch_status
        .mockResolvedValueOnce([[{ id: 1 }, { id: 2 }] as RowDataPacket[]]) // Get seasons
        .mockResolvedValueOnce([{ affectedRows: 2 } as ResultSetHeader]) // Batch insert seasons
        .mockResolvedValueOnce([{ affectedRows: 10 } as ResultSetHeader]); // Batch insert episodes

      await showsDb.saveFavorite('123', 12345, true);

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT IGNORE INTO show_watch_status (profile_id, show_id) VALUES (?,?)',
        [123, 12345],
      );
      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT id FROM seasons WHERE show_id = ?', [12345]);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT IGNORE INTO season_watch_status (profile_id, season_id) VALUES (?,?),(?,?)',
        [123, 1, 123, 2],
      );
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT IGNORE INTO episode_watch_status (profile_id, episode_id) SELECT ?, id FROM episodes WHERE season_id IN (?,?)',
        [123, 1, 2],
      );
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    it('should handle case when show has no seasons', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]) // Insert show_watch_status
        .mockResolvedValueOnce([[] as RowDataPacket[]]); // Empty seasons response

      await showsDb.saveFavorite('123', 12345, true);

      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT IGNORE INTO show_watch_status (profile_id, show_id) VALUES (?,?)',
        [123, 12345],
      );
      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT id FROM seasons WHERE show_id = ?', [12345]);
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const error = new Error('Database error');
      mockConnection.execute.mockRejectedValueOnce(error);

      await expect(showsDb.saveFavorite('123', 12345, true)).rejects.toThrow('Database error');

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  describe('removeFavorite()', () => {
    it('should remove show and related content from profile favorites', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([[{ id: 1 }, { id: 2 }] as RowDataPacket[]]) // Get seasons
        .mockResolvedValueOnce([{ affectedRows: 10 } as ResultSetHeader]) // Delete episode watch statuses
        .mockResolvedValueOnce([{ affectedRows: 2 } as ResultSetHeader]) // Delete season watch statuses
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]); // Delete show watch status

      await showsDb.removeFavorite('123', 12345);

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT id FROM seasons WHERE show_id = ?', [12345]);
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
        ['123', 12345],
      );
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    it('should handle case when show has no seasons', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([[] as RowDataPacket[]]) // Empty seasons
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]); // Delete show watch status

      await showsDb.removeFavorite('123', 12345);

      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT id FROM seasons WHERE show_id = ?', [12345]);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'DELETE FROM show_watch_status WHERE profile_id = ? AND show_id = ?',
        ['123', 12345],
      );
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const error = new Error('Database error');
      mockConnection.execute.mockRejectedValueOnce(error);

      await expect(showsDb.removeFavorite('123', 12345)).rejects.toThrow('Database error');

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  describe('updateWatchStatus', () => {
    it('should update show watch status', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      const result = await showsDb.updateWatchStatus('123', 5, 'WATCHED');

      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE show_watch_status SET status = ? WHERE profile_id = ? AND show_id = ?',
        ['WATCHED', '123', 5],
      );
      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      const result = await showsDb.updateWatchStatus('123', 999, 'WATCHED');

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(error);

      await expect(showsDb.updateWatchStatus('123', 5, 'WATCHED')).rejects.toThrow();
    });
  });

  describe('updateWatchStatusBySeason', () => {
    it('should update show status based on all seasons having same status', async () => {
      // Mock the case where all seasons have the same status (e.g., all "WATCHED")
      mockPool.execute
        .mockResolvedValueOnce([[{ show_status: 'WATCHED' }] as RowDataPacket[]]) // Status query response
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]); // Update response

      await showsDb.updateWatchStatusBySeason('123', 5);

      expect(mockPool.execute).toHaveBeenCalledTimes(2);
      expect(mockPool.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT CASE WHEN COUNT(DISTINCT status) = 1 THEN MAX(status)'),
        [5, '123'],
      );
      expect(mockPool.execute).toHaveBeenNthCalledWith(
        2,
        'UPDATE show_watch_status SET status = ? WHERE profile_id = ? AND show_id = ?',
        ['WATCHED', '123', 5],
      );
    });

    it('should update show status to WATCHING when seasons have mixed statuses', async () => {
      // Mock the case where seasons have mixed statuses
      mockPool.execute
        .mockResolvedValueOnce([[{ show_status: 'WATCHING' }] as RowDataPacket[]]) // Status query response
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]); // Update response

      await showsDb.updateWatchStatusBySeason('123', 5);

      expect(mockPool.execute).toHaveBeenNthCalledWith(
        2,
        'UPDATE show_watch_status SET status = ? WHERE profile_id = ? AND show_id = ?',
        ['WATCHING', '123', 5],
      );
    });

    it('should do nothing when no status result is returned', async () => {
      mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[]]); // Empty result

      await showsDb.updateWatchStatusBySeason('123', 5);

      expect(mockPool.execute).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(error);

      await expect(showsDb.updateWatchStatusBySeason('123', 5)).rejects.toThrow();
    });
  });

  describe('updateAllWatchStatuses', () => {
    it('should update show, seasons, and episodes statuses', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]) // Show update
        .mockResolvedValueOnce([{ affectedRows: 3 } as ResultSetHeader]) // Seasons update
        .mockResolvedValueOnce([{ affectedRows: 15 } as ResultSetHeader]); // Episodes update

      const result = await showsDb.updateAllWatchStatuses('123', 5, 'WATCHED');

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.execute).toHaveBeenCalledTimes(3);
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        1,
        'UPDATE show_watch_status SET status = ? WHERE profile_id = ? AND show_id = ?',
        ['WATCHED', '123', 5],
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        'UPDATE season_watch_status SET status = ? WHERE profile_id = ? AND season_id IN (SELECT id FROM seasons WHERE show_id = ?)',
        ['WATCHED', '123', 5],
      );
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        3,
        'UPDATE episode_watch_status SET status = ? WHERE profile_id = ? AND episode_id IN (SELECT id FROM episodes WHERE season_id IN (SELECT id FROM seasons WHERE show_id = ?))',
        ['WATCHED', '123', 5],
      );
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when show update fails', async () => {
      mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]); // Show update fails

      const result = await showsDb.updateAllWatchStatuses('123', 5, 'WATCHED');

      expect(result).toBe(false);
      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    it('should return false when seasons update fails', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]) // Show update succeeds
        .mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]); // Seasons update fails

      const result = await showsDb.updateAllWatchStatuses('123', 5, 'WATCHED');

      expect(result).toBe(false);
      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const error = new Error('Database error');
      mockConnection.execute.mockRejectedValueOnce(error);

      await expect(showsDb.updateAllWatchStatuses('123', 5, 'WATCHED')).rejects.toThrow('Database error');

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  describe('getWatchStatus', () => {
    it('should return the current watch status of a show for a profile', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ status: 'WATCHED' }] as RowDataPacket[]]);

      const status = await showsDb.getWatchStatus('123', 5);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT status FROM show_watch_status WHERE profile_id = ? AND show_id = ?',
        ['123', 5],
      );
      expect(status).toBe('WATCHED');
    });

    it('should return null when status not found', async () => {
      mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[]]);

      const status = await showsDb.getWatchStatus('123', 999);

      expect(status).toBeNull();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockPool.execute.mockRejectedValueOnce(error);

      await expect(showsDb.getWatchStatus('123', 5)).rejects.toThrow();
    });
  });
});
