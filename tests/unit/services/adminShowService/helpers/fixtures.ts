/**
 * Shared mock data and fixtures for adminShowService tests
 */

export const mockShowId = 123;
export const mockSeasonId = 456;
export const mockTmdbId = 999;

export const mockShowDetails = { id: mockShowId, title: 'Test Show', tmdbId: mockTmdbId };

export const mockSeasons = [{ id: mockSeasonId, name: 'Season 1', seasonNumber: 1 }];

export const mockEpisodes = [{ id: 789, title: 'Episode 1', episodeNumber: 1 }];

export const mockProfiles = [{ profileId: 101, name: 'Test User', watchStatus: 'WATCHING' }];

export const mockWatchProgress = [
  {
    profileId: 101,
    name: 'Test User',
    totalEpisodes: 10,
    watchedEpisodes: 5,
    percentComplete: 50,
  },
];

export const mockShows = [
  { id: 1, title: 'Show 1', releaseDate: '2023-01-01', genres: 'Action, Drama', tmdbId: 1001 },
  { id: 2, title: 'Show 2', releaseDate: '2023-02-01', genres: 'Comedy, Romance', tmdbId: 1002 },
];

export const mockShowReferences = [
  { id: 1, tmdbId: 1001, title: 'Show 1', releaseDate: '2023-01-01' },
  { id: 2, tmdbId: 1002, title: 'Show 2', releaseDate: '2023-02-01' },
];

export const mockTMDBShow = {
  id: mockTmdbId,
  name: 'Test Show',
  overview: 'A test show',
  first_air_date: '2023-01-01',
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  vote_average: 8.5,
  content_ratings: { results: [] },
  'watch/providers': { results: { US: { flatrate: [] } } },
  networks: [{ origin_country: 'US', name: 'Netflix' }],
  number_of_seasons: 2,
  number_of_episodes: 16,
  genres: [{ id: 18 }, { id: 10765 }],
  status: 'Returning Series',
  type: 'Scripted',
  in_production: true,
  last_air_date: '2023-06-01',
  last_episode_to_air: { id: 100 },
  next_episode_to_air: { id: 101 },
  credits: { cast: [{ credit_id: 'credit1' }] },
  aggregate_credits: {
    cast: [
      {
        id: 1,
        order: 0,
        roles: [
          {
            character: 'Character 1',
            credit_id: 'credit1',
            episode_count: 5,
          },
        ],
      },
    ],
  },
  seasons: [
    {
      air_date: '2023-01-01',
      episode_count: 10,
      id: 100,
      name: 'Season 1',
      overview: 'Season 1 overview',
      poster_path: '/season1_poster.jpg',
      season_number: 1,
      vote_average: 7.5,
    },
    {
      air_date: '2023-05-01',
      episode_count: 6,
      id: 101,
      name: 'Season 2',
      overview: 'Season 2 overview',
      poster_path: '/season2_poster.jpg',
      season_number: 2,
      vote_average: 8.0,
    },
  ],
};

export const mockSeasonDetails = {
  id: 101,
  name: 'Season 2',
  episodes: [
    {
      id: 1001,
      name: 'Episode 1',
      overview: 'Episode 1 overview',
      episode_number: 1,
      episode_type: 'standard',
      season_number: 2,
      air_date: '2023-05-01',
      runtime: 45,
      still_path: '/ep1_still.jpg',
    },
    {
      id: 1002,
      name: 'Episode 2',
      overview: 'Episode 2 overview',
      episode_number: 2,
      episode_type: 'standard',
      season_number: 2,
      air_date: '2023-05-08',
      runtime: 42,
      still_path: '/ep2_still.jpg',
    },
  ],
};

export const mockTMDBResponses = {
  showDetails: mockTMDBShow,
  seasonDetails: mockSeasonDetails,
  showRecommendations: { results: [], page: 1, total_pages: 1, total_results: 0 },
  similarShows: { results: [], page: 1, total_pages: 1, total_results: 0 },
  showChanges: { changes: [] },
};
