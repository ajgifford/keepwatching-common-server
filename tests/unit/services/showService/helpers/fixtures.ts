import { ContentUpdates } from '../../../../../src/types/contentTypes';
import { KeepWatchingShow, ProfileSeason, ProfileShow, Show, ShowTMDBReference } from '@ajgifford/keepwatching-types';

/**
 * Sample profile shows for testing
 */
export const mockProfileShows: ProfileShow[] = [
  {
    profileId: 123,
    id: 1,
    tmdbId: 101,
    title: 'Show 1',
    description: 'Description for Show 1',
    releaseDate: '2023-01-01',
    posterImage: '/poster1.jpg',
    backdropImage: '/backdrop1.jpg',
    userRating: 8.5,
    contentRating: 'TV-14',
    seasonCount: 2,
    episodeCount: 16,
    watchStatus: 'WATCHED',
    status: 'Ended',
    type: 'Scripted',
    inProduction: false,
    genres: 'Drama, Sci-Fi & Fantasy',
    streamingServices: 'Netflix, Disney+',
    network: 'HBO',
    lastAirDate: '2025-05-01',
    lastEpisode: null,
    nextEpisode: null,
  },
  {
    profileId: 123,
    id: 2,
    tmdbId: 102,
    title: 'Show 2',
    description: 'Description for Show 2',
    releaseDate: '2023-02-15',
    posterImage: '/poster2.jpg',
    backdropImage: '/backdrop2.jpg',
    userRating: 7.8,
    contentRating: 'TV-MA',
    seasonCount: 1,
    episodeCount: 8,
    watchStatus: 'UP_TO_DATE',
    status: 'Returning Series',
    type: 'Scripted',
    inProduction: true,
    genres: 'Comedy, Drama',
    streamingServices: 'Netflix, Prime Video',
    network: 'Netflix',
    lastAirDate: '2025-05-01',
    lastEpisode: null,
    nextEpisode: null,
  },
  {
    profileId: 123,
    id: 3,
    tmdbId: 103,
    title: 'Show 3',
    description: 'Description for Show 3',
    releaseDate: '2023-03-20',
    posterImage: '/poster3.jpg',
    backdropImage: '/backdrop3.jpg',
    userRating: 9.0,
    contentRating: 'TV-PG',
    seasonCount: 3,
    episodeCount: 24,
    watchStatus: 'WATCHING',
    status: 'Returning Series',
    type: 'Scripted',
    inProduction: true,
    genres: 'Action & Adventure, Sci-Fi & Fantasy',
    streamingServices: 'Hulu, Prime Video',
    network: 'ABC',
    lastAirDate: '2025-05-01',
    lastEpisode: null,
    nextEpisode: null,
  },
  {
    profileId: 123,
    id: 4,
    tmdbId: 103,
    title: 'Show 4',
    description: 'Description for Show 4',
    releaseDate: '2023-03-20',
    posterImage: '/poster3.jpg',
    backdropImage: '/backdrop3.jpg',
    userRating: 9.0,
    contentRating: 'TV-PG',
    seasonCount: 3,
    episodeCount: 24,
    watchStatus: 'NOT_WATCHED',
    status: 'Returning Series',
    type: 'Scripted',
    inProduction: true,
    genres: 'Action & Adventure, Sci-Fi & Fantasy',
    streamingServices: 'Hulu, Prime Video',
    network: 'ABC',
    lastAirDate: '2025-05-01',
    lastEpisode: null,
    nextEpisode: null,
  },
  {
    profileId: 123,
    id: 5,
    tmdbId: 103,
    title: 'Show 5',
    description: 'Description for Show 5',
    releaseDate: '2023-03-20',
    posterImage: '/poster3.jpg',
    backdropImage: '/backdrop3.jpg',
    userRating: 9.0,
    contentRating: 'TV-PG',
    seasonCount: 3,
    episodeCount: 24,
    watchStatus: 'WATCHED',
    status: 'Canceled',
    type: 'Scripted',
    inProduction: false,
    genres: 'Action & Adventure, Sci-Fi & Fantasy',
    streamingServices: 'Hulu, Prime Video',
    network: 'ABC',
    lastAirDate: '2025-05-01',
    lastEpisode: null,
    nextEpisode: null,
  },
];

export const mockShowTMDBReferences: ShowTMDBReference[] = [
  { id: 1, tmdbId: 101, title: 'Show 1' },
  { id: 2, tmdbId: 102, title: 'Show 2' },
  { id: 3, tmdbId: 103, title: 'Show 3' },
  { id: 4, tmdbId: 104, title: 'Show 4' },
  { id: 5, tmdbId: 105, title: 'Show 5' },
];

/**
 * Sample shows with basic info (for database results)
 */
export const mockShows: Show[] = [
  {
    id: 1,
    tmdbId: 101,
    title: 'Show 1',
    description: 'Description for Show 1',
    releaseDate: '2023-01-01',
    posterImage: '/poster1.jpg',
    backdropImage: '/backdrop1.jpg',
    userRating: 8.5,
    contentRating: 'TV-14',
    seasonCount: 3,
    episodeCount: 24,
    status: 'Returning Series',
    type: 'Scripted',
    inProduction: true,
    genres: 'Action & Adventure, Sci-Fi & Fantasy',
    streamingServices: 'Hulu, Prime Video',
    network: 'ABC',
    lastAirDate: '2025-05-01',
  },
  {
    id: 2,
    tmdbId: 102,
    title: 'Show 2',
    description: 'Description for Show 2',
    releaseDate: '2023-02-15',
    posterImage: '/poster2.jpg',
    backdropImage: '/backdrop2.jpg',
    userRating: 7.8,
    contentRating: 'TV-MA',
    seasonCount: 3,
    episodeCount: 24,
    status: 'Returning Series',
    type: 'Scripted',
    inProduction: true,
    genres: 'Action & Adventure, Sci-Fi & Fantasy',
    streamingServices: 'Hulu, Prime Video',
    network: 'ABC',
    lastAirDate: '2025-05-01',
  },
  {
    id: 3,
    tmdbId: 103,
    title: 'Show 3',
    description: 'Description for Show 3',
    releaseDate: '2023-03-20',
    posterImage: '/poster3.jpg',
    backdropImage: '/backdrop3.jpg',
    userRating: 9.0,
    contentRating: 'TV-PG',
    seasonCount: 3,
    episodeCount: 24,
    status: 'Returning Series',
    type: 'Scripted',
    inProduction: true,
    genres: 'Action & Adventure, Sci-Fi & Fantasy',
    streamingServices: 'Hulu, Prime Video',
    network: 'ABC',
    lastAirDate: '2025-05-01',
  },
];

/**
 * Mock content updates for testing
 */
export const mockContentUpdates: ContentUpdates = {
  id: 123,
  title: 'Test Show',
  tmdb_id: 456,
  created_at: '2023-01-01',
  updated_at: '2023-01-01',
};

/**
 * Profile seasons and episodes for testing
 */
export const mockProfileSeasons: ProfileSeason[] = [
  {
    profileId: 123,
    id: 101,
    showId: 1,
    tmdbId: 1001,
    name: 'Season 1',
    overview: 'First season overview',
    seasonNumber: 1,
    releaseDate: '2023-01-01',
    posterImage: '/season1_poster.jpg',
    numberOfEpisodes: 8,
    watchStatus: 'WATCHED',
    episodes: [
      {
        profileId: 123,
        id: 1001,
        tmdbId: 10001,
        seasonId: 101,
        showId: 1,
        episodeNumber: 1,
        episodeType: 'standard',
        seasonNumber: 1,
        title: 'Episode 1',
        overview: 'First episode',
        runtime: 45,
        airDate: '2023-01-01',
        stillImage: '/episode1_still.jpg',
        watchStatus: 'WATCHED',
      },
      {
        profileId: 123,
        id: 1002,
        tmdbId: 10002,
        seasonId: 101,
        showId: 1,
        episodeNumber: 2,
        episodeType: 'standard',
        seasonNumber: 1,
        title: 'Episode 2',
        overview: 'Second episode',
        runtime: 42,
        airDate: '2023-01-08',
        stillImage: '/episode2_still.jpg',
        watchStatus: 'WATCHED',
      },
    ],
  },
  {
    profileId: 123,
    id: 102,
    showId: 1,
    tmdbId: 1002,
    name: 'Season 2',
    overview: 'Second season overview',
    seasonNumber: 2,
    releaseDate: '2023-02-01',
    posterImage: '/season2_poster.jpg',
    numberOfEpisodes: 8,
    watchStatus: 'WATCHED',
    episodes: [
      {
        profileId: 123,
        id: 1003,
        tmdbId: 10003,
        seasonId: 102,
        showId: 1,
        episodeNumber: 1,
        episodeType: 'standard',
        seasonNumber: 2,
        title: 'Episode 1',
        overview: 'First episode of season 2',
        runtime: 45,
        airDate: '2023-02-01',
        stillImage: '/s2_episode1_still.jpg',
        watchStatus: 'WATCHED',
      },
      {
        profileId: 123,
        id: 1004,
        tmdbId: 10004,
        seasonId: 102,
        showId: 1,
        episodeNumber: 2,
        episodeType: 'standard',
        seasonNumber: 2,
        title: 'Episode 2',
        overview: 'Second episode of season 2',
        runtime: 42,
        airDate: '2023-02-08',
        stillImage: '/s2_episode2_still.jpg',
        watchStatus: 'WATCHED',
      },
    ],
  },
];

/**
 * Mock recent and upcoming episodes
 */
export const mockRecentEpisodes = [
  {
    episode_id: 101,
    title: 'Recent Episode 1',
    air_date: '2023-04-10',
    show_id: 1,
    show_name: 'Show 1',
    season_id: 1,
    episode_number: 5,
    season_number: 1,
    episode_still_image: '/still1.jpg',
  },
  {
    episode_id: 102,
    title: 'Recent Episode 2',
    air_date: '2023-04-12',
    show_id: 2,
    show_name: 'Show 2',
    season_id: 2,
    episode_number: 3,
    season_number: 1,
    episode_still_image: '/still2.jpg',
  },
];

export const mockUpcomingEpisodes = [
  {
    episode_id: 201,
    title: 'Upcoming Episode 1',
    air_date: '2023-04-20',
    show_id: 1,
    show_name: 'Show 1',
    season_id: 1,
    episode_number: 6,
    season_number: 1,
    episode_still_image: '/still3.jpg',
  },
  {
    episode_id: 202,
    title: 'Upcoming Episode 2',
    air_date: '2023-04-25',
    show_id: 3,
    show_name: 'Show 3',
    season_id: 3,
    episode_number: 1,
    season_number: 2,
    episode_still_image: '/still4.jpg',
  },
];

/**
 * Mock next unwatched episodes for continue watching section
 */
export const mockNextUnwatchedEpisodes: KeepWatchingShow[] = [
  {
    showId: 1,
    showTitle: 'Show 1',
    posterImage: '/poster1.jpg',
    lastWatched: '2023-04-05',
    episodes: [
      {
        episodeId: 301,
        episodeTitle: 'Next Episode 1',
        overview: 'Episode overview',
        episodeNumber: 3,
        seasonNumber: 2,
        episodeStillImage: '/still1.jpg',
        airDate: '2023-03-15',
        showId: 1,
        showName: 'Show 1',
        seasonId: 201,
        posterImage: '/poster1.jpg',
        network: 'Netflix',
        streamingServices: 'Netflix,Hulu',
        profileId: 123,
      },
    ],
  },
  {
    showId: 2,
    showTitle: 'Show 2',
    posterImage: '/poster2.jpg',
    lastWatched: '2023-04-08',
    episodes: [
      {
        episodeId: 302,
        episodeTitle: 'Next Episode 2',
        overview: 'Episode 2 overview',
        episodeNumber: 5,
        seasonNumber: 1,
        episodeStillImage: '/still2.jpg',
        airDate: '2023-03-22',
        showId: 2,
        showName: 'Show 2',
        seasonId: 202,
        posterImage: '/poster2.jpg',
        network: 'HBO',
        streamingServices: 'HBO Max',
        profileId: 123,
      },
    ],
  },
];

/**
 * Mock TMDB API responses for testing
 */
export const mockTMDBResponses = {
  /**
   * Show details response
   */
  showDetails: {
    id: 456,
    name: 'Test Show',
    overview: 'A test show description',
    first_air_date: '2023-01-01',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    vote_average: 8.5,
    content_ratings: {
      results: [{ iso_3166_1: 'US', rating: 'TV-14' }],
    },
    number_of_episodes: 16,
    number_of_seasons: 2,
    genres: [{ id: 18 }, { id: 10765 }],
    status: 'Returning Series',
    type: 'Scripted',
    in_production: true,
    last_air_date: '2023-06-01',
    last_episode_to_air: { id: 100 },
    next_episode_to_air: { id: 101 },
    networks: [{ origin_country: 'US', name: 'HBO' }],
    seasons: [
      {
        air_date: '2023-01-01',
        episode_count: 8,
        id: 100,
        name: 'Season 1',
        overview: 'Season 1 overview',
        poster_path: '/season1_poster.jpg',
        season_number: 1,
      },
      {
        air_date: '2023-05-01',
        episode_count: 8,
        id: 101,
        name: 'Season 2',
        overview: 'Season 2 overview',
        poster_path: '/season2_poster.jpg',
        season_number: 2,
      },
    ],
    'watch/providers': {
      results: {
        US: {
          flatrate: [
            { provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg', display_priority: 1 },
            { provider_id: 9, provider_name: 'HBO Max', logo_path: '/hbomax.jpg', display_priority: 2 },
          ],
        },
      },
    },
  },

  /**
   * Season details response
   */
  seasonDetails: {
    id: 100,
    name: 'Season 1',
    overview: 'Season 1 overview',
    episodes: [
      {
        id: 1001,
        name: 'Episode 1',
        overview: 'Episode 1 overview',
        episode_number: 1,
        episode_type: 'standard',
        season_number: 1,
        air_date: '2023-01-01',
        runtime: 45,
        still_path: '/ep1_still.jpg',
      },
      {
        id: 1002,
        name: 'Episode 2',
        overview: 'Episode 2 overview',
        episode_number: 2,
        episode_type: 'standard',
        season_number: 1,
        air_date: '2023-01-08',
        runtime: 42,
        still_path: '/ep2_still.jpg',
      },
    ],
  },

  /**
   * Show recommendations response
   */
  showRecommendations: {
    results: [
      {
        id: 456,
        name: 'Recommended Show 1',
        genre_ids: [18, 10765],
        first_air_date: '2022-01-01',
        overview: 'A recommended show',
        poster_path: '/poster1.jpg',
        vote_average: 8.2,
        popularity: 52.3,
        origin_country: ['US'],
        original_language: 'en',
      },
      {
        id: 789,
        name: 'Recommended Show 2',
        genre_ids: [28, 12],
        first_air_date: '2023-05-15',
        overview: 'Another recommended show',
        poster_path: '/poster2.jpg',
        vote_average: 7.5,
        popularity: 42.1,
        origin_country: ['GB'],
        original_language: 'en',
      },
    ],
  },

  /**
   * Similar shows response
   */
  similarShows: {
    results: [
      {
        id: 456,
        name: 'Similar Show 1',
        genre_ids: [18, 10765],
        first_air_date: '2022-01-01',
        overview: 'A similar show',
        poster_path: '/poster1.jpg',
        vote_average: 8.2,
        popularity: 52.3,
        origin_country: ['US'],
        original_language: 'en',
      },
      {
        id: 789,
        name: 'Similar Show 2',
        genre_ids: [28, 12],
        first_air_date: '2023-05-15',
        overview: 'Another similar show',
        poster_path: '/poster2.jpg',
        vote_average: 7.5,
        popularity: 42.1,
        origin_country: ['GB'],
        original_language: 'en',
      },
    ],
  },

  /**
   * Show changes response
   */
  showChanges: {
    changes: [
      {
        key: 'name',
        items: [
          {
            id: 'abc123',
            action: 'updated',
            time: '2023-01-05',
            iso_639_1: 'en',
            iso_3166_1: 'US',
            value: 'Updated Show Title',
            original_value: 'Test Show',
          },
        ],
      },
      {
        key: 'overview',
        items: [
          {
            id: 'def456',
            action: 'updated',
            time: '2023-01-05',
            iso_639_1: 'en',
            iso_3166_1: 'US',
            value: 'New overview',
            original_value: 'Old overview',
          },
        ],
      },
    ],
  },

  /**
   * Season changes response
   */
  seasonChanges: {
    changes: [
      {
        key: 'season',
        items: [
          {
            id: 'season1',
            action: 'added',
            time: '2023-01-05',
            iso_639_1: 'en',
            iso_3166_1: 'US',
            value: { season_id: 101 },
            original_value: null,
          },
        ],
      },
    ],
  },
};
