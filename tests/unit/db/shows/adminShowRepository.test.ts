import { setupDatabaseTest } from '../helpers/dbTestSetup';
import * as adminShowRepository from '@db/shows/adminShowRepository';
import { NotFoundError } from '@middleware/errorMiddleware';

describe('adminShowRepository', () => {
  let mockExecute: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup all database mocks using the helper
    const mocks = setupDatabaseTest();
    mockExecute = mocks.mockExecute;
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

      mockExecute.mockResolvedValueOnce([mockShowRows]);

      const shows = await adminShowRepository.getAllShows();

      expect(mockExecute).toHaveBeenCalledTimes(1);
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
      mockExecute.mockResolvedValueOnce([
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

      expect(mockExecute).toHaveBeenCalledWith(`SELECT * FROM admin_shows LIMIT ${limit} OFFSET ${offset}`);
      expect(shows).toHaveLength(1);
    });

    it('should throw DatabaseError when fetch fails', async () => {
      const dbError = new Error('Database connection failed');
      mockExecute.mockRejectedValueOnce(dbError);

      await expect(adminShowRepository.getAllShows()).rejects.toThrow(
        'Database error get all shows: Database connection failed',
      );
    });
  });

  describe('getShowsCount', () => {
    it('should return the total count of shows', async () => {
      mockExecute.mockResolvedValueOnce([[{ total: 42 }]]);

      const count = await adminShowRepository.getShowsCount();

      expect(mockExecute).toHaveBeenCalledWith('SELECT COUNT(DISTINCT s.id) AS total FROM shows s');
      expect(count).toBe(42);
    });

    it('should throw DatabaseError when count fails', async () => {
      const dbError = new Error('Database connection failed');
      mockExecute.mockRejectedValueOnce(dbError);

      await expect(adminShowRepository.getShowsCount()).rejects.toThrow(
        'Database error get a count of all shows: Database connection failed',
      );
    });
  });

  describe('getShowsCountByProfile', () => {
    const profileId = 5;

    it('should return the count of shows for a specific profile', async () => {
      mockExecute.mockResolvedValueOnce([[{ total: 25 }]]);

      const count = await adminShowRepository.getShowsCountByProfile(profileId);

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT COUNT(DISTINCT s.show_id) AS total FROM profile_shows s WHERE s.profile_id = ?',
        [profileId],
      );
      expect(count).toBe(25);
    });

    it('should throw DatabaseError when query fails', async () => {
      const dbError = new Error('Query execution failed');
      mockExecute.mockRejectedValueOnce(dbError);

      await expect(adminShowRepository.getShowsCountByProfile(profileId)).rejects.toThrow(
        'Database error getting a count of shows for a profile: Query execution failed',
      );
    });
  });

  describe('getShowFilterOptions', () => {
    it('should return all filter options', async () => {
      mockExecute
        .mockResolvedValueOnce([[{ value: 'Reality' }, { value: 'Scripted' }]])
        .mockResolvedValueOnce([[{ value: 'Ended' }, { value: 'Running' }]])
        .mockResolvedValueOnce([[{ value: 'HBO' }, { value: 'Netflix' }]])
        .mockResolvedValueOnce([[{ value: 'HBO Max' }, { value: 'Netflix' }]]);

      const options = await adminShowRepository.getShowFilterOptions();

      expect(mockExecute).toHaveBeenCalledTimes(4);
      expect(options.types).toEqual(['Reality', 'Scripted']);
      expect(options.statuses).toEqual(['Ended', 'Running']);
      expect(options.networks).toEqual(['HBO', 'Netflix']);
      expect(options.streamingServices).toEqual(['HBO Max', 'Netflix']);
    });

    it('should filter out null type, status, and network values', async () => {
      mockExecute
        .mockResolvedValueOnce([[{ value: 'Scripted' }, { value: null }]])
        .mockResolvedValueOnce([[{ value: 'Running' }, { value: null }]])
        .mockResolvedValueOnce([[{ value: 'HBO' }, { value: null }]])
        .mockResolvedValueOnce([[{ value: 'Netflix' }]]);

      const options = await adminShowRepository.getShowFilterOptions();

      expect(options.types).toEqual(['Scripted']);
      expect(options.statuses).toEqual(['Running']);
      expect(options.networks).toEqual(['HBO']);
    });

    it('should filter out null and empty streaming service values', async () => {
      mockExecute
        .mockResolvedValueOnce([[{ value: 'Scripted' }]])
        .mockResolvedValueOnce([[{ value: 'Running' }]])
        .mockResolvedValueOnce([[{ value: 'HBO' }]])
        .mockResolvedValueOnce([[{ value: 'Netflix' }, { value: null }, { value: '' }]]);

      const options = await adminShowRepository.getShowFilterOptions();

      expect(options.streamingServices).toEqual(['Netflix']);
    });

    it('should return empty arrays when no data exists', async () => {
      mockExecute
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      const options = await adminShowRepository.getShowFilterOptions();

      expect(options.types).toEqual([]);
      expect(options.statuses).toEqual([]);
      expect(options.networks).toEqual([]);
      expect(options.streamingServices).toEqual([]);
    });

    it('should throw DatabaseError when query fails', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(adminShowRepository.getShowFilterOptions()).rejects.toThrow(
        'Database error get show filter options: Connection failed',
      );
    });
  });

  describe('getShowsCountFiltered', () => {
    it('should return count with no filters', async () => {
      mockExecute.mockResolvedValueOnce([[{ total: 200 }]]);

      const count = await adminShowRepository.getShowsCountFiltered({});

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('FROM admin_shows'), []);
      expect(count).toBe(200);
    });

    it('should apply type filter', async () => {
      mockExecute.mockResolvedValueOnce([[{ total: 50 }]]);

      const count = await adminShowRepository.getShowsCountFiltered({ type: 'Scripted' });

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('WHERE type = ?'), ['Scripted']);
      expect(count).toBe(50);
    });

    it('should apply status filter', async () => {
      mockExecute.mockResolvedValueOnce([[{ total: 75 }]]);

      const count = await adminShowRepository.getShowsCountFiltered({ status: 'Running' });

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('WHERE status = ?'), ['Running']);
      expect(count).toBe(75);
    });

    it('should apply network filter', async () => {
      mockExecute.mockResolvedValueOnce([[{ total: 30 }]]);

      const count = await adminShowRepository.getShowsCountFiltered({ network: 'HBO' });

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('WHERE network = ?'), ['HBO']);
      expect(count).toBe(30);
    });

    it('should apply streaming service filter with LIKE param', async () => {
      mockExecute.mockResolvedValueOnce([[{ total: 40 }]]);

      const count = await adminShowRepository.getShowsCountFiltered({ streamingService: 'Netflix' });

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('WHERE streaming_services LIKE ?'),
        ['%Netflix%'],
      );
      expect(count).toBe(40);
    });

    it('should combine all four filters with AND', async () => {
      mockExecute.mockResolvedValueOnce([[{ total: 3 }]]);

      const count = await adminShowRepository.getShowsCountFiltered({
        type: 'Scripted',
        status: 'Running',
        network: 'HBO',
        streamingService: 'HBO Max',
      });

      const callArgs = mockExecute.mock.calls[0];
      expect(callArgs[0]).toContain('AND');
      expect(callArgs[1]).toEqual(['Scripted', 'Running', 'HBO', '%HBO Max%']);
      expect(count).toBe(3);
    });

    it('should throw DatabaseError when query fails', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Query failed'));

      await expect(adminShowRepository.getShowsCountFiltered({})).rejects.toThrow(
        'Database error get filtered shows count: Query failed',
      );
    });
  });

  describe('getAllShowsFiltered', () => {
    const mockShowRow = {
      id: 1,
      tmdb_id: 12345,
      title: 'Filtered Show',
      description: 'A filtered show',
      release_date: '2023-01-01',
      poster_image: '/poster.jpg',
      backdrop_image: '/backdrop.jpg',
      network: 'Netflix',
      season_count: 2,
      episode_count: 16,
      user_rating: 8.5,
      content_rating: 'TV-MA',
      status: 'Running',
      type: 'Scripted',
      in_production: 1,
      last_air_date: '2023-12-01',
      created_at: new Date('2023-01-01'),
      updated_at: new Date('2023-06-01'),
      genres: 'Drama',
      streaming_services: 'Netflix',
    };

    it('should return all shows with no filters and default pagination', async () => {
      mockExecute.mockResolvedValueOnce([[mockShowRow]]);

      const shows = await adminShowRepository.getAllShowsFiltered({});

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('FROM admin_shows'), []);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('LIMIT 50'), []);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('OFFSET 0'), []);
      expect(shows).toHaveLength(1);
      expect(shows[0].id).toBe(1);
    });

    it('should apply type filter', async () => {
      mockExecute.mockResolvedValueOnce([[mockShowRow]]);

      await adminShowRepository.getAllShowsFiltered({ type: 'Scripted' });

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('WHERE type = ?'), ['Scripted']);
    });

    it('should apply status filter', async () => {
      mockExecute.mockResolvedValueOnce([[mockShowRow]]);

      await adminShowRepository.getAllShowsFiltered({ status: 'Ended' });

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('WHERE status = ?'), ['Ended']);
    });

    it('should apply network filter', async () => {
      mockExecute.mockResolvedValueOnce([[mockShowRow]]);

      await adminShowRepository.getAllShowsFiltered({ network: 'HBO' });

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('WHERE network = ?'), ['HBO']);
    });

    it('should apply streaming service filter with custom pagination', async () => {
      mockExecute.mockResolvedValueOnce([[mockShowRow]]);

      await adminShowRepository.getAllShowsFiltered({ streamingService: 'Netflix' }, 10, 20);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('streaming_services LIKE ?'),
        ['%Netflix%'],
      );
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('LIMIT 10'), expect.any(Array));
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('OFFSET 20'), expect.any(Array));
    });

    it('should combine all four filters with AND', async () => {
      mockExecute.mockResolvedValueOnce([[mockShowRow]]);

      await adminShowRepository.getAllShowsFiltered({
        type: 'Scripted',
        status: 'Running',
        network: 'HBO',
        streamingService: 'HBO Max',
      });

      const callArgs = mockExecute.mock.calls[0];
      expect(callArgs[0]).toContain('AND');
      expect(callArgs[1]).toEqual(['Scripted', 'Running', 'HBO', '%HBO Max%']);
    });

    it('should return empty array when no shows match filters', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const shows = await adminShowRepository.getAllShowsFiltered({ network: 'Unknown Network' });

      expect(shows).toEqual([]);
    });

    it('should correctly transform show rows', async () => {
      mockExecute.mockResolvedValueOnce([[mockShowRow]]);

      const shows = await adminShowRepository.getAllShowsFiltered({});

      expect(shows[0]).toMatchObject({
        id: 1,
        tmdbId: 12345,
        title: 'Filtered Show',
        network: 'Netflix',
        status: 'Running',
        type: 'Scripted',
        inProduction: true,
        lastUpdated: mockShowRow.updated_at.toISOString(),
      });
    });

    it('should throw DatabaseError when query fails', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Query failed'));

      await expect(adminShowRepository.getAllShowsFiltered({})).rejects.toThrow(
        'Database error get filtered shows: Query failed',
      );
    });
  });

  describe('getAllShowsByProfile', () => {
    const profileId = 7;

    it('should return all shows for a profile with default pagination', async () => {
      const mockShowRows = [
        {
          id: 10,
          tmdb_id: 99999,
          title: 'Profile Show 1',
          description: 'Description 1',
          release_date: '2023-05-01',
          poster_image: '/poster10.jpg',
          backdrop_image: '/backdrop10.jpg',
          network: 'HBO',
          season_count: 2,
          episode_count: 16,
          user_rating: 8.1,
          content_rating: 'TV-MA',
          status: 'Running',
          type: 'Scripted',
          in_production: 1,
          last_air_date: '2023-08-01',
          created_at: new Date('2023-05-01'),
          updated_at: new Date('2023-05-05'),
          genres: 'Fantasy',
          streaming_services: 'HBO Max',
        },
      ];

      mockExecute.mockResolvedValueOnce([mockShowRows]);

      const shows = await adminShowRepository.getAllShowsByProfile(profileId);

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM admin_profile_shows WHERE profile_id = ? ORDER BY title asc LIMIT 50 OFFSET 0',
        [profileId],
      );
      expect(shows).toHaveLength(1);
      expect(shows[0].id).toBe(10);
      expect(shows[0].title).toBe('Profile Show 1');
    });

    it('should return shows for a profile with custom pagination', async () => {
      const mockShowRows = [
        {
          id: 11,
          tmdb_id: 88888,
          title: 'Profile Show 2',
          description: 'Description 2',
          release_date: '2023-06-01',
          poster_image: '/poster11.jpg',
          backdrop_image: '/backdrop11.jpg',
          network: 'Netflix',
          season_count: 1,
          episode_count: 8,
          user_rating: 8.5,
          content_rating: 'TV-14',
          status: 'Ended',
          type: 'Scripted',
          in_production: 0,
          last_air_date: '2023-06-30',
          created_at: new Date('2023-06-01'),
          updated_at: new Date('2023-06-05'),
          genres: 'Comedy',
          streaming_services: 'Netflix',
        },
      ];

      mockExecute.mockResolvedValueOnce([mockShowRows]);

      const limit = 25;
      const offset = 10;
      const shows = await adminShowRepository.getAllShowsByProfile(profileId, limit, offset);

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining(`LIMIT ${limit}`), [profileId]);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining(`OFFSET ${offset}`), [profileId]);
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY title asc'), [profileId]);
      expect(shows).toHaveLength(1);
    });

    it('should throw DatabaseError when fetch fails', async () => {
      const dbError = new Error('Connection timeout');
      mockExecute.mockRejectedValueOnce(dbError);

      await expect(adminShowRepository.getAllShowsByProfile(profileId)).rejects.toThrow(
        'Database error get all shows for a profile: Connection timeout',
      );
    });
  });

  describe('getAllShowReferences', () => {
    it('should return all show references', async () => {
      const mockReferenceRows = [
        {
          id: 1,
          tmdb_id: 11111,
          title: 'Show One',
          release_date: '2023-01-01',
        },
        {
          id: 2,
          tmdb_id: 22222,
          title: 'Show Two',
          release_date: '2023-02-15',
        },
        {
          id: 3,
          tmdb_id: 33333,
          title: 'Show Three',
          release_date: '2023-05-20',
        },
      ];

      mockExecute.mockResolvedValueOnce([mockReferenceRows]);

      const references = await adminShowRepository.getAllShowReferences();

      expect(mockExecute).toHaveBeenCalledWith('SELECT id, tmdb_id, title, release_date FROM shows');
      expect(references).toHaveLength(3);
      expect(references[0]).toEqual({
        id: 1,
        tmdbId: 11111,
        title: 'Show One',
        releaseDate: '2023-01-01',
      });
      expect(references[1].title).toBe('Show Two');
      expect(references[2].tmdbId).toBe(33333);
    });

    it('should return empty array when no shows exist', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const references = await adminShowRepository.getAllShowReferences();

      expect(mockExecute).toHaveBeenCalledWith('SELECT id, tmdb_id, title, release_date FROM shows');
      expect(references).toEqual([]);
    });

    it('should throw DatabaseError when query fails', async () => {
      const dbError = new Error('Database unavailable');
      mockExecute.mockRejectedValueOnce(dbError);

      await expect(adminShowRepository.getAllShowReferences()).rejects.toThrow(
        'Database error get all show references: Database unavailable',
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

  describe('getDuplicateEpisodesForShow', () => {
    const mockShowId = 10;
    const mockEpisodeRows = [
      {
        id: 101,
        tmdb_id: 200001,
        season_id: 1,
        show_id: mockShowId,
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
        id: 105,
        tmdb_id: 200005,
        season_id: 1,
        show_id: mockShowId,
        episode_number: 1,
        episode_type: 'standard',
        season_number: 1,
        title: 'Pilot (Duplicate)',
        overview: 'Duplicate first episode',
        air_date: '2023-01-01',
        runtime: 45,
        still_image: '/ep1dup.jpg',
        created_at: new Date('2023-01-02T00:00:00Z'),
        updated_at: new Date('2023-01-02T00:00:00Z'),
      },
    ];

    it('should return all duplicate episodes for a show', async () => {
      mockExecute.mockResolvedValue([mockEpisodeRows]);

      const result = await adminShowRepository.getDuplicateEpisodesForShow(mockShowId);

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('HAVING COUNT(*) > 1'), [
        mockShowId,
        mockShowId,
      ]);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(101);
      expect(result[0].episodeNumber).toBe(1);
      expect(result[0].seasonNumber).toBe(1);
      expect(result[1].id).toBe(105);
      expect(result[1].episodeNumber).toBe(1);
    });

    it('should return empty array when no duplicates exist', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await adminShowRepository.getDuplicateEpisodesForShow(mockShowId);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError when query fails', async () => {
      const dbError = new Error('Query failed');
      mockExecute.mockRejectedValue(dbError);

      await expect(adminShowRepository.getDuplicateEpisodesForShow(mockShowId)).rejects.toThrow('Query failed');
    });
  });

  describe('getShowsWithDuplicateEpisodes', () => {
    const mockRows = [
      {
        id: 1,
        title: 'Show A',
        poster_image: '/poster_a.jpg',
        duplicate_group_count: 3,
        extra_episode_count: 3,
      },
      {
        id: 2,
        title: 'Show B',
        poster_image: '/poster_b.jpg',
        duplicate_group_count: 1,
        extra_episode_count: 1,
      },
    ];

    it('should return shows with duplicate episodes ordered by group count', async () => {
      mockExecute.mockResolvedValue([mockRows]);

      const result = await adminShowRepository.getShowsWithDuplicateEpisodes();

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('HAVING COUNT(*) > 1'));
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        title: 'Show A',
        posterImage: '/poster_a.jpg',
        duplicateGroupCount: 3,
        extraEpisodeCount: 3,
      });
      expect(result[1]).toEqual({
        id: 2,
        title: 'Show B',
        posterImage: '/poster_b.jpg',
        duplicateGroupCount: 1,
        extraEpisodeCount: 1,
      });
    });

    it('should return empty array when no shows have duplicates', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await adminShowRepository.getShowsWithDuplicateEpisodes();

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError when query fails', async () => {
      const dbError = new Error('Query failed');
      mockExecute.mockRejectedValue(dbError);

      await expect(adminShowRepository.getShowsWithDuplicateEpisodes()).rejects.toThrow('Query failed');
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

    it('should calculate percentComplete as 0 when a profile has no episode data', async () => {
      mockExecute
        .mockResolvedValueOnce([[{ profile_id: 1001, name: 'User 1', show_status: 'NOT_STARTED' }], []])
        .mockResolvedValueOnce([[], []]);

      const result = await adminShowRepository.getAdminShowWatchProgress(mockShowId);

      expect(result).toHaveLength(1);
      expect(result[0].totalEpisodes).toBe(0);
      expect(result[0].watchedEpisodes).toBe(0);
      expect(result[0].percentComplete).toBe(0);
      expect(result[0].seasons).toEqual([]);
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
