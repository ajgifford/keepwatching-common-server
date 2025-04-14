import * as episodeModule from '@db/episodesDb';
import { getDbPool } from '@utils/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

jest.mock('@utils/db', () => {
  const mockPool = {
    execute: jest.fn(),
  };
  return {
    getDbPool: jest.fn(() => mockPool),
  };
});

describe('Episode Module', () => {
  let mockPool: any;

  beforeEach(() => {
    mockPool = getDbPool();
    mockPool.execute.mockReset();
  });

  describe('saveEpisode', () => {
    it('should insert episode into DB', async () => {
      mockPool.execute.mockResolvedValueOnce([{ insertId: 5 } as ResultSetHeader]);

      const episode: episodeModule.Episode = {
        tmdb_id: 98765,
        show_id: 42,
        season_id: 15,
        episode_number: 3,
        episode_type: 'standard',
        season_number: 2,
        title: 'The One With the Test',
        overview: 'Episode description',
        air_date: '2023-05-15',
        runtime: 45,
        still_image: '/path/to/still.jpg',
      };

      const savedEpisode = await episodeModule.saveEpisode(episode);

      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT into episodes (tmdb_id, season_id, show_id, episode_number, episode_type, season_number, title, overview, air_date, runtime, still_image) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [
          98765,
          15,
          42,
          3,
          'standard',
          2,
          'The One With the Test',
          'Episode description',
          '2023-05-15',
          45,
          '/path/to/still.jpg',
        ],
      );
      expect(savedEpisode.id).toBe(5);
    });

    it('should throw error when saving fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      const episode: episodeModule.Episode = {
        tmdb_id: 98765,
        show_id: 42,
        season_id: 15,
        episode_number: 3,
        episode_type: 'standard',
        season_number: 2,
        title: 'The One With the Test',
        overview: 'Episode description',
        air_date: '2023-05-15',
        runtime: 45,
        still_image: '/path/to/still.jpg',
      };

      await expect(episodeModule.updateEpisode(episode)).rejects.toThrow('DB connection failed');
    });
  });

  describe('updateEpisode', () => {
    it('should update episode in DB', async () => {
      mockPool.execute.mockResolvedValueOnce([{ insertId: 5 } as ResultSetHeader]);

      const episode: episodeModule.Episode = {
        tmdb_id: 98765,
        show_id: 42,
        season_id: 15,
        episode_number: 3,
        episode_type: 'standard',
        season_number: 2,
        title: 'The One With the Updated Title',
        overview: 'Updated episode description',
        air_date: '2023-05-15',
        runtime: 48,
        still_image: '/path/to/new_still.jpg',
      };

      const updatedEpisode = await episodeModule.updateEpisode(episode);

      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT into episodes (tmdb_id, season_id, show_id, episode_number, episode_type, season_number, title, overview, air_date, runtime, still_image) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), episode_number = ?, episode_type = ?, season_number = ?, title = ?, overview = ?, air_date = ?, runtime = ?, still_image = ?',
        [
          // Insert values
          98765,
          15,
          42,
          3,
          'standard',
          2,
          'The One With the Updated Title',
          'Updated episode description',
          '2023-05-15',
          48,
          '/path/to/new_still.jpg',
          // Update values
          3,
          'standard',
          2,
          'The One With the Updated Title',
          'Updated episode description',
          '2023-05-15',
          48,
          '/path/to/new_still.jpg',
        ],
      );
    });

    it('should throw error with default message when updating fails', async () => {
      mockPool.execute.mockRejectedValue({});

      const episode: episodeModule.Episode = {
        tmdb_id: 98765,
        show_id: 42,
        season_id: 15,
        episode_number: 3,
        episode_type: 'standard',
        season_number: 2,
        title: 'The One With the Test',
        overview: 'Episode description',
        air_date: '2023-05-15',
        runtime: 45,
        still_image: '/path/to/still.jpg',
      };

      await expect(episodeModule.updateEpisode(episode)).rejects.toThrow('Unknown database error updating an episode');
    });
  });

  describe('saveFavorite', () => {
    it('should save episode as favorite', async () => {
      mockPool.execute.mockResolvedValueOnce([{} as ResultSetHeader]);

      await episodeModule.saveFavorite(123, 5);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT IGNORE INTO episode_watch_status (profile_id, episode_id) VALUES (?,?)',
        [123, 5],
      );
    });

    it('should throw error when saving favorite fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      await expect(episodeModule.saveFavorite(123, 5)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when saving favorite fails', async () => {
      mockPool.execute.mockRejectedValue({});

      await expect(episodeModule.saveFavorite(123, 5)).rejects.toThrow(
        'Unknown database error saving an episode as a favorite',
      );
    });
  });

  describe('removeFavorite', () => {
    it('should remove episode from favorites', async () => {
      mockPool.execute.mockResolvedValueOnce([{} as ResultSetHeader]);

      await episodeModule.removeFavorite('123', 5);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'DELETE FROM episode_watch_status WHERE profile_id = ? AND episode_id = ?',
        [123, 5],
      );
    });

    it('should throw error when removing favorite fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      await expect(episodeModule.removeFavorite('123', 5)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when removing favorite fails', async () => {
      mockPool.execute.mockRejectedValue({});

      await expect(episodeModule.removeFavorite('123', 5)).rejects.toThrow(
        'Unknown database error removing an episode as a favorite',
      );
    });
  });

  describe('updateWatchStatus', () => {
    it('should update watch status', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      const result = await episodeModule.updateWatchStatus('123', 5, 'WATCHED');

      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE episode_watch_status SET status = ? WHERE profile_id = ? AND episode_id = ?',
        ['WATCHED', '123', 5],
      );
      expect(result).toBe(true);
    });

    it('should return false if no rows affected', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      const result = await episodeModule.updateWatchStatus('123', 5, 'WATCHED');

      expect(result).toBe(false);
    });

    it('should throw error when updating watch status fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      await expect(episodeModule.updateWatchStatus('123', 5, 'WATCHED')).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when updating watch status fails', async () => {
      mockPool.execute.mockRejectedValue({});

      await expect(episodeModule.updateWatchStatus('123', 5, 'WATCHED')).rejects.toThrow(
        'Unknown database error updating an episode watch status',
      );
    });
  });

  describe('getEpisodesForSeason', () => {
    it('should return episodes for season', async () => {
      const mockEpisodes = [
        { episode_id: 1, title: 'Episode 1', watch_status: 'WATCHED' },
        { episode_id: 2, title: 'Episode 2', watch_status: 'NOT_WATCHED' },
      ];

      mockPool.execute.mockResolvedValueOnce([mockEpisodes as RowDataPacket[]]);

      const episodes = await episodeModule.getEpisodesForSeason('123', 5);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * FROM profile_episodes where profile_id = ? and season_id = ? ORDER BY episode_number',
        [123, 5],
      );
      expect(episodes).toEqual(mockEpisodes);
    });

    it('should throw error when getting episodes for season fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      await expect(episodeModule.getEpisodesForSeason('123', 5)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when getting episodes for season fails', async () => {
      mockPool.execute.mockRejectedValue({});

      await expect(episodeModule.getEpisodesForSeason('123', 5)).rejects.toThrow(
        'Unknown database error getting episodes for a season',
      );
    });
  });

  describe('createEpisode', () => {
    it('should create episode object without ID', () => {
      const episode = episodeModule.createEpisode(
        98765,
        42,
        15,
        3,
        'standard',
        2,
        'Test Episode',
        'Overview',
        '2023-05-15',
        45,
        '/path/to/still.jpg',
      );

      expect(episode).toEqual({
        tmdb_id: 98765,
        show_id: 42,
        season_id: 15,
        episode_number: 3,
        episode_type: 'standard',
        season_number: 2,
        title: 'Test Episode',
        overview: 'Overview',
        air_date: '2023-05-15',
        runtime: 45,
        still_image: '/path/to/still.jpg',
      });
      expect(episode.id).toBeUndefined();
    });

    it('should create episode object with ID', () => {
      const episode = episodeModule.createEpisode(
        98765,
        42,
        15,
        3,
        'standard',
        2,
        'Test Episode',
        'Overview',
        '2023-05-15',
        45,
        '/path/to/still.jpg',
        5,
      );

      expect(episode).toEqual({
        id: 5,
        tmdb_id: 98765,
        show_id: 42,
        season_id: 15,
        episode_number: 3,
        episode_type: 'standard',
        season_number: 2,
        title: 'Test Episode',
        overview: 'Overview',
        air_date: '2023-05-15',
        runtime: 45,
        still_image: '/path/to/still.jpg',
      });
    });
  });
});
