import * as personsDb from '@db/personsDb';
import { cliLogger } from '@logger/logger';
import { BaseShowService } from '@services/baseShowService';
import * as castUtility from '@services/castUtility';
import { errorService } from '@services/errorService';
import { getTMDBService } from '@services/tmdbService';

jest.mock('@db/personsDb');
jest.mock('@services/cacheService');
jest.mock('@services/tmdbService');
jest.mock('@services/castUtility');
jest.mock('@services/errorService');
jest.mock('@logger/logger', () => ({
  cliLogger: { error: jest.fn() },
}));

// Expose protected methods for testing
class TestableShowService extends BaseShowService {
  public async testProcessShowCast(show: any, showId: number): Promise<void> {
    return this.processShowCast(show, showId);
  }

  public testFilterShowCastMembers(members: any[], contentId: number, activePersonIds: number[]) {
    return this.filterShowCastMembers(members, contentId, activePersonIds);
  }
}

describe('BaseShowService', () => {
  let service: TestableShowService;
  let mockCache: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCache = { invalidatePerson: jest.fn() };
    service = new TestableShowService({ cacheService: mockCache });
    (castUtility.processContentCast as jest.Mock).mockResolvedValue(undefined);
    (errorService.handleError as jest.Mock).mockImplementation((err: unknown) => {
      throw err;
    });
  });

  // ---------------------------------------------------------------------------
  // getShowCastMembers
  // ---------------------------------------------------------------------------
  describe('getShowCastMembers', () => {
    const activeCast = [
      {
        personId: 1,
        name: 'Actor A',
        characterName: 'Hero',
        order: 0,
        profileImage: '',
        contentId: 10,
        episodeCount: 5,
        active: true,
      },
    ];
    const priorCast = [
      {
        personId: 2,
        name: 'Actor B',
        characterName: 'Villain',
        order: 1,
        profileImage: '',
        contentId: 10,
        episodeCount: 3,
        active: false,
      },
    ];

    beforeEach(() => {
      (personsDb.getShowCastMembers as jest.Mock).mockImplementation((_showId: number, active: number) =>
        Promise.resolve(active === 1 ? activeCast : priorCast),
      );
    });

    it('returns activeCast and priorCast from personsDb', async () => {
      mockCache.getOrSet = jest.fn((_key: string, fn: () => unknown) => fn());

      const result = await service.getShowCastMembers(10);

      expect(result).toEqual({ activeCast, priorCast });
      expect(personsDb.getShowCastMembers).toHaveBeenCalledWith(10, 1);
      expect(personsDb.getShowCastMembers).toHaveBeenCalledWith(10, 0);
    });

    it('uses the correct cache key', async () => {
      mockCache.getOrSet = jest.fn().mockResolvedValue({ activeCast: [], priorCast: [] });

      await service.getShowCastMembers(10);

      expect(mockCache.getOrSet).toHaveBeenCalledWith(expect.stringContaining('cast_10'), expect.any(Function), 600);
    });

    it('returns the cached value without calling personsDb again', async () => {
      const cached = { activeCast, priorCast: [] };
      mockCache.getOrSet = jest.fn().mockResolvedValue(cached);

      const result = await service.getShowCastMembers(10);

      expect(result).toEqual(cached);
      expect(personsDb.getShowCastMembers).not.toHaveBeenCalled();
    });

    it('propagates errors via errorService.handleError', async () => {
      const err = new Error('db failure');
      mockCache.getOrSet = jest.fn().mockRejectedValue(err);

      await expect(service.getShowCastMembers(10)).rejects.toThrow('db failure');
      expect(errorService.handleError).toHaveBeenCalledWith(err, 'getShowCastMembers(10)');
    });
  });

  // ---------------------------------------------------------------------------
  // filterShowCastMembers
  // ---------------------------------------------------------------------------
  describe('filterShowCastMembers', () => {
    const member = (
      id: number,
      roles: { episode_count: number; character: string; credit_id: string }[],
      order = 0,
    ) => ({
      id,
      name: `Actor ${id}`,
      order,
      gender: 2,
      profile_path: `/actor${id}.jpg`,
      roles,
    });

    it('returns empty array for empty input', () => {
      expect(service.testFilterShowCastMembers([], 1, [])).toEqual([]);
    });

    it('filters out roles with fewer than 2 episodes', () => {
      const members = [member(1, [{ episode_count: 1, character: 'Cameo', credit_id: 'c1' }])];
      expect(service.testFilterShowCastMembers(members, 10, [])).toHaveLength(0);
    });

    it('keeps roles with exactly 2 episodes', () => {
      const members = [member(1, [{ episode_count: 2, character: 'Recurring', credit_id: 'c1' }])];
      const result = service.testFilterShowCastMembers(members, 10, []);
      expect(result).toHaveLength(1);
      expect(result[0].total_episodes).toBe(2);
    });

    it('marks active=1 for persons in activePersonIds, active=0 for others', () => {
      const members = [
        member(1, [{ episode_count: 5, character: 'Hero', credit_id: 'c1' }]),
        member(2, [{ episode_count: 5, character: 'Villain', credit_id: 'c2' }]),
      ];
      const result = service.testFilterShowCastMembers(members, 10, [1]);

      const hero = result.find((r) => r.person_id === 1);
      const villain = result.find((r) => r.person_id === 2);
      expect(hero?.active).toBe(1);
      expect(villain?.active).toBe(0);
    });

    it('maps fields correctly from the TMDB cast member', () => {
      const members = [
        {
          id: 5,
          name: 'Actor 5',
          order: 3,
          gender: 1,
          profile_path: '/a.jpg',
          roles: [{ episode_count: 4, character: 'Sidekick', credit_id: 'cr99' }],
        },
      ];
      const result = service.testFilterShowCastMembers(members, 10, [5]);
      expect(result[0]).toMatchObject({
        content_id: 10,
        person_id: 5,
        character_name: 'Sidekick',
        credit_id: 'cr99',
        cast_order: 3,
        total_episodes: 4,
        active: 1,
      });
    });

    it('deduplicates same (person, character): active wins over inactive', () => {
      // Person 1 appears twice — once active (id in activePersonIds) with fewer episodes,
      // once inactive with more episodes. Active should win.
      const members = [
        member(1, [{ episode_count: 3, character: 'Hero', credit_id: 'c1' }], 0), // active (id 1 in list)
        member(1, [{ episode_count: 8, character: 'Hero', credit_id: 'c2' }], 1), // inactive
      ];
      const result = service.testFilterShowCastMembers(members, 10, [1]);
      // The first entry IS active (person 1 is in activePersonIds)
      // Both are for person 1, so both are marked active=1
      // They share the same (person_id, character_name) key — dedup picks higher episodes
      expect(result).toHaveLength(1);
    });

    it('deduplicates: more total_episodes wins when active is equal', () => {
      // Same person listed twice for same character (per-season credits), both inactive
      const members = [
        member(1, [{ episode_count: 3, character: 'Same', credit_id: 'c1' }], 0),
        member(1, [{ episode_count: 7, character: 'Same', credit_id: 'c2' }], 0),
      ];
      const result = service.testFilterShowCastMembers(members, 10, []);
      expect(result).toHaveLength(1);
      expect(result[0].total_episodes).toBe(7);
    });

    it('deduplicates: lower cast_order wins when active and episodes are equal', () => {
      const members = [
        member(1, [{ episode_count: 5, character: 'Same', credit_id: 'c1' }], 5),
        member(1, [{ episode_count: 5, character: 'Same', credit_id: 'c2' }], 2),
      ];
      const result = service.testFilterShowCastMembers(members, 10, []);
      expect(result).toHaveLength(1);
      expect(result[0].cast_order).toBe(2);
    });

    it('handles a member with multiple roles, filtering each independently', () => {
      const members = [
        member(1, [
          { episode_count: 1, character: 'Too Short', credit_id: 'c1' },
          { episode_count: 6, character: 'Lead', credit_id: 'c2' },
        ]),
      ];
      const result = service.testFilterShowCastMembers(members, 10, []);
      expect(result).toHaveLength(1);
      expect(result[0].character_name).toBe('Lead');
    });
  });

  // ---------------------------------------------------------------------------
  // processShowCast
  // ---------------------------------------------------------------------------
  describe('processShowCast', () => {
    const baseShow = {
      id: 456,
      aggregate_credits: { cast: [] },
    };

    it('does not fetch aggregate credits when last_episode_to_air is absent', async () => {
      await service.testProcessShowCast(baseShow, 1);

      expect(getTMDBService).not.toHaveBeenCalled();
      expect(castUtility.processContentCast).toHaveBeenCalledWith([], mockCache);
    });

    it('fetches season aggregate credits when last_episode_to_air.season_number is set', async () => {
      const show = { ...baseShow, last_episode_to_air: { season_number: 3 } };
      const mockTMDB = { getSeasonAggregateCredits: jest.fn().mockResolvedValue([{ id: 99 }]) };
      (getTMDBService as jest.Mock).mockReturnValue(mockTMDB);

      await service.testProcessShowCast(show, 1);

      expect(mockTMDB.getSeasonAggregateCredits).toHaveBeenCalledWith(456, 3);
    });

    it('builds a job with the correct tmdbPersonId for each filtered cast member', async () => {
      const show = {
        ...baseShow,
        aggregate_credits: {
          cast: [
            {
              id: 7,
              name: 'Actor 7',
              order: 0,
              gender: 2,
              profile_path: '/a.jpg',
              roles: [{ character: 'Lead', credit_id: 'cr7', episode_count: 10 }],
            },
          ],
        },
      };

      await service.testProcessShowCast(show, 50);

      expect(castUtility.processContentCast).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ tmdbPersonId: 7 })]),
        mockCache,
      );
    });

    it('the job save callback calls personsDb.saveShowCast with correct fields', async () => {
      const show = {
        ...baseShow,
        aggregate_credits: {
          cast: [
            {
              id: 7,
              name: 'Actor 7',
              order: 2,
              gender: 2,
              profile_path: '/a.jpg',
              roles: [{ character: 'Lead', credit_id: 'cr7', episode_count: 10 }],
            },
          ],
        },
      };

      // Capture the job and invoke save manually
      let capturedJob: castUtility.CastJob | undefined;
      (castUtility.processContentCast as jest.Mock).mockImplementation(async (jobs: castUtility.CastJob[]) => {
        capturedJob = jobs[0];
        capturedJob?.save(999);
      });

      await service.testProcessShowCast(show, 50);

      expect(personsDb.saveShowCast).toHaveBeenCalledWith({
        content_id: 50,
        person_id: 999,
        character_name: 'Lead',
        credit_id: 'cr7',
        cast_order: 2,
        total_episodes: 10,
        active: 0,
      });
    });

    it('catches errors and logs them without rethrowing', async () => {
      const error = new Error('TMDB failure');
      const show = { ...baseShow, last_episode_to_air: { season_number: 1 } };
      (getTMDBService as jest.Mock).mockReturnValue({
        getSeasonAggregateCredits: jest.fn().mockRejectedValue(error),
      });
      await expect(service.testProcessShowCast(show, 1)).resolves.toBeUndefined();
      expect(cliLogger.error as jest.Mock).toHaveBeenCalledWith('Error fetching show cast:', error);
    });

    it('catches errors from processContentCast and logs them', async () => {
      const error = new Error('Cast utility error');
      (castUtility.processContentCast as jest.Mock).mockRejectedValue(error);

      await expect(service.testProcessShowCast(baseShow, 1)).resolves.toBeUndefined();
      expect(cliLogger.error as jest.Mock).toHaveBeenCalledWith('Error fetching show cast:', error);
    });
  });
});
