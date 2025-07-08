import {
  MovieCastMemberRow,
  MovieCreditRow,
  PersonReferenceRow,
  PersonRow,
  ShowCastMemberRow,
  ShowCreditRow,
  transformMovieCastMemberRow,
  transformPersonReferenceRow,
  transformPersonRow,
  transformShowCastMemberRow,
} from '../types/personTypes';
import { getDbPool } from '../utils/db';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { TransactionHelper } from '../utils/transactionHelper';
import {
  CastMember,
  CreateCast,
  CreatePerson,
  CreateShowCast,
  Person,
  PersonReference,
  ShowCastMember,
} from '@ajgifford/keepwatching-types';
import { ResultSetHeader } from 'mysql2';

export async function savePerson(createPerson: CreatePerson): Promise<number> {
  try {
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
  } catch (error) {
    handleDatabaseError(error, 'saving a person');
  }
}

export async function saveMovieCast(createCast: CreateCast) {
  try {
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
  } catch (error) {
    handleDatabaseError(error, 'saving a movie cast member');
  }
}

export async function saveShowCast(createCast: CreateShowCast) {
  try {
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
  } catch (error) {
    handleDatabaseError(error, 'saving a show cast member');
  }
}

export async function findPersonById(id: number): Promise<PersonReference | null> {
  try {
    const query = `SELECT id, tmdb_id, name FROM people WHERE id = ?`;
    const [people] = await getDbPool().execute<PersonReferenceRow[]>(query, [id]);
    if (people.length === 0) return null;
    return transformPersonReferenceRow(people[0]);
  } catch (error) {
    handleDatabaseError(error, 'finding a person by id');
  }
}

export async function findPersonByTMDBId(tmdbId: number): Promise<PersonReference | null> {
  try {
    const query = `SELECT id, tmdb_id, name FROM people WHERE tmdb_id = ?`;
    const [people] = await getDbPool().execute<PersonReferenceRow[]>(query, [tmdbId]);
    if (people.length === 0) return null;
    return transformPersonReferenceRow(people[0]);
  } catch (error) {
    handleDatabaseError(error, 'finding a person by TMDB id');
  }
}

export async function getPersonDetails(personId: number): Promise<Person> {
  const transactionHelper = new TransactionHelper();
  try {
    return await transactionHelper.executeInTransaction(async (connection) => {
      const personQuery = 'SELECT * FROM people WHERE id = ?';
      const [people] = await connection.execute<PersonRow[]>(personQuery, [personId]);

      const movieCreditsQuery = 'SELECT * FROM people_movie_credits WHERE person_id = ?';
      const [movieCredits] = await connection.execute<MovieCreditRow[]>(movieCreditsQuery, [personId]);

      const showCreditsQuery = 'SELECT * FROM people_show_credits WHERE person_id = ?';
      const [showCredits] = await connection.execute<ShowCreditRow[]>(showCreditsQuery, [personId]);

      return transformPersonRow(people[0], movieCredits, showCredits);
    });
  } catch (error) {
    handleDatabaseError(error, 'getting a person details');
  }
}

export async function getMovieCastMembers(movieId: number): Promise<CastMember[]> {
  try {
    const query = 'SELECT * FROM movie_cast_members WHERE movie_id = ?';
    const [movies] = await getDbPool().execute<MovieCastMemberRow[]>(query, [movieId]);
    return movies.map(transformMovieCastMemberRow);
  } catch (error) {
    handleDatabaseError(error, `getting a movie's cast members`);
  }
}

export async function getShowCastMembers(showId: number, active: number): Promise<ShowCastMember[]> {
  try {
    const query = 'SELECT * FROM show_cast_members WHERE show_id = ? and active = ?';
    const [shows] = await getDbPool().execute<ShowCastMemberRow[]>(query, [showId, active]);
    return shows.map(transformShowCastMemberRow);
  } catch (error) {
    handleDatabaseError(error, `getting a show's cast members`);
  }
}
