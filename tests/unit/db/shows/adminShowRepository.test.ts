import * as adminShowRepository from '@db/shows/adminShowRepository';
import { NotFoundError } from '@middleware/errorMiddleware';
import { getDbPool } from '@utils/db';

jest.mock('@utils/db', () => ({
  getDbPool: jest.fn(),
}));

describe('adminShowRepository', () => {
  let mockPool: any;
  let mockExecute: jest.Mock;

  beforeEach(() => {
    mockExecute = jest.fn();
    mockPool = {
      execute: mockExecute,
    };
    (getDbPool as jest.Mock).mockReturnValue(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllShows', () => {
    it('should return all shows with default pagination', async () => {
      const mockShowRows = [
        {
          id: 1,
          tmdb_id: 12345,
          title: 'Test Show 1',
          description: 'Description 1',
          release_date: '2023-01-01',
          poster_image: '/poster1.jpg',
          backdrop_image: '/backdrop1.jpg',
          network: 'Netflix',
          season_count: 3,
          episode_count: 30,
          user_rating: 8.5,
          content_rating: 'TV-MA',
          status: 'Running',
          type: 'Scripted',
          in_production: 1,
          last_air_date: '2023-06-01',
          created_at: new Date('2023-01-01'),
          updated_at: new Date('2023-01-05'),
          genres: 'Action, Adventure',
          streaming_services: 'Netflix, Disney+',
        },
        {
          id: 2,
          tmdb_id: 67890,
          title: 'Test Show 2',
          description: 'Description 2',
          release_date: '2023-02-01',
          poster_image: '/poster2.jpg',
          backdrop_image: '/backdrop2.jpg',
          network: 'HBO',
          season_count: 2,
          episode_count: 16,
          user_rating: 7.5,
          content_rating: 'TV-14',
          status: 'Ended',
          type: 'Scripted',
          in_production: 0,
          last_air_date: '2023-05-15',
          created_at: new Date('2023-02-01'),
          updated_at: new Date('2023-02-05'),
          genres: 'Drama, Thriller',
          streaming_services: 'HBO Max',
        },
      ];

      (mockPool.execute as jest.Mock).mockResolvedValueOnce([mockShowRows]);

      const shows = await adminShowRepository.getAllShows();

      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(shows).toHaveLength(2);
      expect(shows[0].id).toBe(1);
      expect(shows[0].tmdbId).toBe(12345);
      expect(shows[0].title).toBe('Test Show 1');
      expect(shows[0].genres).toBe('Action, Adventure');
      expect(shows[0].streamingServices).toBe('Netflix, Disney+');
      expect(shows[0].lastUpdated).toBe(mockShowRows[0].updated_at.toISOString());
      expect(shows[0].inProduction).toBe(true);
    });

    it('should return shows with custom pagination', async () => {
      (mockPool.execute as jest.Mock).mockResolvedValueOnce([
        [
          {
            id: 3,
            tmdb_id: 11111,
            title: 'Test Show 3',
            description: 'Description 3',
            release_date: '2023-03-01',
            poster_image: '/poster3.jpg',
            backdrop_image: '/backdrop3.jpg',
            network: 'Prime',
            season_count: 1,
            episode_count: 8,
            user_rating: 9.0,
            content_rating: 'TV-MA',
            status: 'Running',
            type: 'Scripted',
            in_production: 1,
            last_air_date: '2023-06-15',
            created_at: new Date('2023-03-01'),
            updated_at: new Date('2023-03-05'),
            genres: 'Sci-Fi, Fantasy',
            streaming_services: 'Prime Video',
          },
        ],
      ]);

      const limit = 10;
      const offset = 20;
      const shows = await adminShowRepository.getAllShows(limit, offset);

      expect(mockPool.execute).toHaveBeenCalledWith(`SELECT * FROM admin_shows LIMIT ${limit} OFFSET ${offset}`);
      expect(shows).toHaveLength(1);
    });

    it('should throw DatabaseError when fetch fails', async () => {
      const dbError = new Error('Database connection failed');
      (mockPool.execute as jest.Mock).mockRejectedValueOnce(dbError);

      await expect(adminShowRepository.getAllShows()).rejects.toThrow(
        'Database error get all shows: Database connection failed',
      );
    });
  });

  describe('getShowsCount', () => {
    it('should return the total count of shows', async () => {
      (mockPool.execute as jest.Mock).mockResolvedValueOnce([[{ total: 42 }]]);

      const count = await adminShowRepository.getShowsCount();

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT COUNT(DISTINCT s.id) AS total FROM shows s');
      expect(count).toBe(42);
    });

    it('should throw DatabaseError when count fails', async () => {
      const dbError = new Error('Database connection failed');
      (mockPool.execute as jest.Mock).mockRejectedValueOnce(dbError);

      await expect(adminShowRepository.getShowsCount()).rejects.toThrow(
        'Database error get a count of all shows: Database connection failed',
      );
    });
  });

  describe('getAdminShowDetails', () => {
    const mockShowId = 123;
    const mockShowRow = {
      id: mockShowId,
      tmdb_id: 45678,
      title: 'Test Show',
      description: 'A test show description',
      release_date: '2023-01-01',
      poster_image: '/poster.jpg',
      backdrop_image: '/backdrop.jpg',
      network: 'Test Network',
      season_count: 3,
      episode_count: 30,
      user_rating: 8.5,
      content_rating: 'TV-14',
      status: 'Running',
      type: 'Scripted',
      in_production: 1,
      last_air_date: '2023-12-31',
      created_at: new Date('2023-01-01T00:00:00Z'),
      updated_at: new Date('2023-12-31T00:00:00Z'),
      genres: 'Drama, Action',
      streaming_services: 'Netflix, Amazon Prime',
    };

    it('should return show details when show exists', async () => {
      mockExecute.mockResolvedValue([[mockShowRow], []]);

      const result = await adminShowRepository.getAdminShowDetails(mockShowId);

      expect(mockExecute).toHaveBeenCalledWith(`SELECT * FROM admin_show_details WHERE id = ?`, [mockShowId]);
      expect(result).toEqual({
        id: mockShowId,
        tmdbId: 45678,
        title: 'Test Show',
        description: 'A test show description',
        releaseDate: '2023-01-01',
        posterImage: '/poster.jpg',
        backdropImage: '/backdrop.jpg',
        network: 'Test Network',
        seasonCount: 3,
        episodeCount: 30,
        userRating: 8.5,
        contentRating: 'TV-14',
        status: 'Running',
        type: 'Scripted',
        inProduction: true,
        lastAirDate: '2023-12-31',
        lastUpdated: mockShowRow.updated_at.toISOString(),
        streamingServices: 'Netflix, Amazon Prime',
        genres: 'Drama, Action',
      });
    });

    it('should throw NotFoundError when show does not exist', async () => {
      mockExecute.mockResolvedValue([[], []]);

      await expect(adminShowRepository.getAdminShowDetails(mockShowId)).rejects.toThrow(
        new NotFoundError(`Show with ID ${mockShowId} not found`),
      );
      expect(mockExecute).toHaveBeenCalledWith(`SELECT * FROM admin_show_details WHERE id = ?`, [mockShowId]);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockExecute.mockRejectedValue(error);

      await expect(adminShowRepository.getAdminShowDetails(mockShowId)).rejects.toThrow();
      expect(mockExecute).toHaveBeenCalledWith(`SELECT * FROM admin_show_details WHERE id = ?`, [mockShowId]);
    });
  });

  describe('getAdminShowSeasons', () => {
    const mockShowId = 123;
    const mockSeasonsRows = [
      {
        id: 1,
        show_id: 20,
        tmdb_id: 100001,
        name: 'Season 1',
        overview: 'First season overview',
        season_number: 1,
        release_date: '2023-01-01',
        poster_image: '/season1.jpg',
        number_of_episodes: 10,
        created_at: new Date('2023-01-01T00:00:00Z'),
        updated_at: new Date('2023-01-31T00:00:00Z'),
      },
      {
        id: 2,
        show_id: 20,
        tmdb_id: 100002,
        name: 'Season 2',
        overview: 'Second season overview',
        season_number: 2,
        release_date: '2023-06-01',
        poster_image: '/season2.jpg',
        number_of_episodes: 12,
        created_at: new Date('2023-06-01T00:00:00Z'),
        updated_at: new Date('2023-06-30T00:00:00Z'),
      },
    ];

    it('should return all seasons for a show', async () => {
      mockExecute.mockResolvedValue([mockSeasonsRows]);

      const result = await adminShowRepository.getAdminShowSeasons(mockShowId);

      expect(mockExecute).toHaveBeenCalledWith(`SELECT * FROM seasons WHERE show_id = ? ORDER BY season_number`, [
        mockShowId,
      ]);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        showId: 20,
        tmdbId: 100001,
        name: 'Season 1',
        overview: 'First season overview',
        seasonNumber: 1,
        releaseDate: '2023-01-01',
        posterImage: '/season1.jpg',
        numberOfEpisodes: 10,
        createdAt: mockSeasonsRows[0].created_at.toISOString(),
        updatedAt: mockSeasonsRows[0].updated_at.toISOString(),
      });
    });

    it('should return empty array when show has no seasons', async () => {
      mockExecute.mockResolvedValue([[], []]);

      const result = await adminShowRepository.getAdminShowSeasons(mockShowId);

      expect(mockExecute).toHaveBeenCalledWith(`SELECT * FROM seasons WHERE show_id = ? ORDER BY season_number`, [
        mockShowId,
      ]);
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockExecute.mockRejectedValue(error);

      await expect(adminShowRepository.getAdminShowSeasons(mockShowId)).rejects.toThrow();
      expect(mockExecute).toHaveBeenCalledWith(`SELECT * FROM seasons WHERE show_id = ? ORDER BY season_number`, [
        mockShowId,
      ]);
    });
  });

  describe('getAdminShowSeasonsWithEpisodes', () => {
    const mockShowId = 123;
    const mockSeasonsRows = [
      {
        id: 1,
        show_id: 20,
        tmdb_id: 100001,
        name: 'Season 1',
        overview: 'First season overview',
        season_number: 1,
        release_date: '2023-01-01',
        poster_image: '/season1.jpg',
        number_of_episodes: 10,
        created_at: new Date('2023-01-01T00:00:00Z'),
        updated_at: new Date('2023-01-31T00:00:00Z'),
      },
      {
        id: 2,
        show_id: 20,
        tmdb_id: 100002,
        name: 'Season 2',
        overview: 'Second season overview',
        season_number: 2,
        release_date: '2023-06-01',
        poster_image: '/season2.jpg',
        number_of_episodes: 12,
        created_at: new Date('2023-06-01T00:00:00Z'),
        updated_at: new Date('2023-06-30T00:00:00Z'),
      },
    ];

    const mockEpisodesRows = [
      {
        id: 101,
        tmdb_id: 200001,
        season_id: 1,
        episode_number: 1,
        episode_type: 'standard',
        season_number: 1,
        title: 'Pilot',
        overview: 'First episode',
        air_date: '2023-01-01',
        runtime: 45,
        still_image: '/ep1.jpg',
        created_at: new Date('2023-01-01T00:00:00Z'),
        updated_at: new Date('2023-01-01T00:00:00Z'),
      },
      {
        id: 102,
        tmdb_id: 200002,
        season_id: 1,
        episode_number: 2,
        episode_type: 'standard',
        season_number: 1,
        title: 'Episode 2',
        overview: 'Second episode',
        air_date: '2023-01-08',
        runtime: 42,
        still_image: '/ep2.jpg',
        created_at: new Date('2023-01-08T00:00:00Z'),
        updated_at: new Date('2023-01-08T00:00:00Z'),
      },
      {
        id: 201,
        tmdb_id: 200003,
        season_id: 2,
        episode_number: 1,
        episode_type: 'standard',
        season_number: 2,
        title: 'Season 2 Premiere',
        overview: 'Season 2 starts',
        air_date: '2023-06-01',
        runtime: 48,
        still_image: '/s2ep1.jpg',
        created_at: new Date('2023-06-01T00:00:00Z'),
        updated_at: new Date('2023-06-01T00:00:00Z'),
      },
    ];

    it('should return all seasons with their episodes', async () => {
      mockExecute.mockResolvedValueOnce([mockSeasonsRows]);
      mockExecute.mockResolvedValueOnce([mockEpisodesRows]);

      const result = await adminShowRepository.getAdminShowSeasonsWithEpisodes(mockShowId);

      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        showId: 20,
        tmdbId: 100001,
        name: 'Season 1',
        overview: 'First season overview',
        seasonNumber: 1,
        releaseDate: '2023-01-01',
        posterImage: '/season1.jpg',
        numberOfEpisodes: 10,
        createdAt: mockSeasonsRows[0].created_at.toISOString(),
        updatedAt: mockSeasonsRows[0].updated_at.toISOString(),
        episodes: [
          {
            id: 101,
            tmdbId: 200001,
            seasonId: 1,
            episodeNumber: 1,
            episodeType: 'standard',
            seasonNumber: 1,
            title: 'Pilot',
            overview: 'First episode',
            airDate: '2023-01-01',
            runtime: 45,
            stillImage: '/ep1.jpg',
            createdAt: mockEpisodesRows[0].created_at.toISOString(),
            updatedAt: mockEpisodesRows[0].updated_at.toISOString(),
          },
          {
            id: 102,
            tmdbId: 200002,
            seasonId: 1,
            episodeNumber: 2,
            episodeType: 'standard',
            seasonNumber: 1,
            title: 'Episode 2',
            overview: 'Second episode',
            airDate: '2023-01-08',
            runtime: 42,
            stillImage: '/ep2.jpg',
            createdAt: mockEpisodesRows[1].created_at.toISOString(),
            updatedAt: mockEpisodesRows[1].updated_at.toISOString(),
          },
        ],
      });
      expect(result[1]).toEqual({
        id: 2,
        showId: 20,
        tmdbId: 100002,
        name: 'Season 2',
        overview: 'Second season overview',
        seasonNumber: 2,
        releaseDate: '2023-06-01',
        posterImage: '/season2.jpg',
        numberOfEpisodes: 12,
        createdAt: mockSeasonsRows[1].created_at.toISOString(),
        updatedAt: mockSeasonsRows[1].updated_at.toISOString(),
        episodes: [
          {
            id: 201,
            tmdbId: 200003,
            seasonId: 2,
            episodeNumber: 1,
            episodeType: 'standard',
            seasonNumber: 2,
            title: 'Season 2 Premiere',
            overview: 'Season 2 starts',
            airDate: '2023-06-01',
            runtime: 48,
            stillImage: '/s2ep1.jpg',
            createdAt: mockEpisodesRows[2].created_at.toISOString(),
            updatedAt: mockEpisodesRows[2].updated_at.toISOString(),
          },
        ],
      });
    });

    it('should return empty array when show has no seasons', async () => {
      mockExecute.mockResolvedValueOnce([[], []]);

      const result = await adminShowRepository.getAdminShowSeasonsWithEpisodes(mockShowId);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it('should handle a season with no episodes', async () => {
      // Mock the first query to return seasons
      mockExecute.mockResolvedValueOnce([mockSeasonsRows, []]);

      // Mock the second query to return no episodes
      mockExecute.mockResolvedValueOnce([[], []]);

      const result = await adminShowRepository.getAdminShowSeasonsWithEpisodes(mockShowId);

      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);

      // Check that seasons have empty episodes arrays
      expect(result[0].episodes).toEqual([]);
      expect(result[1].episodes).toEqual([]);
    });

    it('should handle database errors during seasons query', async () => {
      const error = new Error('Database error');
      mockExecute.mockRejectedValueOnce(error);

      await expect(adminShowRepository.getAdminShowSeasonsWithEpisodes(mockShowId)).rejects.toThrow();
      expect(mockExecute).toHaveBeenCalledWith(expect.any(String), [mockShowId]);
    });

    it('should handle database errors during episodes query', async () => {
      // Mock the first query to return seasons
      mockExecute.mockResolvedValueOnce([mockSeasonsRows, []]);

      // Mock the second query to throw an error
      const error = new Error('Database error');
      mockExecute.mockRejectedValueOnce(error);

      await expect(adminShowRepository.getAdminShowSeasonsWithEpisodes(mockShowId)).rejects.toThrow();
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAdminSeasonEpisodes', () => {
    const mockSeasonId = 1;
    const mockEpisodesRows = [
      {
        id: 101,
        tmdb_id: 200001,
        season_id: mockSeasonId,
        show_id: 123,
        episode_number: 1,
        episode_type: 'standard',
        season_number: 1,
        title: 'Pilot',
        overview: 'First episode',
        air_date: '2023-01-01',
        runtime: 45,
        still_image: '/ep1.jpg',
        created_at: new Date('2023-01-01T00:00:00Z'),
        updated_at: new Date('2023-01-01T00:00:00Z'),
      },
      {
        id: 102,
        tmdb_id: 200002,
        season_id: mockSeasonId,
        show_id: 123,
        episode_number: 2,
        episode_type: 'standard',
        season_number: 1,
        title: 'Episode 2',
        overview: 'Second episode',
        air_date: '2023-01-08',
        runtime: 42,
        still_image: '/ep2.jpg',
        created_at: new Date('2023-01-08T00:00:00Z'),
        updated_at: new Date('2023-01-08T00:00:00Z'),
      },
    ];

    it('should return all episodes for a season', async () => {
      mockExecute.mockResolvedValue([mockEpisodesRows, []]);

      const result = await adminShowRepository.getAdminSeasonEpisodes(mockSeasonId);

      expect(mockExecute).toHaveBeenCalledWith(`SELECT * FROM episodes WHERE season_id = ? ORDER BY episode_number`, [
        mockSeasonId,
      ]);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 101,
        tmdbId: 200001,
        seasonId: mockSeasonId,
        showId: 123,
        episodeNumber: 1,
        episodeType: 'standard',
        seasonNumber: 1,
        title: 'Pilot',
        overview: 'First episode',
        airDate: '2023-01-01',
        runtime: 45,
        stillImage: '/ep1.jpg',
        createdAt: mockEpisodesRows[0].created_at.toISOString(),
        updatedAt: mockEpisodesRows[0].updated_at.toISOString(),
      });
    });

    it('should return empty array when season has no episodes', async () => {
      mockExecute.mockResolvedValue([[], []]);

      const result = await adminShowRepository.getAdminSeasonEpisodes(mockSeasonId);

      expect(mockExecute).toHaveBeenCalledWith(`SELECT * FROM episodes WHERE season_id = ? ORDER BY episode_number`, [
        mockSeasonId,
      ]);
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockExecute.mockRejectedValue(error);

      await expect(adminShowRepository.getAdminSeasonEpisodes(mockSeasonId)).rejects.toThrow();
      expect(mockExecute).toHaveBeenCalledWith(`SELECT * FROM episodes WHERE season_id = ? ORDER BY episode_number`, [
        mockSeasonId,
      ]);
    });
  });

  describe('getAdminShowProfiles', () => {
    const mockShowId = 123;
    const mockProfilesRows = [
      {
        profile_id: 1001,
        name: 'User 1',
        image: '/profile1.jpg',
        account_id: 501,
        account_name: 'Account 1',
        watch_status: 'WATCHING',
        added_date: new Date('2023-01-15T00:00:00Z'),
        status_updated_date: new Date('2023-02-01T00:00:00Z'),
      },
      {
        profile_id: 1002,
        name: 'User 2',
        image: '/profile2.jpg',
        account_id: 502,
        account_name: 'Account 2',
        watch_status: 'WATCHED',
        added_date: new Date('2023-01-20T00:00:00Z'),
        status_updated_date: new Date('2023-02-15T00:00:00Z'),
      },
    ];

    it('should return all profiles watching a show', async () => {
      mockExecute.mockResolvedValue([mockProfilesRows, []]);

      const result = await adminShowRepository.getAdminShowProfiles(mockShowId);

      expect(mockExecute).toHaveBeenCalledWith(`SELECT * FROM admin_show_profiles WHERE show_id = ?`, [mockShowId]);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        profileId: 1001,
        name: 'User 1',
        image: '/profile1.jpg',
        accountId: 501,
        accountName: 'Account 1',
        watchStatus: 'WATCHING',
        addedDate: mockProfilesRows[0].added_date.toISOString(),
        lastUpdated: mockProfilesRows[0].status_updated_date.toISOString(),
      });
    });

    it('should return empty array when no profiles are watching the show', async () => {
      mockExecute.mockResolvedValue([[], []]);

      const result = await adminShowRepository.getAdminShowProfiles(mockShowId);

      expect(mockExecute).toHaveBeenCalledWith(`SELECT * FROM admin_show_profiles WHERE show_id = ?`, [mockShowId]);
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockExecute.mockRejectedValue(error);

      await expect(adminShowRepository.getAdminShowProfiles(mockShowId)).rejects.toThrow();
      expect(mockExecute).toHaveBeenCalledWith(`SELECT * FROM admin_show_profiles WHERE show_id = ?`, [mockShowId]);
    });
  });

  describe('getAdminShowWatchProgress', () => {
    const mockShowId = 123;
    const mockProfilesRows = [
      {
        profile_id: 1001,
        name: 'User 1',
        show_status: 'WATCHING',
      },
      {
        profile_id: 1002,
        name: 'User 2',
        show_status: 'WATCHED',
      },
    ];

    const mockSeasonsRows = [
      [
        {
          season_id: 1,
          name: 'Season 1',
          season_number: 1,
          number_of_episodes: 10,
          season_status: 'WATCHED',
          watched_episodes: 10,
        },
        {
          season_id: 2,
          name: 'Season 2',
          season_number: 2,
          number_of_episodes: 12,
          season_status: 'WATCHING',
          watched_episodes: 5,
        },
      ],
      [
        {
          season_id: 1,
          name: 'Season 1',
          season_number: 1,
          number_of_episodes: 10,
          season_status: 'WATCHED',
          watched_episodes: 10,
        },
        {
          season_id: 2,
          name: 'Season 2',
          season_number: 2,
          number_of_episodes: 12,
          season_status: 'WATCHED',
          watched_episodes: 12,
        },
      ],
    ];

    it('should return watch progress for all profiles', async () => {
      mockExecute
        .mockResolvedValueOnce([mockProfilesRows, []])
        .mockResolvedValueOnce([mockSeasonsRows[0], []])
        .mockResolvedValueOnce([mockSeasonsRows[1], []]);

      const result = await adminShowRepository.getAdminShowWatchProgress(mockShowId);

      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(2);

      // Check first profile's data
      expect(result[0]).toEqual({
        profileId: 1001,
        name: 'User 1',
        showStatus: 'WATCHING',
        totalEpisodes: 22,
        watchedEpisodes: 15,
        percentComplete: 68, // (15/22) * 100 = 68.18... rounded to 68
        seasons: [
          {
            seasonId: 1,
            seasonNumber: 1,
            name: 'Season 1',
            status: 'WATCHED',
            episodeCount: 10,
            watchedEpisodes: 10,
            percentComplete: 100,
          },
          {
            seasonId: 2,
            seasonNumber: 2,
            name: 'Season 2',
            status: 'WATCHING',
            episodeCount: 12,
            watchedEpisodes: 5,
            percentComplete: 42, // (5/12) * 100 = 41.67... rounded to 42
          },
        ],
      });

      // Check second profile's data
      expect(result[1]).toEqual({
        profileId: 1002,
        name: 'User 2',
        showStatus: 'WATCHED',
        totalEpisodes: 22,
        watchedEpisodes: 22,
        percentComplete: 100,
        seasons: [
          {
            seasonId: 1,
            seasonNumber: 1,
            name: 'Season 1',
            status: 'WATCHED',
            episodeCount: 10,
            watchedEpisodes: 10,
            percentComplete: 100,
          },
          {
            seasonId: 2,
            seasonNumber: 2,
            name: 'Season 2',
            status: 'WATCHED',
            episodeCount: 12,
            watchedEpisodes: 12,
            percentComplete: 100,
          },
        ],
      });
    });

    it('should return empty array when no profiles are watching the show', async () => {
      mockExecute.mockResolvedValueOnce([[], []]);

      const result = await adminShowRepository.getAdminShowWatchProgress(mockShowId);

      expect(mockExecute).toHaveBeenCalledWith(expect.any(String), [mockShowId]);
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockExecute.mockRejectedValue(error);

      await expect(adminShowRepository.getAdminShowWatchProgress(mockShowId)).rejects.toThrow();
      expect(mockExecute).toHaveBeenCalledWith(expect.any(String), [mockShowId]);
    });
  });
});
