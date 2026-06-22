import { setupDatabaseTest } from './helpers/dbTestSetup';
import * as personFailuresDb from '@db/personFailuresDb';
import { DatabaseError } from '@middleware/errorMiddleware';
import { ResultSetHeader } from 'mysql2';

describe('personFailuresDb Module', () => {
  let mockExecute: jest.Mock;

  const mockFailureRow = {
    id: 1,
    person_id: 100,
    tmdb_id: 9999,
    person_name: 'Bryan Cranston',
    error_code: 'NOT_FOUND',
    error_message: 'Person not found in TMDB',
    block_number: 3,
    failure_count: 2,
    first_failure_at: '2026-01-01T00:00:00.000Z',
    last_failure_at: '2026-01-15T00:00:00.000Z',
    status: 'pending',
    resolution_notes: null,
    resolved_at: null,
  };

  const expectedFailure = {
    id: 1,
    personId: 100,
    tmdbId: 9999,
    personName: 'Bryan Cranston',
    errorCode: 'NOT_FOUND',
    errorMessage: 'Person not found in TMDB',
    blockNumber: 3,
    failureCount: 2,
    firstFailureAt: '2026-01-01T00:00:00.000Z',
    lastFailureAt: '2026-01-15T00:00:00.000Z',
    status: 'pending',
    resolutionNotes: undefined,
    resolvedAt: undefined,
  };

  const createPersonFailure = {
    personId: 100,
    tmdbId: 9999,
    personName: 'Bryan Cranston',
    errorCode: 'NOT_FOUND',
    errorMessage: 'Person not found in TMDB',
    blockNumber: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const mocks = setupDatabaseTest();
    mockExecute = mocks.mockExecute;
  });

  describe('upsertPersonFailure()', () => {
    it('should insert a new failure record', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await personFailuresDb.upsertPersonFailure(createPersonFailure);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('INSERT INTO person_update_failures');
      expect(sql).toContain('ON DUPLICATE KEY UPDATE');
      expect(params).toEqual([100, 9999, 'Bryan Cranston', 'NOT_FOUND', 'Person not found in TMDB', 3]);
    });

    it('should increment failure_count on duplicate key', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 2 } as ResultSetHeader]);

      await personFailuresDb.upsertPersonFailure(createPersonFailure);

      const [sql] = mockExecute.mock.calls[0];
      expect(sql).toContain('failure_count    = failure_count + 1');
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(personFailuresDb.upsertPersonFailure(createPersonFailure)).rejects.toThrow(DatabaseError);
    });
  });

  describe('getPersonFailures()', () => {
    it('should return all failures with no status filter', async () => {
      mockExecute.mockResolvedValue([[mockFailureRow]]);

      const result = await personFailuresDb.getPersonFailures();

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('SELECT * FROM person_update_failures');
      expect(sql).not.toContain('WHERE');
      expect(sql).toContain('ORDER BY last_failure_at DESC LIMIT 50 OFFSET 0');
      expect(params).toEqual([]);
      expect(result).toEqual([expectedFailure]);
    });

    it('should filter by status when provided', async () => {
      mockExecute.mockResolvedValue([[mockFailureRow]]);

      await personFailuresDb.getPersonFailures('pending');

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('WHERE status = ?');
      expect(params).toEqual(['pending']);
    });

    it('should apply custom limit and offset', async () => {
      mockExecute.mockResolvedValue([[mockFailureRow]]);

      await personFailuresDb.getPersonFailures(undefined, 20, 40);

      const [sql] = mockExecute.mock.calls[0];
      expect(sql).toContain('LIMIT 20 OFFSET 40');
    });

    it('should apply both status filter and custom pagination', async () => {
      mockExecute.mockResolvedValue([[mockFailureRow]]);

      await personFailuresDb.getPersonFailures('resolved', 10, 5);

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('WHERE status = ?');
      expect(sql).toContain('LIMIT 10 OFFSET 5');
      expect(params).toEqual(['resolved']);
    });

    it('should return empty array when no failures exist', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await personFailuresDb.getPersonFailures();

      expect(result).toEqual([]);
    });

    it('should map rows with resolution notes and resolved_at set', async () => {
      const resolvedRow = {
        ...mockFailureRow,
        status: 'resolved',
        resolution_notes: 'Fixed manually',
        resolved_at: '2026-02-01T00:00:00.000Z',
      };
      mockExecute.mockResolvedValue([[resolvedRow]]);

      const result = await personFailuresDb.getPersonFailures('resolved');

      expect(result[0].resolutionNotes).toBe('Fixed manually');
      expect(result[0].resolvedAt).toBe('2026-02-01T00:00:00.000Z');
    });

    it('should handle null personId (person deleted via ON DELETE SET NULL)', async () => {
      const rowWithNullPerson = { ...mockFailureRow, person_id: null };
      mockExecute.mockResolvedValue([[rowWithNullPerson]]);

      const result = await personFailuresDb.getPersonFailures();

      expect(result[0].personId).toBeNull();
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(personFailuresDb.getPersonFailures()).rejects.toThrow(DatabaseError);
    });
  });

  describe('getPersonFailureCount()', () => {
    it('should return total count with no status filter', async () => {
      mockExecute.mockResolvedValue([[{ total: 42 }]]);

      const result = await personFailuresDb.getPersonFailureCount();

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('SELECT COUNT(*) as total FROM person_update_failures');
      expect(sql).not.toContain('WHERE');
      expect(params).toEqual([]);
      expect(result).toBe(42);
    });

    it('should return count filtered by status', async () => {
      mockExecute.mockResolvedValue([[{ total: 7 }]]);

      const result = await personFailuresDb.getPersonFailureCount('pending');

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('WHERE status = ?');
      expect(params).toEqual(['pending']);
      expect(result).toBe(7);
    });

    it('should return zero when no matching failures exist', async () => {
      mockExecute.mockResolvedValue([[{ total: 0 }]]);

      const result = await personFailuresDb.getPersonFailureCount('removed');

      expect(result).toBe(0);
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(personFailuresDb.getPersonFailureCount()).rejects.toThrow(DatabaseError);
    });
  });

  describe('getPersonFailureById()', () => {
    it('should return the failure record when found', async () => {
      mockExecute.mockResolvedValue([[mockFailureRow]]);

      const result = await personFailuresDb.getPersonFailureById(1);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toBe('SELECT * FROM person_update_failures WHERE id = ?');
      expect(params).toEqual([1]);
      expect(result).toEqual(expectedFailure);
    });

    it('should return null when no record is found', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await personFailuresDb.getPersonFailureById(999);

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(personFailuresDb.getPersonFailureById(1)).rejects.toThrow(DatabaseError);
    });
  });

  describe('getPersonFailureByPersonId()', () => {
    it('should return the failure record when found by personId', async () => {
      mockExecute.mockResolvedValue([[mockFailureRow]]);

      const result = await personFailuresDb.getPersonFailureByPersonId(100);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toBe('SELECT * FROM person_update_failures WHERE person_id = ?');
      expect(params).toEqual([100]);
      expect(result).toEqual(expectedFailure);
    });

    it('should return null when no record is found for the personId', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await personFailuresDb.getPersonFailureByPersonId(999);

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(personFailuresDb.getPersonFailureByPersonId(100)).rejects.toThrow(DatabaseError);
    });
  });

  describe('updatePersonFailureStatus()', () => {
    it('should update status and resolution notes for a person', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await personFailuresDb.updatePersonFailureStatus(100, 'resolved', 'Fixed via admin panel');

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('UPDATE person_update_failures');
      expect(sql).toContain('SET status = ?, resolution_notes = ?, resolved_at = CURRENT_TIMESTAMP');
      expect(sql).toContain('WHERE person_id = ?');
      expect(params).toEqual(['resolved', 'Fixed via admin panel', 100]);
    });

    it('should pass null for resolution_notes when notes are not provided', async () => {
      mockExecute.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader]);

      await personFailuresDb.updatePersonFailureStatus(100, 'removed');

      const [, params] = mockExecute.mock.calls[0];
      expect(params).toEqual(['removed', null, 100]);
    });

    it('should throw DatabaseError on unexpected database failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection lost'));

      await expect(personFailuresDb.updatePersonFailureStatus(100, 'resolved')).rejects.toThrow(DatabaseError);
    });
  });
});
