import * as personsDb from '@db/personsDb';
import { cliLogger } from '@logger/logger';
import { BaseMovieService } from '@services/baseMovieService';
import * as castUtility from '@services/castUtility';
import { errorService } from '@services/errorService';

jest.mock('@db/personsDb');
jest.mock('@services/cacheService');
jest.mock('@services/castUtility');
jest.mock('@services/errorService');
jest.mock('@logger/logger', () => ({
  cliLogger: { error: jest.fn() },
}));

// Expose protected method for testing
class TestableMovieService extends BaseMovieService {
  public async testProcessMovieCast(movie: any, movieId: number): Promise<void> {
    return this.processMovieCast(movie, movieId);
  }
}

describe('BaseMovieService', () => {
  let service: TestableMovieService;
  let mockCache: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCache = { invalidatePerson: jest.fn() };
    service = new TestableMovieService({ cacheService: mockCache });
    (castUtility.processContentCast as jest.Mock).mockResolvedValue(undefined);
    (errorService.handleError as jest.Mock).mockImplementation((err: unknown) => {
      throw err;
    });
  });

  // ---------------------------------------------------------------------------
  // getMovieCastMembers
  // ---------------------------------------------------------------------------
  describe('getMovieCastMembers', () => {
    const mockCast = [
      { personId: 1, name: 'Actor A', characterName: 'Hero', order: 0, profileImage: '', contentId: 42 },
    ];

    beforeEach(() => {
      (personsDb.getMovieCastMembers as jest.Mock).mockResolvedValue(mockCast);
    });

    it('returns cast members from personsDb', async () => {
      mockCache.getOrSet = jest.fn((_key: string, fn: () => unknown) => fn());

      const result = await service.getMovieCastMembers(42);

      expect(result).toEqual(mockCast);
      expect(personsDb.getMovieCastMembers).toHaveBeenCalledWith(42);
    });

    it('uses the correct cache key', async () => {
      mockCache.getOrSet = jest.fn().mockResolvedValue([]);

      await service.getMovieCastMembers(42);

      expect(mockCache.getOrSet).toHaveBeenCalledWith(expect.stringContaining('cast_42'), expect.any(Function), 600);
    });

    it('returns the cached value without calling personsDb again', async () => {
      mockCache.getOrSet = jest.fn().mockResolvedValue(mockCast);

      const result = await service.getMovieCastMembers(42);

      expect(result).toEqual(mockCast);
      expect(personsDb.getMovieCastMembers).not.toHaveBeenCalled();
    });

    it('propagates errors via errorService.handleError', async () => {
      const err = new Error('db failure');
      mockCache.getOrSet = jest.fn().mockRejectedValue(err);

      await expect(service.getMovieCastMembers(42)).rejects.toThrow('db failure');
      expect(errorService.handleError).toHaveBeenCalledWith(err, 'getMovieCastMembers(42)');
    });
  });

  // ---------------------------------------------------------------------------
  // processMovieCast
  // ---------------------------------------------------------------------------
  describe('processMovieCast', () => {
    const baseMovie = { credits: { cast: [] } };

    it('calls processContentCast with an empty jobs array for an empty cast', async () => {
      await service.testProcessMovieCast(baseMovie, 1);

      expect(castUtility.processContentCast).toHaveBeenCalledWith([], mockCache);
      expect(personsDb.saveMovieCast).not.toHaveBeenCalled();
    });

    it('uses castMember.id as the tmdbPersonId for each job', async () => {
      const movie = {
        credits: {
          cast: [
            { id: 501, character: 'Hero', credit_id: 'cr1', order: 0 },
            { id: 502, character: 'Villain', credit_id: 'cr2', order: 1 },
          ],
        },
      };

      await service.testProcessMovieCast(movie, 10);

      const [jobs] = (castUtility.processContentCast as jest.Mock).mock.calls[0];
      expect(jobs).toHaveLength(2);
      expect(jobs[0]).toMatchObject({ tmdbPersonId: 501 });
      expect(jobs[1]).toMatchObject({ tmdbPersonId: 502 });
    });

    it('passes the service cache to processContentCast', async () => {
      await service.testProcessMovieCast(baseMovie, 1);

      expect(castUtility.processContentCast).toHaveBeenCalledWith(expect.any(Array), mockCache);
    });

    it('the job save callback calls personsDb.saveMovieCast with correct fields', async () => {
      const movie = {
        credits: {
          cast: [{ id: 501, character: 'Lead', credit_id: 'cr1', order: 3 }],
        },
      };

      // Capture job and invoke save manually
      let capturedJob: castUtility.CastJob | undefined;
      (castUtility.processContentCast as jest.Mock).mockImplementation(async (jobs: castUtility.CastJob[]) => {
        capturedJob = jobs[0];
        capturedJob?.save(777);
      });

      await service.testProcessMovieCast(movie, 20);

      expect(personsDb.saveMovieCast).toHaveBeenCalledWith({
        content_id: 20,
        person_id: 777,
        character_name: 'Lead',
        credit_id: 'cr1',
        cast_order: 3,
      });
    });

    it('handles null/undefined credits.cast gracefully', async () => {
      const movie = { credits: { cast: null } };

      await service.testProcessMovieCast(movie, 1);

      expect(castUtility.processContentCast).toHaveBeenCalledWith([], mockCache);
    });

    it('catches errors from processContentCast and logs them without rethrowing', async () => {
      const error = new Error('Cast utility failure');
      (castUtility.processContentCast as jest.Mock).mockRejectedValue(error);
      await expect(service.testProcessMovieCast(baseMovie, 1)).resolves.toBeUndefined();
      expect(cliLogger.error as jest.Mock).toHaveBeenCalledWith('Error fetching movie cast:', error);
    });
  });
});
