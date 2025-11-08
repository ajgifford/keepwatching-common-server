import { TMDBRelatedMovie } from '../../../../../src/types/tmdbTypes';
import { MovieReference } from '@ajgifford/keepwatching-types';

export const mockMovieReferences: MovieReference[] = [
  {
    id: 1,
    tmdbId: 101,
    title: 'Movie 1',
    releaseDate: '',
  },
  {
    id: 2,
    tmdbId: 102,
    title: 'Movie 2',
    releaseDate: '',
  },
  {
    id: 3,
    tmdbId: 103,
    title: 'Movie 3',
    releaseDate: '',
  },
  {
    id: 4,
    tmdbId: 104,
    title: 'Movie 4',
    releaseDate: '',
  },
  {
    id: 5,
    tmdbId: 105,
    title: 'Movie 5',
    releaseDate: '',
  },
];

export const mockTMDBResponses = {
  /**
   * Movie details response
   */
  movieDetails: {
    id: 456,
    title: 'Test Movie',
    overview: 'A test movie description',
    release_date: '2023-01-15',
    poster_path: '/movie_poster.jpg',
    backdrop_path: '/movie_backdrop.jpg',
    vote_average: 8.7,
    runtime: 120,
    budget: 50000000,
    revenue: 200000000,
    genres: [
      { id: 28, name: 'Action' },
      { id: 12, name: 'Adventure' },
    ],
    production_companies: [{ id: 1, name: 'US Production Co', origin_country: 'US', logo_path: '/logo.jpg' }],
    release_dates: {
      results: [
        {
          iso_3166_1: 'US',
          release_dates: [
            {
              certification: 'PG-13',
              iso_639_1: 'en',
              release_date: '2023-01-15',
              type: 3,
            },
          ],
        },
      ],
    },
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
    credits: {
      cast: [
        {
          id: 1001,
          name: 'Actor Name',
          character: 'Character Name',
          credit_id: 'credit123',
          order: 0,
          profile_path: '/actor_profile.jpg',
        },
      ],
      crew: [
        {
          id: 2001,
          name: 'Director Name',
          job: 'Director',
          department: 'Directing',
          credit_id: 'credit456',
        },
      ],
    },
  },

  /**
   * Movie changes response
   */
  movieChanges: {
    changes: [
      {
        key: 'title',
        items: [
          {
            id: 'abc123',
            action: 'updated',
            time: '2023-01-20',
            iso_639_1: 'en',
            iso_3166_1: 'US',
            value: 'Updated Movie Title',
            original_value: 'Test Movie',
          },
        ],
      },
      {
        key: 'overview',
        items: [
          {
            id: 'def456',
            action: 'updated',
            time: '2023-01-20',
            iso_639_1: 'en',
            iso_3166_1: 'US',
            value: 'New movie overview',
            original_value: 'Old movie overview',
          },
        ],
      },
    ],
  },

  /**
   * Person details response
   */
  personDetails: {
    id: 1001,
    name: 'Actor Name',
    biography: 'Biography of the actor',
    birthday: '1980-05-15',
    deathday: null,
    gender: 2,
    place_of_birth: 'Los Angeles, California, USA',
    profile_path: '/actor_profile.jpg',
    known_for_department: 'Acting',
  },

  /**
   * Movie recommendations response
   */
  movieRecommendations: {
    results: [
      {
        id: 456,
        title: 'Recommended Movie 1',
        genre_ids: [18, 10765],
        release_date: '2022-01-01',
        overview: 'A recommended movie',
        poster_path: '/poster1.jpg',
        vote_average: 8.2,
        popularity: 52.3,
        origin_country: ['US'],
        original_language: 'en',
      } as unknown as TMDBRelatedMovie,
      {
        id: 789,
        title: 'Recommended Movie 2',
        genre_ids: [28, 12],
        release_date: '2023-05-15',
        overview: 'Another recommended movie',
        poster_path: '/poster2.jpg',
        vote_average: 7.5,
        popularity: 42.1,
        origin_country: ['GB'],
        original_language: 'en',
      } as unknown as TMDBRelatedMovie,
    ],
    page: 1,
    total_pages: 1,
    total_results: 2,
  },

  /**
   * Similar movies response
   */
  similarMovies: {
    results: [
      {
        id: 456,
        title: 'Similar Movie 1',
        genre_ids: [18, 10765],
        release_date: '2022-01-01',
        overview: 'A similar movie',
        poster_path: '/poster1.jpg',
        vote_average: 8.2,
        popularity: 52.3,
        origin_country: ['US'],
        original_language: 'en',
      } as unknown as TMDBRelatedMovie,
      {
        id: 789,
        title: 'Similar Movie 2',
        genre_ids: [28, 12],
        release_date: '2023-05-15',
        overview: 'Another similar movie',
        poster_path: '/poster2.jpg',
        vote_average: 7.5,
        popularity: 42.1,
        origin_country: ['GB'],
        original_language: 'en',
      } as unknown as TMDBRelatedMovie,
    ],
    page: 1,
    total_pages: 1,
    total_results: 2,
  },
};
