import { CACHE_KEY_PATTERNS, PERSON_KEYS } from '../constants/cacheKeys';
import * as personsDb from '../db/personsDb';
import { TMDBCredit } from '../types/tmdbTypes';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { getTMDBService } from './tmdbService';
import { Person, SearchPerson, SearchPersonCredits } from '@ajgifford/keepwatching-types';

export class PersonService {
  private cache: CacheService;

  constructor() {
    this.cache = CacheService.getInstance();
  }

  public async invalidatePersonCache(personId: number) {
    this.cache.invalidatePerson(personId);
  }

  /**
   * Invalidate the cache related to persons
   */
  public async invalidateAllPersonsCache() {
    this.cache.invalidatePattern(CACHE_KEY_PATTERNS.PERSON);
  }

  public async getPersonDetails(personId: number): Promise<Person> {
    try {
      return await this.cache.getOrSet(PERSON_KEYS.details(personId), () => personsDb.getPersonDetails(personId), 600);
    } catch (error) {
      throw errorService.handleError(error, `getPersonDetails(${personId})`);
    }
  }

  public async getTMDBPersonDetails(personId: number): Promise<SearchPerson> {
    try {
      return await this.cache.getOrSet(
        PERSON_KEYS.tmdbDetails(personId),
        async () => {
          const tmdbService = getTMDBService();
          const tmdbPerson = await tmdbService.getPersonDetails(personId);
          return {
            id: tmdbPerson.id,
            name: tmdbPerson.name,
            profileImage: tmdbPerson.profile_path,
            department: tmdbPerson.known_for_department,
            popularity: tmdbPerson.popularity,
            biography: tmdbPerson.biography,
            birthday: tmdbPerson.birthday,
            birthplace: tmdbPerson.place_of_birth,
            deathday: tmdbPerson.deathday,
          };
        },
        600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getTMDBPersonDetails(${personId})`);
    }
  }

  public async getTMDBPersonCredits(personId: number): Promise<SearchPersonCredits> {
    try {
      return await this.cache.getOrSet(
        PERSON_KEYS.tmdbCredits(personId),
        async () => {
          const tmdbService = getTMDBService();
          const tmdbCredits = await tmdbService.getPersonCredits(personId);

          const transformCredits = (credits: TMDBCredit[]) =>
            credits.map((credit) => ({
              tmdbId: credit.id,
              title: credit.title || credit.name,
              posterImage: credit.poster_path,
              releaseDate: credit.release_date || credit.first_air_date,
              character: credit.character,
              job: credit.job,
              mediaType: credit.media_type,
            }));

          return {
            cast: transformCredits(tmdbCredits.cast),
            crew: transformCredits(tmdbCredits.crew),
          };
        },
        600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getTMDBPersonCredits(${personId})`);
    }
  }
}

// Export a singleton instance for global use
export const personService = new PersonService();
