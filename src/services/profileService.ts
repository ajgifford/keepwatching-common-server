import { ACCOUNT_KEYS, PROFILE_KEYS } from '../constants/cacheKeys';
import * as profilesDb from '../db/profilesDb';
import { BadRequestError, NotFoundError } from '../middleware/errorMiddleware';
import { getProfileImage } from '../utils/imageUtility';
import { CacheService } from './cacheService';
import { episodesService } from './episodesService';
import { errorService } from './errorService';
import { moviesService } from './moviesService';
import { showService } from './showService';

/**
 * Service class for handling profile-related business logic
 */
export class ProfileService {
  private cache: CacheService;

  /**
   * Creates a new ProfileService instance
   */
  constructor() {
    this.cache = CacheService.getInstance();
  }

  /**
   * Retrieves all profiles for a specific account with caching
   *
   * @param accountId - ID of the account to get profiles for
   * @returns Array of profile objects with basic information
   * @throws {BadRequestError} If profiles cannot be retrieved
   */
  public async getProfilesByAccountId(accountId: number) {
    try {
      return await this.cache.getOrSet(
        ACCOUNT_KEYS.profiles(accountId),
        async () => {
          const profiles = await profilesDb.getAllProfilesByAccountId(accountId);
          if (!profiles) {
            throw new BadRequestError('Failed to get all profiles for an account');
          }

          return profiles.map((profile) => ({
            id: profile.id,
            name: profile.name,
            image: getProfileImage(profile.image, profile.name),
            account_id: profile.account_id,
          }));
        },
        600, // 10 minutes TTL
      );
    } catch (error) {
      throw errorService.handleError(error, `getProfilesByAccountId(${accountId})`);
    }
  }

  /**
   * Retrieves a specific profile with all its associated content
   *
   * @param profileId - ID of the profile to retrieve
   * @returns Profile with shows, movies, and episode data
   * @throws {NotFoundError} If the profile is not found
   */
  public async getProfile(profileId: number) {
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
            showService.getShowsForProfile(profileId.toString()),
            moviesService.getMoviesForProfile(profileId.toString()),
            episodesService.getRecentEpisodesForProfile(profileId.toString()),
            episodesService.getUpcomingEpisodesForProfile(profileId.toString()),
            showService.getNextUnwatchedEpisodesForProfile(profileId.toString()),
            moviesService.getRecentMoviesForProfile(profileId.toString()),
            moviesService.getUpcomingMoviesForProfile(profileId.toString()),
          ]);

          return {
            profile: {
              id: profile.id,
              name: profile.name,
              image: getProfileImage(profile.image, profile.name),
            },
            shows,
            recentEpisodes,
            upcomingEpisodes,
            nextUnwatchedEpisodes,
            movies,
            recentMovies: recentMoviesData,
            upcomingMovies: upcomingMoviesData,
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
  public async findProfileById(profileId: number) {
    try {
      return await this.cache.getOrSet(
        PROFILE_KEYS.profile(profileId),
        async () => {
          const profile = await profilesDb.findProfileById(profileId);
          if (!profile) {
            return null;
          }

          return {
            id: profile.id,
            name: profile.name,
            account_id: profile.account_id,
            image: getProfileImage(profile.image, profile.name),
          };
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
  public async createProfile(accountId: number, name: string) {
    try {
      const profile = profilesDb.createProfile(accountId, name);
      const savedProfile = await profilesDb.saveProfile(profile);

      if (!savedProfile.id) {
        throw new BadRequestError('Failed to add a profile');
      }

      // Invalidate cache for account profiles
      this.cache.invalidate(ACCOUNT_KEYS.profiles(accountId));
      this.cache.invalidateAccount(accountId);

      return {
        id: savedProfile.id,
        name: savedProfile.name,
        account_id: savedProfile.account_id,
        image: getProfileImage(savedProfile.image, savedProfile.name),
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
  public async updateProfileName(profileId: number, name: string) {
    try {
      const profile = await profilesDb.findProfileById(profileId);
      if (!profile) {
        throw new NotFoundError('Profile not found');
      }

      const updatedProfile = await profilesDb.updateProfileName(profile, name);
      if (!updatedProfile) {
        throw new BadRequestError('Failed to update profile');
      }

      // Invalidate cache for this profile and its account
      this.invalidateProfileCache(profileId);
      this.cache.invalidateAccount(profile.account_id);
      this.cache.invalidateProfileStatistics(profileId);

      return {
        id: updatedProfile.id,
        name: updatedProfile.name,
        account_id: updatedProfile.account_id,
        image: getProfileImage(updatedProfile.image, updatedProfile.name),
      };
    } catch (error) {
      throw errorService.handleError(error, `updateProfileName(${profileId}, ${name})`);
    }
  }

  /**
   * Updates an existing profile's image
   *
   * @param profileId - ID of the profile to update
   * @param imagePath - Path to the new image
   * @returns Updated profile information
   * @throws {NotFoundError} If the profile is not found
   * @throws {BadRequestError} If the profile update fails
   */
  public async updateProfileImage(profileId: number, imagePath: string) {
    try {
      const profile = await profilesDb.findProfileById(profileId);
      if (!profile) {
        throw new NotFoundError('Profile not found');
      }

      const updatedProfile = await profilesDb.updateProfileImage(profile, imagePath);
      if (!updatedProfile) {
        throw new BadRequestError('Failed to update profile image');
      }

      // Invalidate cache for this profile and its account
      this.invalidateProfileCache(profileId);
      this.cache.invalidateAccount(profile.account_id);

      return {
        id: updatedProfile.id,
        name: updatedProfile.name,
        account_id: updatedProfile.account_id,
        image: getProfileImage(updatedProfile.image, updatedProfile.name),
      };
    } catch (error) {
      throw errorService.handleError(error, `updateProfileImage(${profileId}, ${imagePath})`);
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
  public async deleteProfile(profileId: number) {
    try {
      const profile = await profilesDb.findProfileById(profileId);
      errorService.assertExists(profile, 'Profile', profileId);
      if (!profile) {
        throw new NotFoundError('Profile not found');
      }

      const deleted = await profilesDb.deleteProfile(profile);
      if (!deleted) {
        throw new BadRequestError('Failed to delete profile');
      }

      // Invalidate cache for this profile and its account
      this.invalidateProfileCache(profileId);
      this.cache.invalidateAccount(profile.account_id);

      return true;
    } catch (error) {
      throw errorService.handleError(error, `deleteProfile(${profileId})`);
    }
  }

  /**
   * Creates a profile object with the provided properties
   * This is mostly a pass-through to the DB layer's create function but maintained
   * for consistency with the service pattern
   *
   * @param accountId - ID of the account this profile belongs to
   * @param name - Name of the profile
   * @param id - Optional ID for an existing profile
   * @param image - Optional image path for the profile
   * @returns A new Profile object
   */
  public createProfileObject(accountId: number, name: string, id?: number, image?: string) {
    return profilesDb.createProfile(accountId, name, id, image);
  }

  /**
   * Invalidate all caches related to a profile
   *
   * @param profileId - ID of the profile to invalidate cache for
   */
  public invalidateProfileCache(profileId: number | string): void {
    this.cache.invalidateProfile(profileId);
  }
}

// Export a singleton instance for global use
export const profileService = new ProfileService();
