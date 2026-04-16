import { CACHE_KEY_PATTERNS, PERSON_KEYS } from '../constants/cacheKeys';
import * as personsDb from '../db/personsDb';
import * as personFailuresDb from '../db/personFailuresDb';
import { appLogger, cliLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { TMDBCredit, TMDBPerson } from '../types/tmdbTypes';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { getTMDBService } from './tmdbService';
import {
  FailureStatus,
  Person,
  PersonDetails,
  PersonReference,
  PersonUpdateFailure,
  SearchPerson,
  SearchPersonCredits,
} from '@ajgifford/keepwatching-types';
import { UpdatePersonResult } from '../types/personTypes';

export class PersonService {
  private cache: CacheService;

  /**
   * Constructor accepts optional dependencies for testing
   */
  constructor(dependencies?: { cacheService?: CacheService }) {
    this.cache = dependencies?.cacheService ?? CacheService.getInstance();
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

  public async getPersonDetails(personId: number): Promise<PersonDetails> {
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
              title: credit.title || credit.name || '',
              posterImage: credit.poster_path,
              releaseDate: credit.release_date || credit.first_air_date || '',
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

  public async getPersons(firstLetter: string, page: number, offset: number, limit: number) {
    try {
      return await this.cache.getOrSet(PERSON_KEYS.list(firstLetter, page, offset, limit), async () => {
        const [totalCount, persons] = await Promise.all([
          personsDb.getPersonsAlphaCount(firstLetter),
          personsDb.getPersons(firstLetter, offset, limit),
        ]);
        const totalPages = Math.ceil(totalCount / limit);
        return {
          persons,
          pagination: {
            totalCount,
            totalPages,
            currentPage: page,
            limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        };
      });
    } catch (error) {
      throw errorService.handleError(error, `getPersons(${firstLetter}, ${page}, ${offset}, ${limit})`);
    }
  }

  public async getPersonsCount(): Promise<number> {
    try {
      return await personsDb.getPersonsCount();
    } catch (error) {
      throw errorService.handleError(error, `getPersonsCount()`);
    }
  }

  public async getPersonByTmdbId(tmdbId: number): Promise<PersonReference | null> {
    try {
      return await personsDb.findPersonByTMDBId(tmdbId);
    } catch (error) {
      throw errorService.handleError(error, `getPersonByTmdbId(${tmdbId})`);
    }
  }

  public async getPeopleForUpdates(blockNumber: number): Promise<Person[]> {
    try {
      return await personsDb.getPeopleForUpdates(blockNumber);
    } catch (error) {
      throw errorService.handleError(error, `getPeopleForUpdates()`);
    }
  }

  public async getPersonFailures(
    status?: FailureStatus,
    limit: number = 50,
    offset: number = 0,
  ): Promise<PersonUpdateFailure[]> {
    try {
      return await personFailuresDb.getPersonFailures(status, limit, offset);
    } catch (error) {
      throw errorService.handleError(error, `getPersonFailures()`);
    }
  }

  public async getPersonFailureCount(status?: FailureStatus): Promise<number> {
    try {
      return await personFailuresDb.getPersonFailureCount(status);
    } catch (error) {
      throw errorService.handleError(error, `getPersonFailureCount()`);
    }
  }

  public async getPersonFailureById(id: number): Promise<PersonUpdateFailure | null> {
    try {
      return await personFailuresDb.getPersonFailureById(id);
    } catch (error) {
      throw errorService.handleError(error, `getPersonFailureById(${id})`);
    }
  }

  public async resolvePersonFailure(personId: number, notes?: string): Promise<void> {
    try {
      await personFailuresDb.updatePersonFailureStatus(personId, 'resolved', notes);
    } catch (error) {
      throw errorService.handleError(error, `resolvePersonFailure(${personId})`);
    }
  }

  public async mergeAndDeletePerson(invalidPersonId: number, validPersonId: number): Promise<{ showsMerged: number; moviesMerged: number }> {
    try {
      const mergeResult = await personsDb.mergePersonCredits(invalidPersonId, validPersonId);
      await personFailuresDb.updatePersonFailureStatus(
        invalidPersonId,
        'removed',
        `Person merged into person_id ${validPersonId} and deleted`,
      );
      await personsDb.deletePerson(invalidPersonId);
      this.cache.invalidatePerson(invalidPersonId);
      this.cache.invalidatePerson(validPersonId);
      return mergeResult;
    } catch (error) {
      throw errorService.handleError(error, `mergeAndDeletePerson(${invalidPersonId} -> ${validPersonId})`);
    }
  }

  public async deletePersonAndReferences(personId: number): Promise<void> {
    try {
      // Mark the failure record as removed BEFORE deleting the person.
      // The FK is ON DELETE SET NULL, so person_id becomes null after deletion —
      // we must resolve by person_id while it is still valid.
      await personFailuresDb.updatePersonFailureStatus(personId, 'removed', `Person deleted (person_id: ${personId})`);
      await personsDb.deletePerson(personId);
      this.cache.invalidatePerson(personId);
    } catch (error) {
      throw errorService.handleError(error, `deletePersonAndReferences(${personId})`);
    }
  }

  public async updatePersonTmdbId(personId: number, newTmdbId: number): Promise<UpdatePersonResult> {
    try {
      await personsDb.updatePersonTmdbId(personId, newTmdbId);
      this.cache.invalidatePerson(personId);
      const person = await personsDb.getPerson(personId);
      const result = await this.checkAndUpdatePerson(person);
      await personFailuresDb.updatePersonFailureStatus(personId, 'resolved', `TMDB ID updated to ${newTmdbId}`);
      return result;
    } catch (error) {
      appLogger.error(ErrorMessages.PersonChangeFail, { error, personId });
      throw errorService.handleError(error, `updatePersonTmdbId(${personId})`);
    }
  }

  public async updatePerson(personId: number, tmdbId: number) {
    const tmdbService = getTMDBService();
    try {
      const person = await personsDb.getPerson(personId);
      const tmdbPerson = await tmdbService.getPersonDetails(tmdbId);
      const fieldsUpdated = await this.compareAndUpdate(person, tmdbPerson);
      return {
        personId: person.id,
        success: true,
        hadUpdates: fieldsUpdated.length > 0,
      };
    } catch (error) {
      appLogger.error(ErrorMessages.PersonChangeFail, { error, personId });
      throw errorService.handleError(error, `updatePerson(${personId})`);
    }
  }

  public async checkAndUpdatePerson(person: Person): Promise<UpdatePersonResult> {
    const tmdbService = getTMDBService();
    try {
      const tmdbPerson = await tmdbService.getPersonDetails(person.tmdbId);
      const fieldsUpdated = await this.compareAndUpdate(person, tmdbPerson);
      return {
        personId: person.id,
        success: true,
        hadUpdates: fieldsUpdated.length > 0,
      };
    } catch (error) {
      appLogger.error(ErrorMessages.PersonChangeFail, { error, personId: person.id });
      throw errorService.handleError(error, `checkAndUpdatePerson(${person.id})`);
    }
  }

  public async getTodayBlockInfo(): Promise<{
    blockNumber: number;
    date: string;
    totalPeople: number;
    nextBlockDate: string;
  }> {
    const today = new Date();
    const blockNumber = this.calculateBlockNumber(today);
    const people = await this.getPeopleForUpdates(blockNumber);

    // Calculate next time this block will run (12 days from now)
    const nextRun = new Date(today);
    nextRun.setDate(nextRun.getDate() + 12);

    return {
      blockNumber,
      date: today.toISOString().split('T')[0],
      totalPeople: people.length,
      nextBlockDate: nextRun.toISOString().split('T')[0],
    };
  }

  public calculateBlockNumber(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

    return dayOfYear % 12;
  }

  private async compareAndUpdate(currentPerson: Person, tmdbPerson: TMDBPerson): Promise<string[]> {
    const fieldComparisons = [
      {
        tmdbField: 'name' as keyof TMDBPerson,
        dbField: 'name' as keyof Person,
      },
      {
        tmdbField: 'biography' as keyof TMDBPerson,
        dbField: 'biography' as keyof Person,
      },
      {
        tmdbField: 'profile_path' as keyof TMDBPerson,
        dbField: 'profileImage' as keyof Person,
      },
      {
        tmdbField: 'birthday' as keyof TMDBPerson,
        dbField: 'birthdate' as keyof Person,
      },
      {
        tmdbField: 'deathday' as keyof TMDBPerson,
        dbField: 'deathdate' as keyof Person,
      },
      {
        tmdbField: 'place_of_birth' as keyof TMDBPerson,
        dbField: 'placeOfBirth' as keyof Person,
      },
      {
        tmdbField: 'gender' as keyof TMDBPerson,
        dbField: 'gender' as keyof Person,
      },
    ];

    const fieldsUpdated: string[] = [];
    for (const { tmdbField, dbField } of fieldComparisons) {
      const tmdbValue = tmdbPerson[tmdbField];
      const currentValue = currentPerson[dbField];

      if (tmdbValue && String(currentValue || '') !== String(tmdbValue)) {
        fieldsUpdated.push(tmdbField);
      }
    }

    if (fieldsUpdated.length > 0) {
      await personsDb.updatePerson({
        id: currentPerson.id,
        tmdb_id: tmdbPerson.id,
        name: tmdbPerson.name,
        gender: tmdbPerson.gender,
        biography: tmdbPerson.biography,
        profile_image: tmdbPerson.profile_path,
        birthdate: tmdbPerson.birthday,
        deathdate: tmdbPerson.deathday,
        place_of_birth: tmdbPerson.place_of_birth,
      });
      cliLogger.debug(`Updated person ${currentPerson.id}`, { fieldsUpdated });
    }

    return fieldsUpdated;
  }
}

/**
 * Factory function for creating new instances
 * Use this in tests to create isolated instances with mocked dependencies
 */
export function createPersonService(dependencies?: { cacheService?: CacheService }): PersonService {
  return new PersonService(dependencies);
}

/**
 * Singleton instance for production use
 */
let instance: PersonService | null = null;

/**
 * Get or create singleton instance
 * Use this in production code
 */
export function getPersonService(): PersonService {
  if (!instance) {
    instance = createPersonService();
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 * Call this in beforeEach/afterEach to ensure test isolation
 */
export function resetPersonService(): void {
  instance = null;
}

/**
 * Backward-compatible default export
 * Existing code using `import { personService }` continues to work
 */
export const personService = getPersonService();
