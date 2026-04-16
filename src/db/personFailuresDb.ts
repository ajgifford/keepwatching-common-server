import { PersonUpdateFailureRow, transformPersonFailureRow } from '../types/personTypes';
import { getDbPool } from '../utils/db';
import { DbMonitor } from '../utils/dbMonitoring';
import { handleDatabaseError } from '../utils/errorHandlingUtility';
import { CreatePersonFailure, FailureStatus, PersonUpdateFailure } from '@ajgifford/keepwatching-types';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export async function upsertPersonFailure(data: CreatePersonFailure): Promise<void> {
  try {
    await DbMonitor.getInstance().executeWithTiming(
      'upsertPersonFailure',
      async () => {
        const query = `
          INSERT INTO person_update_failures
            (person_id, tmdb_id, person_name, error_code, error_message, block_number)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            failure_count    = failure_count + 1,
            last_failure_at  = CURRENT_TIMESTAMP,
            error_code       = VALUES(error_code),
            error_message    = VALUES(error_message),
            block_number     = VALUES(block_number),
            status           = IF(status = 'pending', 'pending', status)`;
        await getDbPool().execute<ResultSetHeader>(query, [
          data.personId,
          data.tmdbId,
          data.personName,
          data.errorCode,
          data.errorMessage,
          data.blockNumber,
        ]);
      },
      1000,
      { content: { id: data.personId, type: 'person' } },
    );
  } catch (error) {
    handleDatabaseError(error, 'upserting person update failure');
  }
}

export async function getPersonFailures(
  status?: FailureStatus,
  limit: number = 50,
  offset: number = 0,
): Promise<PersonUpdateFailure[]> {
  try {
    return await DbMonitor.getInstance().executeWithTiming(
      'getPersonFailures',
      async () => {
        const params: (string | number)[] = [];
        let query = 'SELECT * FROM person_update_failures';
        if (status) {
          query += ' WHERE status = ?';
          params.push(status);
        }
        query += ` ORDER BY last_failure_at DESC LIMIT ${limit} OFFSET ${offset}`;
        const [rows] = await getDbPool().execute<PersonUpdateFailureRow[]>(query, params);
        return rows.map(transformPersonFailureRow);
      },
      1000,
    );
  } catch (error) {
    handleDatabaseError(error, 'getting person failures');
  }
}

export async function getPersonFailureCount(status?: FailureStatus): Promise<number> {
  try {
    return await DbMonitor.getInstance().executeWithTiming(
      'getPersonFailureCount',
      async () => {
        const params: string[] = [];
        let query = 'SELECT COUNT(*) as total FROM person_update_failures';
        if (status) {
          query += ' WHERE status = ?';
          params.push(status);
        }
        const [result] = await getDbPool().execute<RowDataPacket[]>(query, params);
        return result[0].total as number;
      },
      1000,
    );
  } catch (error) {
    handleDatabaseError(error, 'getting person failure count');
  }
}

export async function getPersonFailureById(id: number): Promise<PersonUpdateFailure | null> {
  try {
    return await DbMonitor.getInstance().executeWithTiming(
      'getPersonFailureById',
      async () => {
        const query = 'SELECT * FROM person_update_failures WHERE id = ?';
        const [rows] = await getDbPool().execute<PersonUpdateFailureRow[]>(query, [id]);
        if (rows.length === 0) return null;
        return transformPersonFailureRow(rows[0]);
      },
      1000,
      { content: { id, type: 'person' } },
    );
  } catch (error) {
    handleDatabaseError(error, 'getting person failure by id');
  }
}

export async function getPersonFailureByPersonId(personId: number): Promise<PersonUpdateFailure | null> {
  try {
    return await DbMonitor.getInstance().executeWithTiming(
      'getPersonFailureByPersonId',
      async () => {
        const query = 'SELECT * FROM person_update_failures WHERE person_id = ?';
        const [rows] = await getDbPool().execute<PersonUpdateFailureRow[]>(query, [personId]);
        if (rows.length === 0) return null;
        return transformPersonFailureRow(rows[0]);
      },
      1000,
      { content: { id: personId, type: 'person' } },
    );
  } catch (error) {
    handleDatabaseError(error, 'getting person failure by person id');
  }
}

export async function updatePersonFailureStatus(
  personId: number,
  status: FailureStatus,
  notes?: string,
): Promise<void> {
  try {
    await DbMonitor.getInstance().executeWithTiming(
      'updatePersonFailureStatus',
      async () => {
        const query = `
          UPDATE person_update_failures
          SET status = ?, resolution_notes = ?, resolved_at = CURRENT_TIMESTAMP
          WHERE person_id = ?`;
        await getDbPool().execute<ResultSetHeader>(query, [status, notes ?? null, personId]);
      },
      1000,
      { content: { id: personId, type: 'person' } },
    );
  } catch (error) {
    handleDatabaseError(error, 'updating person failure status');
  }
}
