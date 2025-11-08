import { mockMovieReferences, mockTMDBResponses } from './helpers/fixtures';
import { setupMoviesService } from './helpers/mocks';
import * as moviesDb from '@db/moviesDb';
import { NotFoundError } from '@middleware/errorMiddleware';
import { errorService } from '@services/errorService';
import { getTMDBService } from '@services/tmdbService';
import { type Mock, Mocked, beforeEach, describe, expect, it } from 'vitest';

describe('MoviesService - Recommendations', () => {
  let service: ReturnType<typeof setupMoviesService>['service'];
  let mockCache: ReturnType<typeof setupMoviesService>['mockCache'];

  beforeEach(() => {
    const setup = setupMoviesService();
    service = setup.service;
    mockCache = setup.mockCache;
  });

  describe('getShowRecommendations', () => {
    const mockMovieReference = mockMovieReferences[0];
    const mockUserMovies = [
      { tmdbId: 123, title: 'Test Movie' },
      { tmdbId: 456, title: 'Already Favorited Movie' },
    ];

    it('should return recommendations from cache when available', async () => {
      const mockRecommendations = [
        {
          id: 456,
          title: 'Recommended Movie 1',
          inFavorites: true,
        },
        {
          id: 789,
          title: 'Recommended Movie 2',
          inFavorites: false,
        },
      ];

      (moviesDb.findMovieById as Mock).mockResolvedValue(mockMovieReference);
      mockCache.getOrSet.mockResolvedValue(mockRecommendations);

      const result = await service.getMovieRecommendations(123, 1);

      expect(moviesDb.findMovieById).toHaveBeenCalledWith(1);
      expect(mockCache.getOrSet).toHaveBeenCalledWith('recommendations_movie_1', expect.any(Function), 86400);
      expect(result).toEqual(mockRecommendations);
    });

    it('should fetch recommendations from TMDB when not in cache', async () => {
      (moviesDb.findMovieById as Mock).mockResolvedValue(mockMovieReference);
      (moviesDb.getAllMoviesForProfile as Mock).mockResolvedValue(mockUserMovies);

      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());

      const mockTMDBService = getTMDBService() as Mocked<ReturnType<typeof getTMDBService>>;
      mockTMDBService.getMovieRecommendations.mockResolvedValue(mockTMDBResponses.movieRecommendations);

      const result = await service.getMovieRecommendations(123, 1);

      expect(moviesDb.findMovieById).toHaveBeenCalledWith(1);
      expect(mockTMDBService.getMovieRecommendations).toHaveBeenCalledWith(mockMovieReference.tmdbId);
      expect(moviesDb.getAllMoviesForProfile).toHaveBeenCalledWith(123);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 456);
      expect(result[0]).toHaveProperty('inFavorites', true);
      expect(result[1]).toHaveProperty('id', 789);
      expect(result[1]).toHaveProperty('inFavorites', false);
    });

    it('should throw NotFoundError when show does not exist', async () => {
      (moviesDb.findMovieById as Mock).mockResolvedValue(null);
      (errorService.assertExists as Mock).mockImplementation(() => {
        throw new NotFoundError('Show not found');
      });

      await expect(service.getMovieRecommendations(123, 999)).rejects.toThrow(NotFoundError);
      expect(moviesDb.findMovieById).toHaveBeenCalledWith(999);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (moviesDb.findMovieById as Mock).mockRejectedValue(error);

      await expect(service.getMovieRecommendations(123, 1)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getMovieRecommendations(123, 1)');
    });
  });

  describe('getSimilarShows', () => {
    const mockMovieReference = mockMovieReferences[0];
    const mockUserMovies = [
      { tmdbId: 123, title: 'Test Movie' },
      { tmdbId: 456, title: 'Already Favorited Movie' },
    ];

    it('should return similar movies from cache when available', async () => {
      const mockSimilarMovies = [
        {
          id: 456,
          title: 'Similar Movie 1',
          inFavorites: true,
        },
        {
          id: 789,
          title: 'Similar Movie 2',
          inFavorites: false,
        },
      ];

      (moviesDb.findMovieById as Mock).mockResolvedValue(mockMovieReference);
      mockCache.getOrSet.mockResolvedValue(mockSimilarMovies);

      const result = await service.getSimilarMovies(123, 1);

      expect(moviesDb.findMovieById).toHaveBeenCalledWith(1);
      expect(mockCache.getOrSet).toHaveBeenCalledWith('similar_movie_1', expect.any(Function), 86400);
      expect(result).toEqual(mockSimilarMovies);
    });

    it('should fetch similar shows from TMDB when not in cache', async () => {
      (moviesDb.findMovieById as Mock).mockResolvedValue(mockMovieReference);
      (moviesDb.getAllMoviesForProfile as Mock).mockResolvedValue(mockUserMovies);

      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());

      const mockTMDBService = getTMDBService() as Mocked<ReturnType<typeof getTMDBService>>;
      mockTMDBService.getSimilarMovies.mockResolvedValue(mockTMDBResponses.similarMovies);

      const result = await service.getSimilarMovies(123, 1);

      expect(moviesDb.findMovieById).toHaveBeenCalledWith(1);
      expect(mockTMDBService.getSimilarMovies).toHaveBeenCalledWith(mockMovieReference.tmdbId);
      expect(moviesDb.getAllMoviesForProfile).toHaveBeenCalledWith(123);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 456);
      expect(result[0]).toHaveProperty('inFavorites', true);
      expect(result[1]).toHaveProperty('id', 789);
      expect(result[1]).toHaveProperty('inFavorites', false);
    });

    it('should throw NotFoundError when show does not exist', async () => {
      (moviesDb.findMovieById as Mock).mockResolvedValue(null);
      (errorService.assertExists as Mock).mockImplementation(() => {
        throw new NotFoundError('Movie not found');
      });

      await expect(service.getSimilarMovies(123, 999)).rejects.toThrow(NotFoundError);
      expect(moviesDb.findMovieById).toHaveBeenCalledWith(999);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (moviesDb.findMovieById as Mock).mockRejectedValue(error);

      await expect(service.getSimilarMovies(123, 1)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getSimilarMovies(123, 1)');
    });
  });
});
