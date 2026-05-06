import { RecentUpcomingEpisodeRow } from '../../../src/types/episodeTypes';
import { setupDatabaseTest } from './helpers/dbTestSetup';
import { CreateEpisodeRequest, UpdateEpisodeRequest, WatchStatus } from '@ajgifford/keepwatching-types';
import * as episodeModule from '@db/episodesDb';
import { ResultSetHeader } from 'mysql2';

describe('Episode Module', () => {
  let mockExecute: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup all database mocks using the helper
    const mocks = setupDatabaseTest();
    mockExecute = mocks.mockExecute;
  });

  describe('saveEpisode', () => {
    it('should insert episode into DB', async () => {
      mockExecute.mockResolvedValueOnce([{ insertId: 5 } as ResultSetHeader]);

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

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
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
      mockExecute.mockRejectedValue(mockError);

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
      mockExecute.mockRejectedValue({});

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
      mockExecute.mockResolvedValueOnce([{ insertId: 5 } as ResultSetHeader]);

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

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
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
      mockExecute.mockRejectedValue({});

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
      mockExecute.mockResolvedValueOnce([{} as ResultSetHeader]);

      await episodeModule.saveFavorite(123, 5);

      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT IGNORE INTO episode_watch_status (profile_id, episode_id, status) VALUES (?,?,?)',
        [123, 5, WatchStatus.NOT_WATCHED],
      );
    });

    it('should throw error when saving favorite fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);

      await expect(episodeModule.saveFavorite(123, 5)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when saving favorite fails', async () => {
      mockExecute.mockRejectedValue({});

      await expect(episodeModule.saveFavorite(123, 5)).rejects.toThrow(
        'Unknown database error saving an episode as a favorite',
      );
    });
  });

  describe('removeFavorite', () => {
    it('should remove episode from favorites', async () => {
      mockExecute.mockResolvedValueOnce([{} as ResultSetHeader]);

      await episodeModule.removeFavorite(123, 5);

      expect(mockExecute).toHaveBeenCalledWith(
        'DELETE FROM episode_watch_status WHERE profile_id = ? AND episode_id = ?',
        [123, 5],
      );
    });

    it('should throw error when removing favorite fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);

      await expect(episodeModule.removeFavorite(123, 5)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when removing favorite fails', async () => {
      mockExecute.mockRejectedValue({});

      await expect(episodeModule.removeFavorite(123, 5)).rejects.toThrow(
        'Unknown database error removing an episode as a favorite',
      );
    });
  });

  describe('getEpisodesForSeason', () => {
    it('should return episodes for season with watch count', async () => {
      const mockEpisodes = [
        {
          episode_id: 1,
          title: 'Episode 1',
          watch_status: 'WATCHED',
          watched_at: null,
          is_prior_watch: 0,
          watch_count: 2,
        },
        {
          episode_id: 2,
          title: 'Episode 2',
          watch_status: 'NOT_WATCHED',
          watched_at: null,
          is_prior_watch: 0,
          watch_count: 0,
        },
      ];

      mockExecute.mockResolvedValueOnce([mockEpisodes]);

      const episodes = await episodeModule.getEpisodesForSeason(123, 5);

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('episode_watch_history'), [123, 5]);
      expect(episodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 1, watchStatus: 'WATCHED', watchCount: 2 }),
          expect.objectContaining({ id: 2, watchStatus: 'NOT_WATCHED', watchCount: 0 }),
        ]),
      );
    });

    it('should throw error when getting episodes for season fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);

      await expect(episodeModule.getEpisodesForSeason(123, 5)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when getting episodes for season fails', async () => {
      mockExecute.mockRejectedValue({});

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

      mockExecute.mockResolvedValueOnce([mockUpcomingEpisodes]);

      const result = await episodeModule.getUpcomingEpisodesForProfile(123);

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * from profile_upcoming_episodes where profile_id = ? LIMIT 10',
        [123],
      );
      expect(result).toEqual(expectedEpisodes);
    });

    it('should return empty array when no upcoming episodes exist', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await episodeModule.getUpcomingEpisodesForProfile(123);

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * from profile_upcoming_episodes where profile_id = ? LIMIT 10',
        [123],
      );
      expect(result).toEqual([]);
    });

    it('should throw error when getting upcoming episodes fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);

      await expect(episodeModule.getUpcomingEpisodesForProfile(123)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when getting upcoming episodes fails', async () => {
      mockExecute.mockRejectedValue({});

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

      mockExecute.mockResolvedValueOnce([mockRecentEpisodes]);

      const result = await episodeModule.getRecentEpisodesForProfile(123);

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * from profile_recent_episodes where profile_id = ? ORDER BY air_date DESC LIMIT 10',
        [123],
      );
      expect(result).toEqual(expectedEpisodes);
    });

    it('should return empty array when no recent episodes exist', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await episodeModule.getRecentEpisodesForProfile(123);

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * from profile_recent_episodes where profile_id = ? ORDER BY air_date DESC LIMIT 10',
        [123],
      );
      expect(result).toEqual([]);
    });

    it('should throw error when getting recent episodes fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);

      await expect(episodeModule.getRecentEpisodesForProfile(123)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when getting recent episodes fails', async () => {
      mockExecute.mockRejectedValue({});

      await expect(episodeModule.getRecentEpisodesForProfile(123)).rejects.toThrow(
        'Unknown database error getting recent episodes for a profile',
      );
    });
  });

  describe('getCalendarEpisodesForProfile', () => {
    const profileId = 123;
    const startDate = '2025-04-01';
    const endDate = '2025-04-30';

    const mockCalendarRows = [
      {
        profile_id: 123,
        show_id: 42,
        show_name: 'Test Show',
        streaming_services: 'Netflix, Hulu',
        network: 'Netflix',
        episode_title: 'April Episode',
        air_date: '2025-04-10',
        runtime: 45,
        episode_number: 3,
        season_number: 2,
        episode_still_image: '/still/ep3.jpg',
      },
      {
        profile_id: 123,
        show_id: 55,
        show_name: 'Another Show',
        streaming_services: 'HBO Max',
        network: 'HBO',
        episode_title: 'Another April Episode',
        air_date: '2025-04-15',
        runtime: 60,
        episode_number: 1,
        season_number: 3,
        episode_still_image: '/still/ep1.jpg',
      },
    ] as RecentUpcomingEpisodeRow[];

    const expectedCalendarEpisodes = [
      {
        profileId: 123,
        showId: 42,
        showName: 'Test Show',
        streamingServices: 'Netflix, Hulu',
        network: 'Netflix',
        episodeTitle: 'April Episode',
        airDate: '2025-04-10',
        runtime: 45,
        episodeNumber: 3,
        seasonNumber: 2,
        episodeStillImage: '/still/ep3.jpg',
      },
      {
        profileId: 123,
        showId: 55,
        showName: 'Another Show',
        streamingServices: 'HBO Max',
        network: 'HBO',
        episodeTitle: 'Another April Episode',
        airDate: '2025-04-15',
        runtime: 60,
        episodeNumber: 1,
        seasonNumber: 3,
        episodeStillImage: '/still/ep1.jpg',
      },
    ];

    it('should return calendar episodes for the given date range', async () => {
      mockExecute.mockResolvedValueOnce([mockCalendarRows]);

      const result = await episodeModule.getCalendarEpisodesForProfile(profileId, startDate, endDate);

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('BETWEEN ? AND ?'), [
        profileId,
        startDate,
        endDate,
      ]);
      expect(result).toEqual(expectedCalendarEpisodes);
    });

    it('should query using the correct joins and ordering', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      await episodeModule.getCalendarEpisodesForProfile(profileId, startDate, endDate);

      const [calledQuery, calledParams] = mockExecute.mock.calls[0];
      expect(calledQuery).toContain('JOIN show_watch_status');
      expect(calledQuery).toContain('JOIN shows');
      expect(calledQuery).toContain('JOIN episodes');
      expect(calledQuery).toContain('JOIN show_services');
      expect(calledQuery).toContain('JOIN streaming_services');
      expect(calledQuery).toContain('GROUP BY');
      expect(calledQuery).toContain('ORDER BY e.air_date, s.title, e.season_number, e.episode_number');
      expect(calledParams).toEqual([profileId, startDate, endDate]);
    });

    it('should return an empty array when no episodes fall in the date range', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await episodeModule.getCalendarEpisodesForProfile(profileId, startDate, endDate);

      expect(result).toEqual([]);
    });

    it('should correctly transform all fields from the DB row', async () => {
      mockExecute.mockResolvedValueOnce([[mockCalendarRows[0]]]);

      const result = await episodeModule.getCalendarEpisodesForProfile(profileId, startDate, endDate);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expectedCalendarEpisodes[0]);
    });

    it('should throw a DatabaseError when the query fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);

      await expect(episodeModule.getCalendarEpisodesForProfile(profileId, startDate, endDate)).rejects.toThrow(
        'DB connection failed',
      );
    });

    it('should throw with default message when query fails without an error message', async () => {
      mockExecute.mockRejectedValue({});

      await expect(episodeModule.getCalendarEpisodesForProfile(profileId, startDate, endDate)).rejects.toThrow(
        'Unknown database error getting calendar episodes for a profile',
      );
    });
  });

  describe('deleteEpisodeById', () => {
    const episodeId = 789;

    it('should delete watch history, watch status, and episode in order', async () => {
      mockExecute.mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}]);

      await episodeModule.deleteEpisodeById(episodeId);

      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(mockExecute).toHaveBeenNthCalledWith(1, 'DELETE FROM episode_watch_history WHERE episode_id = ?', [
        episodeId,
      ]);
      expect(mockExecute).toHaveBeenNthCalledWith(2, 'DELETE FROM episode_watch_status WHERE episode_id = ?', [
        episodeId,
      ]);
      expect(mockExecute).toHaveBeenNthCalledWith(3, 'DELETE FROM episodes WHERE id = ?', [episodeId]);
    });

    it('should throw error when deletion fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);

      await expect(episodeModule.deleteEpisodeById(episodeId)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when deletion fails without error message', async () => {
      mockExecute.mockRejectedValue({});

      await expect(episodeModule.deleteEpisodeById(episodeId)).rejects.toThrow(
        `Unknown database error deleteEpisodeById(${episodeId})`,
      );
    });
  });
});
