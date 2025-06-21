import { RecentUpcomingEpisodeRow } from '../../../src/types/episodeTypes';
import { CreateEpisodeRequest, UpdateEpisodeRequest, WatchStatus } from '@ajgifford/keepwatching-types';
import * as episodeModule from '@db/episodesDb';
import { getDbPool } from '@utils/db';
import { ResultSetHeader } from 'mysql2';

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

      const episode: CreateEpisodeRequest = {
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

      const savedEpisodeId = await episodeModule.saveEpisode(episode);

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
      expect(savedEpisodeId).toBe(5);
    });

    it('should throw error when saving fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      const episode: CreateEpisodeRequest = {
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

      await expect(episodeModule.saveEpisode(episode)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when saving fails without error message', async () => {
      mockPool.execute.mockRejectedValue({});

      const episode: CreateEpisodeRequest = {
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

      await expect(episodeModule.saveEpisode(episode)).rejects.toThrow('Unknown database error saving an episode');
    });
  });

  describe('updateEpisode', () => {
    it('should update episode in DB', async () => {
      mockPool.execute.mockResolvedValueOnce([{ insertId: 5 } as ResultSetHeader]);

      const episode: UpdateEpisodeRequest = {
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

      await episodeModule.updateEpisode(episode);

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

      const episode: UpdateEpisodeRequest = {
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
        'INSERT IGNORE INTO episode_watch_status (profile_id, episode_id, status) VALUES (?,?,?)',
        [123, 5, WatchStatus.NOT_WATCHED],
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

      await episodeModule.removeFavorite(123, 5);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'DELETE FROM episode_watch_status WHERE profile_id = ? AND episode_id = ?',
        [123, 5],
      );
    });

    it('should throw error when removing favorite fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      await expect(episodeModule.removeFavorite(123, 5)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when removing favorite fails', async () => {
      mockPool.execute.mockRejectedValue({});

      await expect(episodeModule.removeFavorite(123, 5)).rejects.toThrow(
        'Unknown database error removing an episode as a favorite',
      );
    });
  });

  describe('getEpisodesForSeason', () => {
    it('should return episodes for season', async () => {
      const mockEpisodes = [
        { episode_id: 1, title: 'Episode 1', watch_status: 'WATCHED' },
        { episode_id: 2, title: 'Episode 2', watch_status: 'NOT_WATCHED' },
      ];

      const expectedEpisodes = [
        { id: 1, title: 'Episode 1', watchStatus: 'WATCHED' },
        { id: 2, title: 'Episode 2', watchStatus: 'NOT_WATCHED' },
      ];

      mockPool.execute.mockResolvedValueOnce([mockEpisodes]);

      const episodes = await episodeModule.getEpisodesForSeason(123, 5);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * FROM profile_episodes where profile_id = ? and season_id = ? ORDER BY episode_number',
        [123, 5],
      );
      expect(episodes).toEqual(expectedEpisodes);
    });

    it('should throw error when getting episodes for season fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      await expect(episodeModule.getEpisodesForSeason(123, 5)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when getting episodes for season fails', async () => {
      mockPool.execute.mockRejectedValue({});

      await expect(episodeModule.getEpisodesForSeason(123, 5)).rejects.toThrow(
        'Unknown database error getting episodes for a season',
      );
    });
  });

  describe('getUpcomingEpisodesForProfile', () => {
    it('should return upcoming episodes for profile', async () => {
      const mockUpcomingEpisodes = [
        {
          profile_id: 1,
          show_id: 42,
          show_name: 'Test Show',
          streaming_services: 'Netflix',
          network: 'Netflix',
          episode_title: 'Episode 1',
          air_date: '2025-04-20',
          episode_number: 1,
          season_number: 1,
          episode_still_image: 'image.png',
        },
        {
          profile_id: 1,
          show_id: 42,
          show_name: 'Test Show',
          streaming_services: 'Netflix',
          network: 'Netflix',
          episode_title: 'Episode 2',
          air_date: '2025-04-25',
          episode_number: 2,
          season_number: 1,
          episode_still_image: 'image.png',
        },
      ] as RecentUpcomingEpisodeRow[];

      const expectedEpisodes = [
        {
          profileId: 1,
          showId: 42,
          showName: 'Test Show',
          streamingServices: 'Netflix',
          network: 'Netflix',
          episodeTitle: 'Episode 1',
          airDate: '2025-04-20',
          episodeNumber: 1,
          seasonNumber: 1,
          episodeStillImage: 'image.png',
        },
        {
          profileId: 1,
          showId: 42,
          showName: 'Test Show',
          streamingServices: 'Netflix',
          network: 'Netflix',
          episodeTitle: 'Episode 2',
          airDate: '2025-04-25',
          episodeNumber: 2,
          seasonNumber: 1,
          episodeStillImage: 'image.png',
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockUpcomingEpisodes]);

      const result = await episodeModule.getUpcomingEpisodesForProfile(123);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * from profile_upcoming_episodes where profile_id = ? LIMIT 6',
        [123],
      );
      expect(result).toEqual(expectedEpisodes);
    });

    it('should return empty array when no upcoming episodes exist', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await episodeModule.getUpcomingEpisodesForProfile(123);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * from profile_upcoming_episodes where profile_id = ? LIMIT 6',
        [123],
      );
      expect(result).toEqual([]);
    });

    it('should throw error when getting upcoming episodes fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      await expect(episodeModule.getUpcomingEpisodesForProfile(123)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when getting upcoming episodes fails', async () => {
      mockPool.execute.mockRejectedValue({});

      await expect(episodeModule.getUpcomingEpisodesForProfile(123)).rejects.toThrow(
        'Unknown database error getting upcoming episodes for a profile',
      );
    });
  });

  describe('getRecentEpisodesForProfile', () => {
    it('should return recent episodes for profile', async () => {
      const mockRecentEpisodes = [
        {
          profile_id: 1,
          show_id: 42,
          show_name: 'Test Show',
          streaming_services: 'Netflix',
          network: 'Netflix',
          episode_title: 'Episode 1',
          air_date: '2025-04-20',
          episode_number: 1,
          season_number: 1,
          episode_still_image: 'image.png',
        },
        {
          profile_id: 1,
          show_id: 42,
          show_name: 'Test Show',
          streaming_services: 'Netflix',
          network: 'Netflix',
          episode_title: 'Episode 2',
          air_date: '2025-04-25',
          episode_number: 2,
          season_number: 1,
          episode_still_image: 'image.png',
        },
      ] as RecentUpcomingEpisodeRow[];

      const expectedEpisodes = [
        {
          profileId: 1,
          showId: 42,
          showName: 'Test Show',
          streamingServices: 'Netflix',
          network: 'Netflix',
          episodeTitle: 'Episode 1',
          airDate: '2025-04-20',
          episodeNumber: 1,
          seasonNumber: 1,
          episodeStillImage: 'image.png',
        },
        {
          profileId: 1,
          showId: 42,
          showName: 'Test Show',
          streamingServices: 'Netflix',
          network: 'Netflix',
          episodeTitle: 'Episode 2',
          airDate: '2025-04-25',
          episodeNumber: 2,
          seasonNumber: 1,
          episodeStillImage: 'image.png',
        },
      ];

      mockPool.execute.mockResolvedValueOnce([mockRecentEpisodes]);

      const result = await episodeModule.getRecentEpisodesForProfile(123);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * from profile_recent_episodes where profile_id = ? ORDER BY air_date DESC LIMIT 6',
        [123],
      );
      expect(result).toEqual(expectedEpisodes);
    });

    it('should return empty array when no recent episodes exist', async () => {
      mockPool.execute.mockResolvedValueOnce([[]]);

      const result = await episodeModule.getRecentEpisodesForProfile(123);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * from profile_recent_episodes where profile_id = ? ORDER BY air_date DESC LIMIT 6',
        [123],
      );
      expect(result).toEqual([]);
    });

    it('should throw error when getting recent episodes fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      await expect(episodeModule.getRecentEpisodesForProfile(123)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when getting recent episodes fails', async () => {
      mockPool.execute.mockRejectedValue({});

      await expect(episodeModule.getRecentEpisodesForProfile(123)).rejects.toThrow(
        'Unknown database error getting recent episodes for a profile',
      );
    });
  });
});
