import { ContentUpdates } from '../../../../../src/types/contentTypes';
import { ContinueWatchingShow, ProfileSeason, ProfileShow, Show } from '../../../../../src/types/showTypes';

/**
 * Sample profile shows for testing
 */
export const mockProfileShows: ProfileShow[] = [
  {
    profile_id: 123,
    show_id: 1,
    tmdb_id: 101,
    title: 'Show 1',
    description: 'Description for Show 1',
    release_date: '2023-01-01',
    poster_image: '/poster1.jpg',
    backdrop_image: '/backdrop1.jpg',
    user_rating: 8.5,
    content_rating: 'TV-14',
    season_count: 2,
    episode_count: 16,
    watch_status: 'WATCHED',
    status: 'Ended',
    type: 'Scripted',
    in_production: 0,
    genres: 'Drama, Sci-Fi & Fantasy',
    streaming_services: 'Netflix, Disney+',
    network: 'HBO',
  },
  {
    profile_id: 123,
    show_id: 2,
    tmdb_id: 102,
    title: 'Show 2',
    description: 'Description for Show 2',
    release_date: '2023-02-15',
    poster_image: '/poster2.jpg',
    backdrop_image: '/backdrop2.jpg',
    user_rating: 7.8,
    content_rating: 'TV-MA',
    season_count: 1,
    episode_count: 8,
    watch_status: 'WATCHING',
    status: 'Returning Series',
    type: 'Scripted',
    in_production: 1,
    genres: 'Comedy, Drama',
    streaming_services: 'Netflix, Prime Video',
    network: 'Netflix',
  },
  {
    profile_id: 123,
    show_id: 3,
    tmdb_id: 103,
    title: 'Show 3',
    description: 'Description for Show 3',
    release_date: '2023-03-20',
    poster_image: '/poster3.jpg',
    backdrop_image: '/backdrop3.jpg',
    user_rating: 9.0,
    content_rating: 'TV-PG',
    season_count: 3,
    episode_count: 24,
    watch_status: 'NOT_WATCHED',
    status: 'Returning Series',
    type: 'Scripted',
    in_production: 1,
    genres: 'Action & Adventure, Sci-Fi & Fantasy',
    streaming_services: 'Hulu, Prime Video',
    network: 'ABC',
  },
];

/**
 * Sample shows with basic info (for database results)
 */
export const mockShows: Show[] = [
  {
    id: 1,
    tmdb_id: 101,
    title: 'Show 1',
    description: 'Description for Show 1',
    release_date: '2023-01-01',
    poster_image: '/poster1.jpg',
    backdrop_image: '/backdrop1.jpg',
    user_rating: 8.5,
    content_rating: 'TV-14',
  },
  {
    id: 2,
    tmdb_id: 102,
    title: 'Show 2',
    description: 'Description for Show 2',
    release_date: '2023-02-15',
    poster_image: '/poster2.jpg',
    backdrop_image: '/backdrop2.jpg',
    user_rating: 7.8,
    content_rating: 'TV-MA',
  },
  {
    id: 3,
    tmdb_id: 103,
    title: 'Show 3',
    description: 'Description for Show 3',
    release_date: '2023-03-20',
    poster_image: '/poster3.jpg',
    backdrop_image: '/backdrop3.jpg',
    user_rating: 9.0,
    content_rating: 'TV-PG',
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
    profile_id: 123,
    season_id: 101,
    show_id: 1,
    tmdb_id: 1001,
    name: 'Season 1',
    overview: 'First season overview',
    season_number: 1,
    release_date: '2023-01-01',
    poster_image: '/season1_poster.jpg',
    number_of_episodes: 8,
    watch_status: 'WATCHED',
    episodes: [
      {
        profile_id: 123,
        episode_id: 1001,
        tmdb_id: 10001,
        season_id: 101,
        show_id: 1,
        episode_number: 1,
        episode_type: 'standard',
        season_number: 1,
        title: 'Episode 1',
        overview: 'First episode',
        runtime: 45,
        air_date: '2023-01-01',
        still_image: '/episode1_still.jpg',
        watch_status: 'WATCHED',
      },
      {
        profile_id: 123,
        episode_id: 1002,
        tmdb_id: 10002,
        season_id: 101,
        show_id: 1,
        episode_number: 2,
        episode_type: 'standard',
        season_number: 1,
        title: 'Episode 2',
        overview: 'Second episode',
        runtime: 42,
        air_date: '2023-01-08',
        still_image: '/episode2_still.jpg',
        watch_status: 'WATCHED',
      },
    ],
  },
  {
    profile_id: 123,
    season_id: 102,
    show_id: 1,
    tmdb_id: 1002,
    name: 'Season 2',
    overview: 'Second season overview',
    season_number: 2,
    release_date: '2023-02-01',
    poster_image: '/season2_poster.jpg',
    number_of_episodes: 8,
    watch_status: 'WATCHED',
    episodes: [
      {
        profile_id: 123,
        episode_id: 1003,
        tmdb_id: 10003,
        season_id: 102,
        show_id: 1,
        episode_number: 1,
        episode_type: 'standard',
        season_number: 2,
        title: 'Episode 1',
        overview: 'First episode of season 2',
        runtime: 45,
        air_date: '2023-02-01',
        still_image: '/s2_episode1_still.jpg',
        watch_status: 'WATCHED',
      },
      {
        profile_id: 123,
        episode_id: 1004,
        tmdb_id: 10004,
        season_id: 102,
        show_id: 1,
        episode_number: 2,
        episode_type: 'standard',
        season_number: 2,
        title: 'Episode 2',
        overview: 'Second episode of season 2',
        runtime: 42,
        air_date: '2023-02-08',
        still_image: '/s2_episode2_still.jpg',
        watch_status: 'WATCHED',
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
export const mockNextUnwatchedEpisodes: ContinueWatchingShow[] = [
  {
    show_id: 1,
    show_title: 'Show 1',
    poster_image: '/poster1.jpg',
    last_watched: '2023-04-05',
    episodes: [
      {
        episode_id: 301,
        episode_title: 'Next Episode 1',
        overview: 'Episode overview',
        episode_number: 3,
        season_number: 2,
        episode_still_image: '/still1.jpg',
        air_date: '2023-03-15',
        show_id: 1,
        show_name: 'Show 1',
        season_id: 201,
        poster_image: '/poster1.jpg',
        network: 'Netflix',
        streaming_services: 'Netflix,Hulu',
        profile_id: 123,
      },
    ],
  },
  {
    show_id: 2,
    show_title: 'Show 2',
    poster_image: '/poster2.jpg',
    last_watched: '2023-04-08',
    episodes: [
      {
        episode_id: 302,
        episode_title: 'Next Episode 2',
        overview: 'Episode 2 overview',
        episode_number: 5,
        season_number: 1,
        episode_still_image: '/still2.jpg',
        air_date: '2023-03-22',
        show_id: 2,
        show_name: 'Show 2',
        season_id: 202,
        poster_image: '/poster2.jpg',
        network: 'HBO',
        streaming_services: 'HBO Max',
        profile_id: 123,
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
