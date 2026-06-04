import * as personsDb from '../db/personsDb';
import { cliLogger } from '../logger/logger';
import { TMDBMovie } from '../types/tmdbTypes';
import { CacheService } from './cacheService';
import { processContentCast } from './castUtility';

export abstract class BaseMovieService {
  protected cache: CacheService;

  constructor(dependencies?: { cacheService?: CacheService }) {
    this.cache = dependencies?.cacheService ?? CacheService.getInstance();
  }

  protected async processMovieCast(movie: TMDBMovie, movieId: number): Promise<void> {
    try {
      const jobs = (movie.credits.cast ?? []).map((castMember) => ({
        tmdbPersonId: castMember.id,
        save: (personId: number) =>
          personsDb.saveMovieCast({
            content_id: movieId,
            person_id: personId,
            character_name: castMember.character,
            credit_id: castMember.credit_id,
            cast_order: castMember.order,
          }),
      }));
      await processContentCast(jobs, this.cache);
    } catch (error) {
      cliLogger.error('Error fetching movie cast:', error);
    }
  }
}
