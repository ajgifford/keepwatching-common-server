import { ContentUpdates } from '../../../../../src/types/contentTypes';
import { ProfileShow } from '../../../../../src/types/showTypes';

/**
 * Sample shows for testing
 */
export const mockShows: ProfileShow[] = [
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
 * Mock TMDB show response
 */
export const mockTMDBShow = {
  id: 456,
  name: 'Updated Show Title',
  overview: 'New overview',
  first_air_date: '2023-02-01',
  poster_path: '/new-poster.jpg',
  backdrop_path: '/new-backdrop.jpg',
  vote_average: 8.5,
  content_ratings: { results: [] },
  number_of_episodes: 10,
  number_of_seasons: 1,
  genres: [{ id: 28 }, { id: 12 }],
  status: 'Returning Series',
  type: 'Scripted',
  in_production: true,
  last_air_date: '2023-01-15',
  last_episode_to_air: null,
  next_episode_to_air: null,
  networks: [{ origin_country: 'US', name: 'HBO' }],
  seasons: [
    {
      air_date: '2023-01-01',
      episode_count: 2,
      id: 100,
      name: 'Season 1',
      overview: 'Season 1 overview',
      poster_path: '/season1_poster.jpg',
      season_number: 1,
    },
  ],
  'watch/providers': {
    results: {
      US: {
        flatrate: [],
      },
    },
  },
};

/**
 * Mock TMDB season details
 */
export const mockSeasonDetails = {
  id: 100,
  name: 'Season 1',
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
};
