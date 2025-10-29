import { CACHE_KEY_PATTERNS, PERSON_KEYS } from '../constants/cacheKeys';
import * as personsDb from '../db/personsDb';
import { appLogger, cliLogger } from '../logger/logger';
import { ErrorMessages } from '../logger/loggerModel';
import { TMDBCredit, TMDBPerson } from '../types/tmdbTypes';
import { CacheService } from './cacheService';
import { errorService } from './errorService';
import { getTMDBService } from './tmdbService';
import { Person, PersonDetails, SearchPerson, SearchPersonCredits } from '@ajgifford/keepwatching-types';
import { UpdatePersonResult } from 'src/types/personTypes';

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

  public async getPeopleForUpdates(blockNumber: number): Promise<Person[]> {
    try {
      return await personsDb.getPeopleForUpdates(blockNumber);
    } catch (error) {
      throw errorService.handleError(error, `getPeopleForUpdates()`);
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

// Export a singleton instance for global use
export const personService = new PersonService();
