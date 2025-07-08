import { CACHE_KEY_PATTERNS, PERSON_KEYS } from '../constants/cacheKeys';
import * as personsDb from '../db/personsDb';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { Person } from '@ajgifford/keepwatching-types';

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
}

// Export a singleton instance for global use
export const personService = new PersonService();
