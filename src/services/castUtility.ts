import * as personsDb from '../db/personsDb';
import { CacheService } from './cacheService';
import { getTMDBService } from './tmdbService';

export interface CastJob {
  tmdbPersonId: number;
  save: (personId: number) => void;
}

export async function processContentCast(jobs: CastJob[], cache?: CacheService): Promise<void> {
  for (const job of jobs) {
    const person = await personsDb.findPersonByTMDBId(job.tmdbPersonId);
    let personId: number;
    if (person) {
      personId = person.id;
    } else {
      const tmdbPerson = await getTMDBService().getPersonDetails(job.tmdbPersonId);
      personId = await personsDb.savePerson({
        tmdb_id: tmdbPerson.id,
        name: tmdbPerson.name,
        gender: tmdbPerson.gender,
        biography: tmdbPerson.biography,
        profile_image: tmdbPerson.profile_path,
        birthdate: tmdbPerson.birthday,
        deathdate: tmdbPerson.deathday,
        place_of_birth: tmdbPerson.place_of_birth,
      });
    }
    job.save(personId);
    cache?.invalidatePerson(personId);
  }
}
