import * as personsDb from '@db/personsDb';
import { CastJob, processContentCast } from '@services/castUtility';
import { getTMDBService } from '@services/tmdbService';

jest.mock('@db/personsDb');
jest.mock('@services/tmdbService');

describe('processContentCast', () => {
  const mockCache = { invalidatePerson: jest.fn() };

  const mockTMDBPerson = {
    id: 101,
    name: 'Jane Actor',
    gender: 1,
    biography: 'Bio text',
    profile_path: '/jane.jpg',
    birthday: '1990-05-01',
    deathday: null,
    place_of_birth: 'New York',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('person already exists in DB', () => {
    it('uses the existing person ID without fetching from TMDB', async () => {
      const saveMock = jest.fn();
      const jobs: CastJob[] = [{ tmdbPersonId: 101, save: saveMock }];

      (personsDb.findPersonByTMDBId as jest.Mock).mockResolvedValue({ id: 42 });

      await processContentCast(jobs, mockCache as any);

      expect(personsDb.findPersonByTMDBId).toHaveBeenCalledWith(101);
      expect(getTMDBService).not.toHaveBeenCalled();
      expect(personsDb.savePerson).not.toHaveBeenCalled();
      expect(saveMock).toHaveBeenCalledWith(42);
    });

    it('invalidates the person cache', async () => {
      const jobs: CastJob[] = [{ tmdbPersonId: 101, save: jest.fn() }];
      (personsDb.findPersonByTMDBId as jest.Mock).mockResolvedValue({ id: 42 });

      await processContentCast(jobs, mockCache as any);

      expect(mockCache.invalidatePerson).toHaveBeenCalledWith(42);
    });
  });

  describe('person not in DB', () => {
    it('fetches from TMDB, saves the person, and uses the new ID', async () => {
      const saveMock = jest.fn();
      const jobs: CastJob[] = [{ tmdbPersonId: 101, save: saveMock }];

      (personsDb.findPersonByTMDBId as jest.Mock).mockResolvedValue(null);
      (getTMDBService as jest.Mock).mockReturnValue({
        getPersonDetails: jest.fn().mockResolvedValue(mockTMDBPerson),
      });
      (personsDb.savePerson as jest.Mock).mockResolvedValue(99);

      await processContentCast(jobs, mockCache as any);

      expect(personsDb.savePerson).toHaveBeenCalledWith({
        tmdb_id: 101,
        name: 'Jane Actor',
        gender: 1,
        biography: 'Bio text',
        profile_image: '/jane.jpg',
        birthdate: '1990-05-01',
        deathdate: null,
        place_of_birth: 'New York',
      });
      expect(saveMock).toHaveBeenCalledWith(99);
      expect(mockCache.invalidatePerson).toHaveBeenCalledWith(99);
    });
  });

  describe('multiple jobs', () => {
    it('processes all jobs in sequence', async () => {
      const save1 = jest.fn();
      const save2 = jest.fn();
      const jobs: CastJob[] = [
        { tmdbPersonId: 1, save: save1 },
        { tmdbPersonId: 2, save: save2 },
      ];

      (personsDb.findPersonByTMDBId as jest.Mock).mockResolvedValueOnce({ id: 10 }).mockResolvedValueOnce({ id: 20 });

      await processContentCast(jobs, mockCache as any);

      expect(personsDb.findPersonByTMDBId).toHaveBeenCalledTimes(2);
      expect(save1).toHaveBeenCalledWith(10);
      expect(save2).toHaveBeenCalledWith(20);
      expect(mockCache.invalidatePerson).toHaveBeenCalledTimes(2);
      expect(mockCache.invalidatePerson).toHaveBeenCalledWith(10);
      expect(mockCache.invalidatePerson).toHaveBeenCalledWith(20);
    });
  });

  describe('empty jobs array', () => {
    it('makes no DB calls', async () => {
      await processContentCast([], mockCache as any);

      expect(personsDb.findPersonByTMDBId).not.toHaveBeenCalled();
      expect(mockCache.invalidatePerson).not.toHaveBeenCalled();
    });
  });

  describe('without cache', () => {
    it('calls job.save but skips invalidatePerson', async () => {
      const saveMock = jest.fn();
      const jobs: CastJob[] = [{ tmdbPersonId: 101, save: saveMock }];

      (personsDb.findPersonByTMDBId as jest.Mock).mockResolvedValue({ id: 42 });

      await processContentCast(jobs);

      expect(saveMock).toHaveBeenCalledWith(42);
      expect(mockCache.invalidatePerson).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('throws when personsDb.findPersonByTMDBId rejects', async () => {
      const jobs: CastJob[] = [{ tmdbPersonId: 101, save: jest.fn() }];
      const error = new Error('DB connection lost');
      (personsDb.findPersonByTMDBId as jest.Mock).mockRejectedValue(error);

      await expect(processContentCast(jobs, mockCache as any)).rejects.toThrow('DB connection lost');
    });

    it('throws when TMDB API fails', async () => {
      const jobs: CastJob[] = [{ tmdbPersonId: 101, save: jest.fn() }];
      (personsDb.findPersonByTMDBId as jest.Mock).mockResolvedValue(null);
      (getTMDBService as jest.Mock).mockReturnValue({
        getPersonDetails: jest.fn().mockRejectedValue(new Error('TMDB error')),
      });

      await expect(processContentCast(jobs, mockCache as any)).rejects.toThrow('TMDB error');
    });
  });
});
