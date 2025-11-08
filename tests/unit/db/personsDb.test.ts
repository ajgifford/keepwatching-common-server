import {
  MovieCastMemberRow,
  MovieCreditRow,
  PersonReferenceRow,
  PersonRow,
  ShowCastMemberRow,
  ShowCreditRow,
} from '../../../src/types/personTypes';
import { CreateCast, CreatePerson, CreateShowCast, UpdatePerson } from '@ajgifford/keepwatching-types';
import * as personsDb from '@db/personsDb';
import { handleDatabaseError } from '@utils/errorHandlingUtility';
import { TransactionHelper } from '@utils/transactionHelper';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { type Mock, MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExecute, mockQuery, mockGetDbPool, mockExecuteInTransaction } = vi.hoisted(() => {
  const mockExecute = vi.fn();
  const mockQuery = vi.fn();
  const mockGetDbPool = vi.fn(() => ({
    execute: mockExecute,
    query: mockQuery,
  }));
  const mockExecuteInTransaction = vi.fn();

  return { mockExecute, mockQuery, mockGetDbPool, mockExecuteInTransaction };
});

vi.mock('@utils/db', () => ({
  getDbPool: mockGetDbPool,
}));

vi.mock('@utils/transactionHelper', () => ({
  TransactionHelper: vi.fn(function (this: any) {
    this.executeInTransaction = mockExecuteInTransaction;
  }),
}));

vi.mock('@utils/dbMonitoring', () => ({
  DbMonitor: {
    getInstance: vi.fn(() => ({
      executeWithTiming: vi.fn().mockImplementation(async (_queryName: string, queryFn: () => any) => {
        return await queryFn();
      }),
    })),
  },
}));
const mockHandleDatabaseError = handleDatabaseError as MockedFunction<typeof handleDatabaseError>;

vi.mock('@utils/errorHandlingUtility');

describe('personsDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockExecuteInTransaction.mockImplementation(async (callback) => {
      const mockConnection = {
        execute: mockExecute,
      };
      return callback(mockConnection);
    });

    // Reset handleDatabaseError to throw by default
    mockHandleDatabaseError.mockImplementation((error, context) => {
      throw new Error(`Database error in ${context}: ${error}`);
    });
  });

  describe('savePerson', () => {
    it('should save a person and return the insert ID', async () => {
      const createPerson: CreatePerson = {
        tmdb_id: 123,
        name: 'John Doe',
        gender: 1,
        biography: 'Actor biography',
        profile_image: 'image.jpg',
        birthdate: '1980-01-01',
        deathdate: null,
        place_of_birth: 'New York',
      };

      const mockResult = {
        insertId: 456,
        affectedRows: 1,
        fieldCount: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await personsDb.savePerson(createPerson);

      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO people (tmdb_id, name, gender, biography, profile_image, birthdate, deathdate, place_of_birth) VALUES (?,?,?,?,?,?,?,?)',
        [123, 'John Doe', 1, 'Actor biography', 'image.jpg', '1980-01-01', null, 'New York'],
      );
      expect(result).toBe(456);
    });

    it('should handle database errors', async () => {
      const createPerson: CreatePerson = {
        tmdb_id: 123,
        name: 'John Doe',
        gender: 1,
        biography: 'Actor biography',
        profile_image: 'image.jpg',
        birthdate: '1980-01-01',
        deathdate: null,
        place_of_birth: 'New York',
      };

      const error = new Error('Database error');
      mockExecute.mockRejectedValue(error);

      await expect(personsDb.savePerson(createPerson)).rejects.toThrow(
        'Database error in saving a person: Error: Database error',
      );
      expect(mockHandleDatabaseError).toHaveBeenCalledWith(error, 'saving a person');
    });
  });

  describe('updatePerson', () => {
    it('should update a person and return true when rows are affected', async () => {
      const updatePerson: UpdatePerson = {
        id: 456,
        tmdb_id: 123,
        name: 'Jane Doe',
        gender: 2,
        biography: 'Updated biography',
        profile_image: 'new-image.jpg',
        birthdate: '1985-02-02',
        deathdate: null,
        place_of_birth: 'Los Angeles',
      };

      const mockResult = {
        insertId: 0,
        affectedRows: 1,
        fieldCount: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 1,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await personsDb.updatePerson(updatePerson);

      expect(mockExecute).toHaveBeenCalledWith(
        'UPDATE people SET name = ?, gender = ?, biography = ?, profile_image = ?, birthdate = ?, deathdate = ?, place_of_birth = ? WHERE id = ?',
        ['Jane Doe', 2, 'Updated biography', 'new-image.jpg', '1985-02-02', null, 'Los Angeles', 456],
      );
      expect(result).toBe(true);
    });

    it('should return false when no rows are affected', async () => {
      const updatePerson: UpdatePerson = {
        id: 999,
        tmdb_id: 456,
        name: 'Non-existent Person',
        gender: 1,
        biography: 'Biography',
        profile_image: 'image.jpg',
        birthdate: '1990-01-01',
        deathdate: null,
        place_of_birth: 'Unknown',
      };

      const mockResult = {
        insertId: 0,
        affectedRows: 0,
        fieldCount: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
      } as ResultSetHeader;

      mockExecute.mockResolvedValue([mockResult]);

      const result = await personsDb.updatePerson(updatePerson);

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      const updatePerson: UpdatePerson = {
        id: 456,
        tmdb_id: 123,
        name: 'Jane Doe',
        gender: 2,
        biography: 'Updated biography',
        profile_image: 'new-image.jpg',
        birthdate: '1985-02-02',
        deathdate: null,
        place_of_birth: 'Los Angeles',
      };

      const error = new Error('Database error');
      mockExecute.mockRejectedValue(error);

      await expect(personsDb.updatePerson(updatePerson)).rejects.toThrow(
        'Database error in updating a person: Error: Database error',
      );
      expect(mockHandleDatabaseError).toHaveBeenCalledWith(error, 'updating a person');
    });
  });

  describe('saveMovieCast', () => {
    it('should save a movie cast member and return true', async () => {
      const createCast: CreateCast = {
        content_id: 1,
        person_id: 2,
        credit_id: 'credit123',
        character_name: 'Main Character',
        cast_order: 1,
      };

      mockExecute.mockResolvedValue([{}]);

      const result = await personsDb.saveMovieCast(createCast);

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO movie_cast'), [
        1,
        2,
        'credit123',
        'Main Character',
        1,
      ]);
      expect(result).toBe(true);
    });

    it('should handle database errors', async () => {
      const createCast: CreateCast = {
        content_id: 1,
        person_id: 2,
        credit_id: 'credit123',
        character_name: 'Main Character',
        cast_order: 1,
      };

      const error = new Error('Database error');
      mockExecute.mockRejectedValue(error);

      await expect(personsDb.saveMovieCast(createCast)).rejects.toThrow(
        'Database error in saving a movie cast member: Error: Database error',
      );
      expect(mockHandleDatabaseError).toHaveBeenCalledWith(error, 'saving a movie cast member');
    });
  });

  describe('saveShowCast', () => {
    it('should save a show cast member and return true', async () => {
      const createCast: CreateShowCast = {
        content_id: 1,
        person_id: 2,
        credit_id: 'credit123',
        character_name: 'Main Character',
        total_episodes: 10,
        cast_order: 1,
        active: 1,
      };

      mockExecute.mockResolvedValue([{}]);

      const result = await personsDb.saveShowCast(createCast);

      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO show_cast'), [
        1,
        2,
        'credit123',
        'Main Character',
        10,
        1,
        1,
      ]);
      expect(result).toBe(true);
    });

    it('should handle database errors', async () => {
      const createCast: CreateShowCast = {
        content_id: 1,
        person_id: 2,
        credit_id: 'credit123',
        character_name: 'Main Character',
        total_episodes: 10,
        cast_order: 1,
        active: 1,
      };

      const error = new Error('Database error');
      mockExecute.mockRejectedValue(error);

      await expect(personsDb.saveShowCast(createCast)).rejects.toThrow(
        'Database error in saving a show cast member: Error: Database error',
      );
      expect(mockHandleDatabaseError).toHaveBeenCalledWith(error, 'saving a show cast member');
    });
  });

  describe('findPersonById', () => {
    it('should find a person by ID and return PersonReference', async () => {
      const mockPersonRow: PersonReferenceRow = {
        id: 123,
        tmdb_id: 456,
        name: 'John Doe',
      } as PersonReferenceRow;

      mockExecute.mockResolvedValue([[mockPersonRow]]);

      const result = await personsDb.findPersonById(123);

      expect(mockExecute).toHaveBeenCalledWith('SELECT id, tmdb_id, name FROM people WHERE id = ?', [123]);
      expect(result).toEqual({
        id: 123,
        tmdbId: 456,
        name: 'John Doe',
      });
    });

    it('should return null when person is not found', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await personsDb.findPersonById(999);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockExecute.mockRejectedValue(error);

      await expect(personsDb.findPersonById(123)).rejects.toThrow(
        'Database error in finding a person by id: Error: Database error',
      );
      expect(mockHandleDatabaseError).toHaveBeenCalledWith(error, 'finding a person by id');
    });
  });

  describe('findPersonByTMDBId', () => {
    it('should find a person by TMDB ID and return PersonReference', async () => {
      const mockPersonRow: PersonReferenceRow = {
        id: 123,
        tmdb_id: 456,
        name: 'John Doe',
      } as PersonReferenceRow;

      mockExecute.mockResolvedValue([[mockPersonRow]]);

      const result = await personsDb.findPersonByTMDBId(456);

      expect(mockExecute).toHaveBeenCalledWith('SELECT id, tmdb_id, name FROM people WHERE tmdb_id = ?', [456]);
      expect(result).toEqual({
        id: 123,
        tmdbId: 456,
        name: 'John Doe',
      });
    });

    it('should return null when person is not found', async () => {
      mockExecute.mockResolvedValue([[]]);

      const result = await personsDb.findPersonByTMDBId(999);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockExecute.mockRejectedValue(error);

      await expect(personsDb.findPersonByTMDBId(456)).rejects.toThrow(
        'Database error in finding a person by TMDB id: Error: Database error',
      );
      expect(mockHandleDatabaseError).toHaveBeenCalledWith(error, 'finding a person by TMDB id');
    });
  });

  describe('getPersonDetails', () => {
    it('should get person details with credits', async () => {
      const mockConnectionExecute = vi.fn();

      const mockTransactionInstance = {
        executeInTransaction: vi.fn().mockImplementation(async (callback) => {
          return callback({ execute: mockConnectionExecute });
        }),
      };

      (TransactionHelper as unknown as Mock).mockImplementation(function () {
        return mockTransactionInstance;
      });

      mockConnectionExecute.mockResolvedValueOnce([
        [
          {
            id: 123,
            name: 'John Doe',
            tmdb_id: 456,
            gender: 1,
            biography: 'Biography',
            profile_image: 'image.jpg',
            birthdate: '1980-01-01',
            deathdate: null,
            place_of_birth: 'New York',
            created_at: '2024-01-01',
            updated_at: '2024-01-01',
          } as PersonRow,
        ],
      ]);
      mockConnectionExecute.mockResolvedValueOnce([
        [
          {
            movie_id: 1,
            person_id: 123,
            character_name: 'Hero',
            title: 'Great Movie',
            poster_image: 'poster.jpg',
            release_date: '2024-01-01',
            rating: 8.5,
          } as MovieCreditRow,
        ],
      ]);
      mockConnectionExecute.mockResolvedValueOnce([
        [
          {
            show_id: 1,
            person_id: 123,
            character_name: 'Lead',
            title: 'Great Show',
            poster_image: 'show-poster.jpg',
            release_date: '2024-01-01',
            rating: 9.0,
            total_episodes: 10,
          } as ShowCreditRow,
        ],
      ]);

      const result = await personsDb.getPersonDetails(123);

      expect(mockConnectionExecute).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        id: 123,
        tmdbId: 456,
        name: 'John Doe',
        gender: 1,
        biography: 'Biography',
        profileImage: 'image.jpg',
        birthdate: '1980-01-01',
        deathdate: null,
        placeOfBirth: 'New York',
        movieCredits: [
          {
            name: 'Great Movie',
            poster: 'poster.jpg',
            year: '2024',
            character: 'Hero',
            rating: 8.5,
          },
        ],
        showCredits: [
          {
            name: 'Great Show',
            poster: 'show-poster.jpg',
            year: '2024',
            character: 'Lead',
            rating: 9.0,
            episodeCount: 10,
          },
        ],
      });
    });

    it('should handle database errors', async () => {
      const mockTransactionInstance = {
        executeInTransaction: vi.fn().mockRejectedValue(new Error('Database error')),
      };

      (TransactionHelper as unknown as Mock).mockImplementation(function () {
        return mockTransactionInstance;
      });

      const error = new Error('Database error');

      await expect(personsDb.getPersonDetails(123)).rejects.toThrow(
        'Database error in getting a person details: Error: Database error',
      );
      expect(mockHandleDatabaseError).toHaveBeenCalledWith(error, 'getting a person details');
    });
  });

  describe('getMovieCastMembers', () => {
    it('should get movie cast members', async () => {
      const mockCastRows: MovieCastMemberRow[] = [
        {
          movie_id: 1,
          person_id: 1,
          character_name: 'Hero',
          cast_order: 1,
          name: 'John Doe',
          profile_image: 'john.jpg',
        } as MovieCastMemberRow,
        {
          movie_id: 1,
          person_id: 2,
          character_name: 'Villain',
          cast_order: 2,
          name: 'Jane Smith',
          profile_image: 'jane.jpg',
        } as MovieCastMemberRow,
      ];

      mockExecute.mockResolvedValue([mockCastRows]);

      const result = await personsDb.getMovieCastMembers(1);

      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM movie_cast_members WHERE movie_id = ?', [1]);
      expect(result).toEqual([
        {
          contentId: 1,
          personId: 1,
          characterName: 'Hero',
          order: 1,
          name: 'John Doe',
          profileImage: 'john.jpg',
        },
        {
          contentId: 1,
          personId: 2,
          characterName: 'Villain',
          order: 2,
          name: 'Jane Smith',
          profileImage: 'jane.jpg',
        },
      ]);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockExecute.mockRejectedValue(error);

      await expect(personsDb.getMovieCastMembers(1)).rejects.toThrow(
        "Database error in getting a movie's cast members: Error: Database error",
      );
      expect(mockHandleDatabaseError).toHaveBeenCalledWith(error, `getting a movie's cast members`);
    });
  });

  describe('getShowCastMembers', () => {
    it('should get show cast members', async () => {
      const mockCastRows: ShowCastMemberRow[] = [
        {
          show_id: 1,
          person_id: 1,
          character_name: 'Lead',
          cast_order: 1,
          total_episodes: 10,
          active: 1,
          name: 'John Doe',
          profile_image: 'john.jpg',
        } as ShowCastMemberRow,
      ];

      mockExecute.mockResolvedValue([mockCastRows]);

      const result = await personsDb.getShowCastMembers(1, 1);

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM show_cast_members WHERE show_id = ? and active = ?',
        [1, 1],
      );
      expect(result).toEqual([
        {
          contentId: 1,
          personId: 1,
          characterName: 'Lead',
          order: 1,
          episodeCount: 10,
          active: true,
          name: 'John Doe',
          profileImage: 'john.jpg',
        },
      ]);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockExecute.mockRejectedValue(error);

      await expect(personsDb.getShowCastMembers(1, 1)).rejects.toThrow(
        "Database error in getting a show's cast members: Error: Database error",
      );
      expect(mockHandleDatabaseError).toHaveBeenCalledWith(error, `getting a show's cast members`);
    });
  });

  describe('getPerson', () => {
    it('should get a person by ID', async () => {
      const mockPersonRow: PersonRow = {
        id: 123,
        name: 'John Doe',
        tmdb_id: 456,
        gender: 1,
        biography: 'Biography',
        profile_image: 'image.jpg',
        birthdate: '1980-01-01',
        deathdate: null,
        place_of_birth: 'New York',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as PersonRow;

      mockExecute.mockResolvedValue([[mockPersonRow]]);

      const result = await personsDb.getPerson(123);

      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM people WHERE id = ?', [123]);
      expect(result).toEqual({
        id: 123,
        name: 'John Doe',
        tmdbId: 456,
        gender: 1,
        biography: 'Biography',
        profileImage: 'image.jpg',
        birthdate: '1980-01-01',
        deathdate: null,
        placeOfBirth: 'New York',
      });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockExecute.mockRejectedValue(error);

      await expect(personsDb.getPerson(123)).rejects.toThrow('Database error in getting person: Error: Database error');
      expect(mockHandleDatabaseError).toHaveBeenCalledWith(error, 'getting person');
    });
  });

  describe('getPersons', () => {
    it('should get persons with default pagination', async () => {
      const mockPersonRows: PersonRow[] = [
        {
          id: 1,
          name: 'Alice',
          tmdb_id: 123,
          gender: 2,
          biography: 'Bio',
          profile_image: 'alice.jpg',
          birthdate: '1990-01-01',
          deathdate: null,
          place_of_birth: 'City',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        } as PersonRow,
        {
          id: 2,
          name: 'Albert',
          tmdb_id: 124,
          gender: 1,
          biography: 'Bio',
          profile_image: 'albert.jpg',
          birthdate: '1985-01-01',
          deathdate: null,
          place_of_birth: 'Town',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        } as PersonRow,
      ];

      mockExecute.mockResolvedValue([mockPersonRows]);

      const result = await personsDb.getPersons('A');

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM people WHERE UPPER(LEFT(name, 1)) = UPPER(?) ORDER BY name ASC LIMIT 50 OFFSET 0',
        ['A'],
      );
      expect(result).toEqual([
        {
          id: 1,
          name: 'Alice',
          tmdbId: 123,
          gender: 2,
          biography: 'Bio',
          profileImage: 'alice.jpg',
          birthdate: '1990-01-01',
          deathdate: null,
          placeOfBirth: 'City',
          lastUpdated: '2024-01-01',
        },
        {
          id: 2,
          name: 'Albert',
          tmdbId: 124,
          gender: 1,
          biography: 'Bio',
          profileImage: 'albert.jpg',
          birthdate: '1985-01-01',
          deathdate: null,
          placeOfBirth: 'Town',
          lastUpdated: '2024-01-01',
        },
      ]);
    });

    it('should get persons with custom pagination', async () => {
      const mockPersonRows: PersonRow[] = [
        {
          id: 1,
          name: 'Alice',
          tmdb_id: 123,
          gender: 2,
          biography: 'Bio',
          profile_image: 'alice.jpg',
          birthdate: '1990-01-01',
          deathdate: null,
          place_of_birth: 'City',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        } as PersonRow,
      ];

      mockExecute.mockResolvedValue([mockPersonRows]);

      const result = await personsDb.getPersons('A', 10, 20);

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM people WHERE UPPER(LEFT(name, 1)) = UPPER(?) ORDER BY name ASC LIMIT 20 OFFSET 10',
        ['A'],
      );
      expect(result).toEqual([
        {
          id: 1,
          name: 'Alice',
          tmdbId: 123,
          gender: 2,
          biography: 'Bio',
          profileImage: 'alice.jpg',
          birthdate: '1990-01-01',
          deathdate: null,
          placeOfBirth: 'City',
          lastUpdated: '2024-01-01',
        },
      ]);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockExecute.mockRejectedValue(error);

      await expect(personsDb.getPersons('A')).rejects.toThrow(
        'Database error in getting persons with pagination: Error: Database error',
      );
      expect(mockHandleDatabaseError).toHaveBeenCalledWith(error, 'getting persons with pagination');
    });
  });

  describe('getPersonsAlphaCount', () => {
    it('should get count of persons by first letter', async () => {
      const mockResult = [{ total: 42 }] as RowDataPacket[];
      mockExecute.mockResolvedValue([mockResult]);

      const result = await personsDb.getPersonsAlphaCount('A');

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT COUNT(*) as total FROM people WHERE UPPER(LEFT(name, 1)) = UPPER(?)',
        ['A'],
      );
      expect(result).toBe(42);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockExecute.mockRejectedValue(error);

      await expect(personsDb.getPersonsAlphaCount('A')).rejects.toThrow(
        'Database error in getting persons count for alpha: Error: Database error',
      );
      expect(mockHandleDatabaseError).toHaveBeenCalledWith(error, 'getting persons count for alpha');
    });
  });

  describe('getPersonsCount', () => {
    it('should get total count of persons', async () => {
      const mockResult = [{ total: 1000 }] as RowDataPacket[];
      mockExecute.mockResolvedValue([mockResult]);

      const result = await personsDb.getPersonsCount();

      expect(mockExecute).toHaveBeenCalledWith('SELECT COUNT(*) as total FROM people');
      expect(result).toBe(1000);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockExecute.mockRejectedValue(error);

      await expect(personsDb.getPersonsCount()).rejects.toThrow(
        'Database error in getting persons count: Error: Database error',
      );
      expect(mockHandleDatabaseError).toHaveBeenCalledWith(error, 'getting persons count');
    });
  });

  describe('getPeopleForUpdates', () => {
    it('should get people for updates', async () => {
      const mockPersonRows: PersonRow[] = [
        {
          id: 1,
          name: 'John Doe',
          tmdb_id: 123,
          gender: 1,
          biography: 'Bio',
          profile_image: 'john.jpg',
          birthdate: '1980-01-01',
          deathdate: null,
          place_of_birth: 'NYC',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        } as PersonRow,
        {
          id: 13,
          name: 'Jane Smith',
          tmdb_id: 456,
          gender: 2,
          biography: 'Bio',
          profile_image: 'jane.jpg',
          birthdate: '1985-01-01',
          deathdate: null,
          place_of_birth: 'LA',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        } as PersonRow,
      ];

      // Mock Date to have consistent test results
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01'));

      mockQuery.mockResolvedValue([mockPersonRows]);

      const result = await personsDb.getPeopleForUpdates(1);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM people'), [1, '2023-01-01']);
      expect(result).toEqual([
        {
          id: 1,
          name: 'John Doe',
          tmdbId: 123,
          gender: 1,
          biography: 'Bio',
          profileImage: 'john.jpg',
          birthdate: '1980-01-01',
          deathdate: null,
          placeOfBirth: 'NYC',
          movieCredits: [],
          showCredits: [],
        },
        {
          id: 13,
          name: 'Jane Smith',
          tmdbId: 456,
          gender: 2,
          biography: 'Bio',
          profileImage: 'jane.jpg',
          birthdate: '1985-01-01',
          deathdate: null,
          placeOfBirth: 'LA',
          movieCredits: [],
          showCredits: [],
        },
      ]);

      // Restore real timers
      vi.useRealTimers();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockQuery.mockRejectedValue(error);

      await expect(personsDb.getPeopleForUpdates(1)).rejects.toThrow(
        'Database error in getting people for updates: Error: Database error',
      );
      expect(mockHandleDatabaseError).toHaveBeenCalledWith(error, 'getting people for updates');
    });
  });
});
