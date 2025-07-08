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
        name: 'Recommended Movie 2',
        genre_ids: [28, 12],
        first_air_date: '2023-05-15',
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
        name: 'Similar Movie 1',
        genre_ids: [18, 10765],
        first_air_date: '2022-01-01',
        overview: 'A similar movie',
        poster_path: '/poster1.jpg',
        vote_average: 8.2,
        popularity: 52.3,
        origin_country: ['US'],
        original_language: 'en',
      } as unknown as TMDBRelatedMovie,
      {
        id: 789,
        name: 'Similar Movie 2',
        genre_ids: [28, 12],
        first_air_date: '2023-05-15',
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
