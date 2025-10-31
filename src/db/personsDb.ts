import {
  MovieCastMemberRow,
  MovieCreditRow,
  PersonReferenceRow,
  PersonRow,
  ShowCastMemberRow,
  ShowCreditRow,
  transformAdminPersonRow,
  transformMovieCastMemberRow,
  transformPersonReferenceRow,
  transformPersonRow,
  transformPersonRowWithCredits,
  transformShowCastMemberRow,
} from '../types/personTypes';
import { getDbPool } from '../utils/db';
import { DbMonitor } from '../utils/dbMonitoring';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { TransactionHelper } from '../utils/transactionHelper';
import {
  AdminPerson,
  CastMember,
  CreateCast,
  CreatePerson,
  CreateShowCast,
  Person,
  PersonDetails,
  PersonReference,
  ShowCastMember,
  UpdatePerson,
} from '@ajgifford/keepwatching-types';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export async function savePerson(createPerson: CreatePerson): Promise<number> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('savePerson', async () => {
      const query =
        'INSERT INTO people (tmdb_id, name, gender, biography, profile_image, birthdate, deathdate, place_of_birth) VALUES (?,?,?,?,?,?,?,?)';
      const [result] = await getDbPool().execute<ResultSetHeader>(query, [
        createPerson.tmdb_id,
        createPerson.name,
        createPerson.gender,
        createPerson.biography,
        createPerson.profile_image,
        createPerson.birthdate,
        createPerson.deathdate,
        createPerson.place_of_birth,
      ]);
      return result.insertId;
    });
  } catch (error) {
    handleDatabaseError(error, 'saving a person');
  }
}

export async function updatePerson(updatePerson: UpdatePerson): Promise<boolean> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('updatePerson', async () => {
      const query =
        'UPDATE people SET name = ?, gender = ?, biography = ?, profile_image = ?, birthdate = ?, deathdate = ?, place_of_birth = ? WHERE id = ?';
      const [result] = await getDbPool().execute<ResultSetHeader>(query, [
        updatePerson.name,
        updatePerson.gender,
        updatePerson.biography,
        updatePerson.profile_image,
        updatePerson.birthdate,
        updatePerson.deathdate,
        updatePerson.place_of_birth,
        updatePerson.id,
      ]);
      return result.affectedRows > 0;
    });
  } catch (error) {
    handleDatabaseError(error, 'updating a person');
  }
}

export async function saveMovieCast(createCast: CreateCast) {
  try {
    return await DbMonitor.getInstance().executeWithTiming('saveMovieCast', async () => {
      const query = `
      INSERT INTO movie_cast (movie_id, person_id, credit_id, character_name, cast_order) 
      VALUES (?,?,?,?,?) 
      ON DUPLICATE KEY UPDATE
        character_name = VALUES(character_name),
        cast_order = VALUES(cast_order)`;
      await getDbPool().execute<ResultSetHeader>(query, [
        createCast.content_id,
        createCast.person_id,
        createCast.credit_id,
        createCast.character_name,
        createCast.cast_order,
      ]);
      return true;
    });
  } catch (error) {
    handleDatabaseError(error, 'saving a movie cast member');
  }
}

export async function saveShowCast(createCast: CreateShowCast) {
  try {
    return await DbMonitor.getInstance().executeWithTiming('saveShowCast', async () => {
      const query = `
      INSERT INTO show_cast (show_id, person_id, credit_id, character_name, total_episodes, cast_order, active) 
      VALUES (?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        character_name = VALUES(character_name),
        total_episodes = VALUES(total_episodes),
        cast_order = VALUES(cast_order),
        active = VALUES(active);`;
      await getDbPool().execute<ResultSetHeader>(query, [
        createCast.content_id,
        createCast.person_id,
        createCast.credit_id,
        createCast.character_name,
        createCast.total_episodes,
        createCast.cast_order,
        createCast.active,
      ]);
      return true;
    });
  } catch (error) {
    handleDatabaseError(error, 'saving a show cast member');
  }
}

export async function findPersonById(id: number): Promise<PersonReference | null> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('findPersonById', async () => {
      const query = `SELECT id, tmdb_id, name FROM people WHERE id = ?`;
      const [people] = await getDbPool().execute<PersonReferenceRow[]>(query, [id]);
      if (people.length === 0) return null;
      return transformPersonReferenceRow(people[0]);
    });
  } catch (error) {
    handleDatabaseError(error, 'finding a person by id');
  }
}

export async function findPersonByTMDBId(tmdbId: number): Promise<PersonReference | null> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('findPersonByTMDBId', async () => {
      const query = `SELECT id, tmdb_id, name FROM people WHERE tmdb_id = ?`;
      const [people] = await getDbPool().execute<PersonReferenceRow[]>(query, [tmdbId]);
      if (people.length === 0) return null;
      return transformPersonReferenceRow(people[0]);
    });
  } catch (error) {
    handleDatabaseError(error, 'finding a person by TMDB id');
  }
}

export async function getPersonDetails(personId: number): Promise<PersonDetails> {
  const transactionHelper = new TransactionHelper();
  try {
    return await DbMonitor.getInstance().executeWithTiming('getPersonDetails', async () => {
      return await transactionHelper.executeInTransaction(async (connection) => {
        const personQuery = 'SELECT * FROM people WHERE id = ?';
        const [people] = await connection.execute<PersonRow[]>(personQuery, [personId]);

        const movieCreditsQuery = 'SELECT * FROM people_movie_credits WHERE person_id = ?';
        const [movieCredits] = await connection.execute<MovieCreditRow[]>(movieCreditsQuery, [personId]);

        const showCreditsQuery = 'SELECT * FROM people_show_credits WHERE person_id = ?';
        const [showCredits] = await connection.execute<ShowCreditRow[]>(showCreditsQuery, [personId]);

        return transformPersonRowWithCredits(people[0], movieCredits, showCredits);
      });
    });
  } catch (error) {
    handleDatabaseError(error, 'getting a person details');
  }
}

export async function getMovieCastMembers(movieId: number): Promise<CastMember[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getMovieCastMembers', async () => {
      const query = 'SELECT * FROM movie_cast_members WHERE movie_id = ?';
      const [movies] = await getDbPool().execute<MovieCastMemberRow[]>(query, [movieId]);
      return movies.map(transformMovieCastMemberRow);
    });
  } catch (error) {
    handleDatabaseError(error, `getting a movie's cast members`);
  }
}

export async function getShowCastMembers(showId: number, active: number): Promise<ShowCastMember[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getShowCastMembers', async () => {
      const query = 'SELECT * FROM show_cast_members WHERE show_id = ? and active = ?';
      const [shows] = await getDbPool().execute<ShowCastMemberRow[]>(query, [showId, active]);
      return shows.map(transformShowCastMemberRow);
    });
  } catch (error) {
    handleDatabaseError(error, `getting a show's cast members`);
  }
}

export async function getPerson(personId: number): Promise<Person> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getPerson', async () => {
      const dataQuery = `SELECT * FROM people WHERE id = ?`;
      const [people] = await getDbPool().execute<PersonRow[]>(dataQuery, [personId]);
      return transformPersonRow(people[0]);
    });
  } catch (error) {
    handleDatabaseError(error, 'getting person');
  }
}

export async function getPersons(firstLetter: string, offset: number = 0, limit: number = 50): Promise<AdminPerson[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getPersons', async () => {
      const query = `SELECT * FROM people WHERE UPPER(LEFT(name, 1)) = UPPER(?) ORDER BY name ASC LIMIT ${limit} OFFSET ${offset}`;
      const [dataResult] = await getDbPool().execute<PersonRow[]>(query, [firstLetter]);
      return dataResult.map(transformAdminPersonRow);
    });
  } catch (error) {
    handleDatabaseError(error, 'getting persons with pagination');
  }
}

export async function getPersonsAlphaCount(firstLetter: string): Promise<number> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getPersonsAlphaCount', async () => {
      const query = 'SELECT COUNT(*) as total FROM people WHERE UPPER(LEFT(name, 1)) = UPPER(?)';
      const [result] = await getDbPool().execute<RowDataPacket[]>(query, [firstLetter]);
      return result[0].total as number;
    });
  } catch (error) {
    handleDatabaseError(error, 'getting persons count for alpha');
  }
}

export async function getPersonsCount(): Promise<number> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getPersonsCount', async () => {
      const query = 'SELECT COUNT(*) as total FROM people';
      const [result] = await getDbPool().execute<RowDataPacket[]>(query);
      return result[0].total as number;
    });
  } catch (error) {
    handleDatabaseError(error, 'getting persons count');
  }
}

export async function getPeopleForUpdates(blockNumber: number): Promise<Person[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming('getPeopleForUpdates', async () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

      const query = `
        SELECT * FROM people 
        WHERE tmdb_id IS NOT NULL
          AND (id % 12) = ?
          AND (
            deathdate IS NULL 
            OR deathdate = '' 
            OR deathdate > ?
          )
        ORDER BY id`;

      const [people] = await getDbPool().query<PersonRow[]>(query, [blockNumber, oneYearAgoStr]);
      return people.map((person) => transformPersonRowWithCredits(person, [], []));
    });
  } catch (error) {
    handleDatabaseError(error, 'getting people for updates');
  }
}
