import * as profilesDb from '@db/profilesDb';
import { BadRequestError, NotFoundError } from '@middleware/errorMiddleware';
import { episodesService } from '@services/episodesService';
import { errorService } from '@services/errorService';
import { moviesService } from '@services/moviesService';
import { ProfileService, createProfileService, resetProfileService } from '@services/profileService';
import { showService } from '@services/showService';
import { getProfileImage } from '@utils/imageUtility';

jest.mock('@db/profilesDb');
jest.mock('@services/errorService');
jest.mock('@services/episodesService');
jest.mock('@services/moviesService');
jest.mock('@services/showService');
jest.mock('@utils/imageUtility');

describe('ProfileService', () => {
  let service: ProfileService;
  let mockCache: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    resetProfileService();

    mockCache = {
      getOrSet: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
      invalidatePattern: jest.fn(),
      invalidateAccount: jest.fn(),
      invalidateProfile: jest.fn(),
      invalidateProfileStatistics: jest.fn(),
      invalidateAccountStatistics: jest.fn(),
      flushAll: jest.fn(),
      getStats: jest.fn(),
      keys: jest.fn(),
    } as any;

    service = createProfileService({ cacheService: mockCache });

    (getProfileImage as jest.Mock).mockReturnValue('profile-image-url.jpg');

    (errorService.handleError as jest.Mock).mockImplementation((error) => {
      throw error;
    });
  });

  afterEach(() => {
    resetProfileService();
    jest.resetModules();
  });

  describe('getProfilesByAccountId', () => {
    it('should return profiles from cache when available', async () => {
      const mockProfiles = [
        { id: 1, name: 'Profile 1', image: 'profile1.jpg' },
        { id: 2, name: 'Profile 2', image: 'profile2.jpg' },
      ];
      mockCache.getOrSet.mockResolvedValue(mockProfiles);

      const result = await service.getProfilesByAccountId(123);

      expect(mockCache.getOrSet).toHaveBeenCalledWith('account_123_profiles', expect.any(Function), 600);
      expect(result).toEqual(mockProfiles);
    });

    it('should fetch profiles from database when not in cache', async () => {
      const mockDBProfiles = [
        { id: 1, name: 'Profile 1', account_id: 123 },
        { id: 2, name: 'Profile 2', account_id: 123 },
      ];
      const expectedProfiles = [
        { account_id: 123, id: 1, name: 'Profile 1', image: 'profile-image-url.jpg' },
        { account_id: 123, id: 2, name: 'Profile 2', image: 'profile-image-url.jpg' },
      ];

      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());
      (profilesDb.getProfilesByAccountId as jest.Mock).mockResolvedValue(mockDBProfiles);

      const result = await service.getProfilesByAccountId(123);

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(profilesDb.getProfilesByAccountId).toHaveBeenCalledWith(123);
      expect(result).toEqual(expectedProfiles);
    });

    it('should throw BadRequestError when profiles cannot be retrieved', async () => {
      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());
      (profilesDb.getProfilesByAccountId as jest.Mock).mockResolvedValue(null);

      await expect(service.getProfilesByAccountId(123)).rejects.toThrow(BadRequestError);
      expect(profilesDb.getProfilesByAccountId).toHaveBeenCalledWith(123);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());
      (profilesDb.getProfilesByAccountId as jest.Mock).mockRejectedValue(error);

      await expect(service.getProfilesByAccountId(123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getProfilesByAccountId(123)');
    });
  });

  describe('getAdminProfilesByAccountId', () => {
    it('should return admin profiles from cache when available', async () => {
      const mockProfiles = [
        {
          id: 1,
          name: 'Profile 1',
          image: 'profile1.jpg',
          createdAt: '2025-02-01',
          favoritedShows: 20,
          favoritedMovies: 5,
        },
        {
          id: 2,
          name: 'Profile 2',
          image: 'profile2.jpg',
          createdAt: '2025-02-05',
          favoritedShows: 18,
          favoritedMovies: 6,
        },
      ];
      mockCache.getOrSet.mockResolvedValue(mockProfiles);

      const result = await service.getAdminProfilesByAccount(123);

      expect(mockCache.getOrSet).toHaveBeenCalledWith('account_123_adminProfiles', expect.any(Function), 600);
      expect(result).toEqual(mockProfiles);
    });

    it('should fetch admin profiles from database when not in cache', async () => {
      const mockDBProfiles = [
        { id: 1, name: 'Profile 1', account_id: 123 },
        { id: 2, name: 'Profile 2', account_id: 123 },
      ];
      const expectedProfiles = [
        { account_id: 123, id: 1, name: 'Profile 1', image: 'profile-image-url.jpg' },
        { account_id: 123, id: 2, name: 'Profile 2', image: 'profile-image-url.jpg' },
      ];

      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());
      (profilesDb.getAdminProfilesByAccountId as jest.Mock).mockResolvedValue(mockDBProfiles);

      const result = await service.getAdminProfilesByAccount(123);

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(profilesDb.getAdminProfilesByAccountId).toHaveBeenCalledWith(123);
      expect(result).toEqual(expectedProfiles);
    });

    it('should throw BadRequestError when admin profiles cannot be retrieved', async () => {
      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());
      (profilesDb.getAdminProfilesByAccountId as jest.Mock).mockResolvedValue(null);

      await expect(service.getAdminProfilesByAccount(123)).rejects.toThrow(BadRequestError);
      expect(profilesDb.getAdminProfilesByAccountId).toHaveBeenCalledWith(123);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());
      (profilesDb.getAdminProfilesByAccountId as jest.Mock).mockRejectedValue(error);

      await expect(service.getAdminProfilesByAccount(123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getAdminProfilesByAccountId(123)');
    });
  });

  describe('getProfile', () => {
    const mockProfile = { id: 123, name: 'Test Profile', accountId: 1 };
    const mockShows = [{ show_id: 1, title: 'Test Show' }];
    const mockMovies = [{ movie_id: 1, title: 'Test Movie' }];
    const mockRecentEpisodes = [{ id: 1, title: 'Recent Episode' }];
    const mockUpcomingEpisodes = [{ id: 2, title: 'Upcoming Episode' }];
    const mockNextUnwatchedEpisodes = [{ show_id: 1, episodes: [{ id: 3 }] }];
    const mockRecentMovies = [{ movie_id: 2, title: 'Recent Movie' }];
    const mockUpcomingMovies = [{ movie_id: 3, title: 'Upcoming Movie' }];

    it('should return profile data from cache when available', async () => {
      const mockProfileData = {
        profile: { id: 123, name: 'Test Profile', image: 'profile.jpg' },
        shows: mockShows,
        movies: mockMovies,
        recentEpisodes: mockRecentEpisodes,
        upcomingEpisodes: mockUpcomingEpisodes,
        nextUnwatchedEpisodes: mockNextUnwatchedEpisodes,
        recentMovies: mockRecentMovies,
        upcomingMovies: mockUpcomingMovies,
      };

      mockCache.getOrSet.mockResolvedValue(mockProfileData);

      const result = await service.getProfileWithContent(123);

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123_complete', expect.any(Function), 600);
      expect(result).toEqual(mockProfileData);
    });

    it('should fetch and combine profile data when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());

      (profilesDb.findProfileById as jest.Mock).mockResolvedValue(mockProfile);
      (showService.getShowsForProfile as jest.Mock).mockResolvedValue(mockShows);
      (moviesService.getMoviesForProfile as jest.Mock).mockResolvedValue(mockMovies);
      (episodesService.getRecentEpisodesForProfile as jest.Mock).mockResolvedValue(mockRecentEpisodes);
      (episodesService.getUpcomingEpisodesForProfile as jest.Mock).mockResolvedValue(mockUpcomingEpisodes);
      (showService.getNextUnwatchedEpisodesForProfile as jest.Mock).mockResolvedValue(mockNextUnwatchedEpisodes);
      (moviesService.getRecentMoviesForProfile as jest.Mock).mockResolvedValue(mockRecentMovies);
      (moviesService.getUpcomingMoviesForProfile as jest.Mock).mockResolvedValue(mockUpcomingMovies);

      const result = await service.getProfileWithContent(123);

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(profilesDb.findProfileById).toHaveBeenCalledWith(123);
      expect(showService.getShowsForProfile).toHaveBeenCalledWith(123);
      expect(moviesService.getMoviesForProfile).toHaveBeenCalledWith(123);
      expect(episodesService.getRecentEpisodesForProfile).toHaveBeenCalledWith(123);
      expect(episodesService.getUpcomingEpisodesForProfile).toHaveBeenCalledWith(123);
      expect(showService.getNextUnwatchedEpisodesForProfile).toHaveBeenCalledWith(123);

      expect(result).toEqual({
        profile: { id: 123, accountId: 1, name: 'Test Profile', image: 'profile-image-url.jpg' },
        shows: mockShows,
        movies: mockMovies,
        episodes: {
          recentEpisodes: mockRecentEpisodes,
          upcomingEpisodes: mockUpcomingEpisodes,
          nextUnwatchedEpisodes: mockNextUnwatchedEpisodes,
        },
        recentUpcomingMovies: { recentMovies: mockRecentMovies, upcomingMovies: mockUpcomingMovies },
      });
    });

    it('should throw NotFoundError when profile does not exist', async () => {
      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());
      (profilesDb.findProfileById as jest.Mock).mockResolvedValue(null);

      await expect(service.getProfileWithContent(999)).rejects.toThrow(NotFoundError);
      expect(profilesDb.findProfileById).toHaveBeenCalledWith(999);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());
      (profilesDb.findProfileById as jest.Mock).mockRejectedValue(error);

      await expect(service.getProfileWithContent(123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'getProfile(123)');
    });
  });

  describe('findProfileById', () => {
    it('should return profile data from cache when available', async () => {
      const mockProfileData = {
        id: 123,
        name: 'Test Profile',
        account_id: 1,
        image: 'profile-image.jpg',
      };

      mockCache.getOrSet.mockResolvedValue(mockProfileData);

      const result = await service.findProfileById(123);

      expect(mockCache.getOrSet).toHaveBeenCalledWith('profile_123', expect.any(Function), 600);
      expect(result).toEqual(mockProfileData);
    });

    it('should fetch profile data when not in cache', async () => {
      const mockProfile = {
        id: 123,
        name: 'Test Profile',
        account_id: 1,
      };

      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());
      (profilesDb.findProfileById as jest.Mock).mockResolvedValue(mockProfile);

      const result = await service.findProfileById(123);

      expect(mockCache.getOrSet).toHaveBeenCalled();
      expect(profilesDb.findProfileById).toHaveBeenCalledWith(123);
      expect(result).toEqual({
        id: 123,
        name: 'Test Profile',
        account_id: 1,
        image: 'profile-image-url.jpg',
      });
    });

    it('should return null when profile does not exist', async () => {
      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());
      (profilesDb.findProfileById as jest.Mock).mockResolvedValue(null);

      const result = await service.findProfileById(999);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.getOrSet.mockImplementation(async (_key: any, fn: () => any) => fn());
      (profilesDb.findProfileById as jest.Mock).mockRejectedValue(error);

      await expect(service.findProfileById(123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'findProfileById(123)');
    });
  });

  describe('createProfile', () => {
    it('should add a profile successfully', async () => {
      (profilesDb.saveProfile as jest.Mock).mockResolvedValue(456);

      const result = await service.createProfile(123, 'New Profile');

      expect(profilesDb.saveProfile).toHaveBeenCalled();
      expect(mockCache.invalidate).toHaveBeenCalledWith('account_123_profiles');
      expect(mockCache.invalidateAccount).toHaveBeenCalledWith(123);
      expect(result).toEqual({
        accountId: 123,
        id: 456,
        name: 'New Profile',
        image: 'profile-image-url.jpg',
      });
    });

    it('should throw BadRequestError when profile creation fails', async () => {
      (profilesDb.saveProfile as jest.Mock).mockResolvedValue(0);

      await expect(service.createProfile(123, 'New Profile')).rejects.toThrow(BadRequestError);

      expect(profilesDb.saveProfile).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (profilesDb.saveProfile as jest.Mock).mockRejectedValue(error);

      await expect(service.createProfile(123, 'New Profile')).rejects.toThrow('Database error');

      expect(errorService.handleError).toHaveBeenCalledWith(error, 'createProfile(123, New Profile)');
    });
  });

  describe('updateProfileName', () => {
    const mockProfile = {
      id: 123,
      name: 'Original Profile',
      accountId: 1,
    };

    const mockUpdatedProfile = {
      id: 123,
      name: 'Updated Profile',
      accountId: 1,
    };

    it('should update a profile name successfully', async () => {
      (profilesDb.findProfileById as jest.Mock).mockResolvedValue(mockProfile);
      (profilesDb.updateProfileName as jest.Mock).mockResolvedValue(mockUpdatedProfile);

      const result = await service.updateProfileName(123, 'Updated Profile');

      expect(profilesDb.findProfileById).toHaveBeenCalledWith(123);
      expect(profilesDb.updateProfileName).toHaveBeenCalledWith({ id: 123, name: 'Updated Profile' });
      expect(mockCache.invalidateProfile).toHaveBeenCalledWith(123);
      expect(mockCache.invalidateAccount).toHaveBeenCalledWith(1);
      expect(mockCache.invalidateProfileStatistics).toHaveBeenCalledWith(123);
      expect(result).toEqual({
        accountId: 1,
        id: 123,
        name: 'Updated Profile',
        image: 'profile-image-url.jpg',
      });
    });

    it('should throw NotFoundError when profile does not exist', async () => {
      (profilesDb.findProfileById as jest.Mock).mockResolvedValue(null);

      await expect(service.updateProfileName(999, 'Test')).rejects.toThrow(NotFoundError);
      expect(profilesDb.findProfileById).toHaveBeenCalledWith(999);
    });

    it('should throw BadRequestError when update fails', async () => {
      (profilesDb.findProfileById as jest.Mock).mockResolvedValue(mockProfile);
      (profilesDb.updateProfileName as jest.Mock).mockResolvedValue(undefined);

      await expect(service.updateProfileName(123, 'Updated Profile')).rejects.toThrow(BadRequestError);
      expect(profilesDb.findProfileById).toHaveBeenCalledWith(123);
      expect(profilesDb.updateProfileName).toHaveBeenCalledWith({ id: 123, name: 'Updated Profile' });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (profilesDb.findProfileById as jest.Mock).mockResolvedValue(mockProfile);
      (profilesDb.updateProfileName as jest.Mock).mockRejectedValue(error);

      await expect(service.updateProfileName(123, 'Updated Profile')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'updateProfileName(123, Updated Profile)');
    });
  });

  describe('updateProfileImage', () => {
    const mockProfile = {
      id: 123,
      name: 'Test Profile',
      accountId: 1,
      image: 'old-image.jpg',
    };

    const mockUpdatedProfile = {
      id: 123,
      name: 'Test Profile',
      accountId: 1,
      image: 'new-image.jpg',
    };

    it('should update a profile image successfully', async () => {
      (profilesDb.findProfileById as jest.Mock).mockResolvedValue(mockProfile);
      (profilesDb.updateProfileImage as jest.Mock).mockResolvedValue(mockUpdatedProfile);

      const result = await service.updateProfileImage(123, 'new-image.jpg');

      expect(profilesDb.findProfileById).toHaveBeenCalledWith(123);
      expect(profilesDb.updateProfileImage).toHaveBeenCalledWith({ id: 123, image: 'new-image.jpg' });
      expect(mockCache.invalidateProfile).toHaveBeenCalledWith(123);
      expect(mockCache.invalidateAccount).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        id: 123,
        name: 'Test Profile',
        accountId: 1,
        image: 'profile-image-url.jpg',
      });
    });

    it('should throw NotFoundError when profile does not exist', async () => {
      (profilesDb.findProfileById as jest.Mock).mockResolvedValue(null);

      await expect(service.updateProfileImage(999, 'new-image.jpg')).rejects.toThrow(NotFoundError);
      expect(profilesDb.findProfileById).toHaveBeenCalledWith(999);
    });

    it('should throw BadRequestError when update fails', async () => {
      (profilesDb.findProfileById as jest.Mock).mockResolvedValue(mockProfile);
      (profilesDb.updateProfileImage as jest.Mock).mockResolvedValue(null);

      await expect(service.updateProfileImage(123, 'new-image.jpg')).rejects.toThrow(BadRequestError);
      expect(profilesDb.findProfileById).toHaveBeenCalledWith(123);
      expect(profilesDb.updateProfileImage).toHaveBeenCalledWith({ id: 123, image: 'new-image.jpg' });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (profilesDb.findProfileById as jest.Mock).mockResolvedValue(mockProfile);
      (profilesDb.updateProfileImage as jest.Mock).mockRejectedValue(error);

      await expect(service.updateProfileImage(123, 'new-image.jpg')).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'updateProfileImage(123, new-image.jpg)');
    });
  });

  describe('deleteProfile', () => {
    const mockProfile = {
      id: 123,
      name: 'Profile to Delete',
      accountId: 1,
    };

    it('should delete a profile successfully', async () => {
      (profilesDb.findProfileById as jest.Mock).mockResolvedValue(mockProfile);
      (profilesDb.deleteProfile as jest.Mock).mockResolvedValue(true);

      const result = await service.deleteProfile(123);

      expect(profilesDb.findProfileById).toHaveBeenCalledWith(123);
      expect(profilesDb.deleteProfile).toHaveBeenCalled();
      expect(mockCache.invalidateProfile).toHaveBeenCalledWith(123);
      expect(mockCache.invalidateAccount).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('should throw NotFoundError when profile does not exist', async () => {
      (profilesDb.findProfileById as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteProfile(999)).rejects.toThrow(NotFoundError);
      expect(profilesDb.findProfileById).toHaveBeenCalledWith(999);
    });

    it('should throw BadRequestError when deletion fails', async () => {
      (profilesDb.findProfileById as jest.Mock).mockResolvedValue(mockProfile);
      (profilesDb.deleteProfile as jest.Mock).mockResolvedValue(false);

      await expect(service.deleteProfile(123)).rejects.toThrow(BadRequestError);
      expect(profilesDb.findProfileById).toHaveBeenCalledWith(123);
      expect(profilesDb.deleteProfile).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (profilesDb.findProfileById as jest.Mock).mockResolvedValue(mockProfile);
      (profilesDb.deleteProfile as jest.Mock).mockRejectedValue(error);

      await expect(service.deleteProfile(123)).rejects.toThrow('Database error');
      expect(errorService.handleError).toHaveBeenCalledWith(error, 'deleteProfile(123)');
    });
  });

  describe('invalidateProfileCache', () => {
    it('should invalidate the cache for a profile', () => {
      service.invalidateProfileCache(123);

      expect(mockCache.invalidateProfile).toHaveBeenCalledWith(123);
    });

    it('should handle string profile IDs', () => {
      service.invalidateProfileCache(123);

      expect(mockCache.invalidateProfile).toHaveBeenCalledWith(123);
    });
  });
});
