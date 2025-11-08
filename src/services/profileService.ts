import { ACCOUNT_KEYS, PROFILE_KEYS } from '../constants/cacheKeys';
import * as profilesDb from '../db/profilesDb';
import { BadRequestError, NotFoundError } from '../middleware/errorMiddleware';
import { transformAdminProfileForImage, transformProfileForImage } from '../types/profileTypes';
import { getProfileImage } from '../utils/imageUtility';
import { CacheService } from './cacheService';
import { episodesService } from './episodesService';
import { errorService } from './errorService';
import { moviesService } from './moviesService';
import { showService } from './showService';
import { AdminProfile, Profile, ProfileWithContent } from '@ajgifford/keepwatching-types';

/**
 * Service class for handling profile-related business logic
 */
export class ProfileService {
  private cache: CacheService;

  /**
   * Constructor accepts optional dependencies for testing
   */
  constructor(dependencies?: { cacheService?: CacheService }) {
    this.cache = dependencies?.cacheService ?? CacheService.getInstance();
  }

  /**
   * Retrieves all profiles for a specific account with caching
   *
   * @param accountId - ID of the account to get profiles for
   * @returns Array of profile objects with basic information
   * @throws {BadRequestError} If profiles cannot be retrieved
   */
  public async getProfilesByAccountId(accountId: number): Promise<Profile[]> {
    try {
      return await this.cache.getOrSet(
        ACCOUNT_KEYS.profiles(accountId),
        async () => {
          const profiles = await profilesDb.getProfilesByAccountId(accountId);
          if (!profiles) {
            throw new BadRequestError('Failed to get all profiles for an account');
          }

          return profiles.map(transformProfileForImage);
        },
        600, // 10 minutes TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getProfilesByAccountId(${accountId})`);
    }
  }

  public async getAdminProfilesByAccount(accountId: number): Promise<AdminProfile[]> {
    try {
      return await this.cache.getOrSet(
        ACCOUNT_KEYS.adminProfiles(accountId),
        async () => {
          const profiles = await profilesDb.getAdminProfilesByAccountId(accountId);
          if (!profiles) {
            throw new BadRequestError('Failed to get profiles with counts for an account');
          }

          return profiles.map(transformAdminProfileForImage);
        },
        600, // 10 minutes TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getAdminProfilesByAccountId(${accountId})`);
    }
  }

  /**
   * Retrieves a specific profile with all its associated content
   *
   * @param profileId - ID of the profile to retrieve
   * @returns Profile with shows, movies, and episode data
   * @throws {NotFoundError} If the profile is not found
   */
  public async getProfileWithContent(profileId: number): Promise<ProfileWithContent> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.complete(profileId),
        async () => {
          const profile = await profilesDb.findProfileById(profileId);
          if (!profile) {
            throw new NotFoundError('Profile not found');
          }

          const [
            shows,
            movies,
            recentEpisodes,
            upcomingEpisodes,
            nextUnwatchedEpisodes,
            recentMoviesData,
            upcomingMoviesData,
          ] = await Promise.all([
            showService.getShowsForProfile(profileId),
            moviesService.getMoviesForProfile(profileId),
            episodesService.getRecentEpisodesForProfile(profileId),
            episodesService.getUpcomingEpisodesForProfile(profileId),
            showService.getNextUnwatchedEpisodesForProfile(profileId),
            moviesService.getRecentMoviesForProfile(profileId),
            moviesService.getUpcomingMoviesForProfile(profileId),
          ]);

          return {
            profile: {
              id: profile.id,
              accountId: profile.accountId,
              name: profile.name,
              image: getProfileImage(profile.image, profile.name),
            },
            shows,
            episodes: { recentEpisodes, upcomingEpisodes, nextUnwatchedEpisodes },
            movies,
            recentUpcomingMovies: { recentMovies: recentMoviesData, upcomingMovies: upcomingMoviesData },
          };
        },
        600,
      );
    } catch (error) {
      throw errorService.handleError(error, `getProfile(${profileId})`);
    }
  }

  /**
   * Retrieves a specific profile by its ID with caching
   *
   * @param profileId - ID of the profile to retrieve
   * @returns Profile information or null if not found
   * @throws {DatabaseError} If a database error occurs
   */
  public async findProfileById(profileId: number): Promise<Profile | null> {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.profile(profileId),
        async () => {
          const profile = await profilesDb.findProfileById(profileId);
          if (!profile) {
            return null;
          }

          return transformProfileForImage(profile);
        },
        600, // 10 minutes TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `findProfileById(${profileId})`);
    }
  }

  /**
   * Creates a new profile for an account
   *
   * @param accountId - ID of the account to create a profile for
   * @param name - Name for the new profile
   * @returns The newly created profile information
   * @throws {BadRequestError} If the profile creation fails
   */
  public async createProfile(accountId: number, name: string): Promise<Profile> {
    try {
      const savedProfileId = await profilesDb.saveProfile({ accountId, name });

      if (savedProfileId === 0) {
        throw new BadRequestError('Failed to add a profile');
      }

      // Invalidate cache for account profiles
      this.cache.invalidate(ACCOUNT_KEYS.profiles(accountId));
      this.cache.invalidateAccount(accountId);

      return {
        id: savedProfileId,
        name,
        accountId,
        image: getProfileImage(undefined, name),
      };
    } catch (error) {
      throw errorService.handleError(error, `createProfile(${accountId}, ${name})`);
    }
  }

  /**
   * Updates an existing profile's name
   *
   * @param profileId - ID of the profile to update
   * @param name - New name for the profile
   * @returns Updated profile information
   * @throws {NotFoundError} If the profile is not found
   * @throws {BadRequestError} If the profile update fails
   */
  public async updateProfileName(profileId: number, name: string): Promise<Profile> {
    try {
      const profile = await profilesDb.findProfileById(profileId);
      if (!profile) {
        throw new NotFoundError('Profile not found');
      }

      const success = await profilesDb.updateProfileName({ id: profile.id, name });
      if (!success) {
        throw new BadRequestError('Failed to update profile');
      }

      // Invalidate cache for this profile and its account
      this.invalidateProfileCache(profileId);
      this.cache.invalidateAccount(profile.accountId);
      this.cache.invalidateProfileStatistics(profileId);

      return {
        id: profile.id,
        name,
        accountId: profile.accountId,
        image: getProfileImage(profile.image, name),
      };
    } catch (error) {
      throw errorService.handleError(error, `updateProfileName(${profileId}, ${name})`);
    }
  }

  /**
   * Updates an existing profile's image
   *
   * @param profileId - ID of the profile to update
   * @param image - Path to the new image
   * @returns Updated profile information
   * @throws {NotFoundError} If the profile is not found
   * @throws {BadRequestError} If the profile update fails
   */
  public async updateProfileImage(profileId: number, image: string | null): Promise<Profile> {
    try {
      const profile = await profilesDb.findProfileById(profileId);
      if (!profile) {
        throw new NotFoundError('Profile not found');
      }

      const success = await profilesDb.updateProfileImage({ id: profile.id, image });
      if (!success) {
        throw new BadRequestError('Failed to update profile image');
      }

      // Invalidate cache for this profile and its account
      this.invalidateProfileCache(profileId);
      this.cache.invalidateAccount(profile.accountId);

      return {
        id: profile.id,
        name: profile.name,
        accountId: profile.accountId,
        image: getProfileImage(image, profile.name),
      };
    } catch (error) {
      throw errorService.handleError(error, `updateProfileImage(${profileId}, ${image})`);
    }
  }

  /**
   * Deletes a profile from an account
   *
   * This action will cascade delete all watch status data for the profile.
   *
   * @param profileId - ID of the profile to delete
   * @returns A boolean indicating if the deletion was successful
   * @throws {NotFoundError} If the profile is not found
   * @throws {BadRequestError} If the profile deletion fails
   */
  public async deleteProfile(profileId: number): Promise<boolean> {
    try {
      const profile = await profilesDb.findProfileById(profileId);
      errorService.assertExists(profile, 'Profile', profileId);
      if (!profile) {
        throw new NotFoundError('Profile not found');
      }

      const deleted = await profilesDb.deleteProfile(profileId);
      if (!deleted) {
        throw new BadRequestError('Failed to delete profile');
      }

      // Invalidate cache for this profile and its account
      this.invalidateProfileCache(profileId);
      this.cache.invalidateAccount(profile.accountId);

      return true;
    } catch (error) {
      throw errorService.handleError(error, `deleteProfile(${profileId})`);
    }
  }

  /**
   * Invalidate all caches related to a profile
   *
   * @param profileId - ID of the profile to invalidate cache for
   */
  public invalidateProfileCache(profileId: number): void {
    this.cache.invalidateProfile(profileId);
  }
}

/**
 * Factory function for creating new instances
 * Use this in tests to create isolated instances with mocked dependencies
 */
export function createProfileService(dependencies?: { cacheService?: CacheService }): ProfileService {
  return new ProfileService(dependencies);
}

/**
 * Singleton instance for production use
 */
let instance: ProfileService | null = null;

/**
 * Get or create singleton instance
 * Use this in production code
 */
export function getProfileService(): ProfileService {
  if (!instance) {
    instance = createProfileService();
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 * Call this in beforeEach/afterEach to ensure test isolation
 */
export function resetProfileService(): void {
  instance = null;
}

/**
 * Backward-compatible default export
 * Existing code using `import { profileService }` continues to work
 */
export const profileService = getProfileService();
