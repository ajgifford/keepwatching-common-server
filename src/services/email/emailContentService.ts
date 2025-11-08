import { cliLogger } from '../../logger/logger';
import { NotFoundError, NotVerifiedError } from '../../middleware/errorMiddleware';
import {
  AccountContentAnalysis,
  DigestData,
  DigestEmail,
  DiscoveryEmail,
  EmailBatch,
  EmailContentResult,
  FeaturedContent,
  ProfileContentAnalysis,
  WelcomeEmail,
} from '../../types/emailTypes';
import { getUpcomingWeekRange } from '../../utils/emailUtility';
import { accountService } from '../accountService';
import { episodesService } from '../episodesService';
import { errorService } from '../errorService';
import { moviesService } from '../moviesService';
import { preferencesService } from '../preferencesService';
import { profileService } from '../profileService';
import { showService } from '../showService';
import { ContentReference, Profile } from '@ajgifford/keepwatching-types';

/**
 * Service responsible for email content generation and management
 */
export class EmailContentService {
  /**
   * Constructor accepts optional dependencies for testing
   */
  constructor(dependencies?: object) {
    // No dependencies currently, but keeping pattern consistent
    void dependencies;
  }

  /**
   * Generate email content for a specific account
   */
  public async generateEmailContent(accountEmail: string): Promise<EmailContentResult> {
    try {
      const weekRange = getUpcomingWeekRange();
      const account = await accountService.getCombinedAccountByEmail(accountEmail);

      if (!account) {
        throw new NotFoundError(`Account not found: ${accountEmail}`);
      }

      if (!account.emailVerified) {
        throw new NotVerifiedError();
      }

      const profiles = await profileService.getProfilesByAccountId(account.id);

      if (profiles.length === 0) {
        throw new NotFoundError(`Account ${accountEmail} has no profiles`);
      }

      const contentAnalysis = await this.analyzeAccountContent(profiles, weekRange);

      const baseResult = {
        account: { email: account.email!, name: account.name },
        profileCount: profiles.length,
        profilesWithContent: contentAnalysis.profileAnalyses.filter((p) => p.hasContent).length,
        profileAnalyses: contentAnalysis.profileAnalyses,
      };

      if (contentAnalysis.hasUpcomingContent) {
        return {
          ...baseResult,
          emailType: 'digest' as const,
          digestData: {
            accountId: account.id,
            to: account.email!,
            accountName: account.name,
            profiles: contentAnalysis.profileDigests,
            weekRange,
          },
        };
      } else {
        const featuredContent = await this.getFeaturedContent();

        return {
          ...baseResult,
          emailType: 'discovery' as const,
          discoveryData: {
            accountId: account.id,
            to: account.email!,
            accountName: account.name,
            data: {
              accountName: account.name,
              profiles: profiles.map((p) => ({ id: p.id, name: p.name })),
              featuredContent,
              weekRange,
            },
          },
        };
      }
    } catch (error) {
      throw errorService.handleError(error, `generateEmailContent(${accountEmail})`);
    }
  }

  /**
   * Generate email content for all accounts
   */
  public async generateBatchEmailContent(): Promise<EmailBatch> {
    try {
      const weekRange = getUpcomingWeekRange();
      const accounts = await accountService.getAccounts();
      const accountsWithEmailPref = await preferencesService.getAccountsWithEmailPreference('weeklyDigest');
      const digestEmails: DigestEmail[] = [];
      const discoveryEmails: DiscoveryEmail[] = [];

      if (accounts.length === 0) {
        cliLogger.error(`No accounts found, no emails will be generated`);
        return { digestEmails, discoveryEmails };
      }

      const featuredContent = await this.getFeaturedContent();

      for (const account of accounts) {
        try {
          if (!account.emailVerified) {
            throw new NotVerifiedError();
          }

          if (!accountsWithEmailPref.some((a) => a.id === account.id)) {
            cliLogger.info(`Account: ${account.email} is configured not to receive the weekly digest`);
            continue;
          }

          const profiles = await profileService.getProfilesByAccountId(account.id);
          if (profiles.length === 0) {
            continue;
          }

          const contentAnalysis = await this.analyzeAccountContent(profiles, weekRange);

          if (contentAnalysis.hasUpcomingContent) {
            digestEmails.push({
              accountId: account.id,
              to: account.email!,
              accountName: account.name,
              profiles: contentAnalysis.profileDigests,
              weekRange,
            });
          } else {
            discoveryEmails.push({
              accountId: account.id,
              to: account.email!,
              accountName: account.name,
              data: {
                accountName: account.name,
                profiles: profiles.map((p) => ({ id: p.id, name: p.name })),
                featuredContent,
                weekRange,
              },
            });
          }
        } catch (error) {
          cliLogger.error(`Failed to process account: ${account.email} - `, error);
        }
      }

      return { digestEmails, discoveryEmails };
    } catch (error) {
      throw errorService.handleError(error, 'generateBatchEmailContent');
    }
  }

  /**
   * Generate digest email content for a specific account (throws if no content)
   */
  public async generateDigestContent(
    accountEmail: string,
  ): Promise<{ account: { id: number; email: string; name: string }; digestData: DigestEmail }> {
    try {
      const weekRange = getUpcomingWeekRange();
      const account = await accountService.getCombinedAccountByEmail(accountEmail);

      if (!account) {
        throw new NotFoundError(`Account not found: ${accountEmail}`);
      }

      if (!account.emailVerified) {
        throw new NotVerifiedError();
      }

      const profiles = await profileService.getProfilesByAccountId(account.id);

      if (profiles.length === 0) {
        throw new NotFoundError(`Account ${accountEmail} has no profiles`);
      }

      const contentAnalysis = await this.analyzeAccountContent(profiles, weekRange);

      if (!contentAnalysis.hasUpcomingContent) {
        throw new NotFoundError(
          `Account ${accountEmail} has no upcoming content this week. Use generateDiscoveryContent instead.`,
        );
      }

      return {
        account: { id: account.id, email: account.email!, name: account.name },
        digestData: {
          accountId: account.id,
          to: account.email!,
          accountName: account.name,
          profiles: contentAnalysis.profileDigests,
          weekRange,
        },
      };
    } catch (error) {
      throw errorService.handleError(error, `generateDigestContent(${accountEmail})`);
    }
  }

  /**
   * Generate discovery email content for a specific account
   */
  public async generateDiscoveryContent(
    accountEmail: string,
  ): Promise<{ account: { id: number; email: string; name: string }; discoveryData: DiscoveryEmail }> {
    try {
      const weekRange = getUpcomingWeekRange();
      const account = await accountService.getCombinedAccountByEmail(accountEmail);

      if (!account) {
        throw new NotFoundError(`Account not found: ${accountEmail}`);
      }

      if (!account.emailVerified) {
        throw new NotVerifiedError();
      }

      const profiles = await profileService.getProfilesByAccountId(account.id);
      const featuredContent = await this.getFeaturedContent();

      return {
        account: { id: account.id, email: account.email!, name: account.name },
        discoveryData: {
          accountId: account.id,
          to: account.email!,
          accountName: account.name,
          data: {
            accountName: account.name,
            profiles: profiles.map((p) => ({ id: p.id, name: p.name })),
            featuredContent,
            weekRange,
          },
        },
      };
    } catch (error) {
      throw errorService.handleError(error, `generateDiscoveryContent(${accountEmail})`);
    }
  }

  /**
   * Generate welcome email content for a new account
   */
  public async generateWelcomeContent(
    accountEmail: string,
  ): Promise<{ account: { id: number; email: string; name: string }; welcomeData: WelcomeEmail }> {
    try {
      const account = await accountService.getCombinedAccountByEmail(accountEmail);

      if (!account) {
        throw new NotFoundError(`Account not found: ${accountEmail}`);
      }

      const featuredContent = await this.getFeaturedContent();

      return {
        account: { id: account.id, email: account.email!, name: account.name },
        welcomeData: {
          accountId: account.id,
          to: account.email!,
          accountName: account.name,
          featuredContent,
        },
      };
    } catch (error) {
      throw errorService.handleError(error, `generateWelcomeContent(${accountEmail})`);
    }
  }

  /**
   * Get featured content for discovery emails
   */
  public async getFeaturedContent(): Promise<FeaturedContent> {
    const [trendingShows, newReleases, popularMovies] = await Promise.all([
      this.getPopularShows(),
      this.getNewReleases(),
      this.getPopularMovies(),
    ]);

    // Check if all methods returned empty arrays (indicating all services failed)
    if (trendingShows.length === 0 && newReleases.length === 0 && popularMovies.length === 0) {
      cliLogger.warn(
        'Failed to get featured content, using empty arrays',
        new Error('All featured content services failed'),
      );
    }

    return {
      trendingShows: trendingShows.slice(0, 4),
      newReleases: newReleases.slice(0, 4),
      popularMovies: popularMovies.slice(0, 4),
    };
  }

  /**
   * Analyze an account's profiles for upcoming content
   */
  private async analyzeAccountContent(
    profiles: Profile[],
    weekRange: { start: string; end: string },
  ): Promise<AccountContentAnalysis> {
    const profileAnalyses: ProfileContentAnalysis[] = [];
    const profileDigests: DigestData[] = [];
    let hasUpcomingContent = false;

    for (const profile of profiles) {
      const [upcomingEpisodes, upcomingMovies, continueWatching] = await Promise.all([
        episodesService.getUpcomingEpisodesForProfile(profile.id),
        moviesService.getUpcomingMoviesForProfile(profile.id),
        showService.getNextUnwatchedEpisodesForProfile(profile.id),
      ]);

      const weeklyUpcomingEpisodes = upcomingEpisodes.filter((episode) => {
        const episodeDate = new Date(episode.airDate);
        const startDate = new Date(weekRange.start);
        const endDate = new Date(weekRange.end);
        return episodeDate >= startDate && episodeDate <= endDate;
      });

      const weeklyUpcomingMovies = upcomingMovies.filter((movie) => {
        if (!movie.releaseDate) return false;
        const movieDate = new Date(movie.releaseDate);
        const startDate = new Date(weekRange.start);
        const endDate = new Date(weekRange.end);
        return movieDate >= startDate && movieDate <= endDate;
      });

      const hasContent =
        weeklyUpcomingEpisodes.length > 0 || weeklyUpcomingMovies.length > 0 || continueWatching.length > 0;

      if (hasContent) {
        hasUpcomingContent = true;
      }

      const profileAnalysis: ProfileContentAnalysis = {
        profile: { id: profile.id, name: profile.name },
        hasContent,
        upcomingEpisodes,
        upcomingMovies,
        continueWatching,
        weeklyUpcomingEpisodes,
        weeklyUpcomingMovies,
      };

      profileAnalyses.push(profileAnalysis);

      if (hasContent) {
        profileDigests.push({
          profile: { id: profile.id, name: profile.name },
          upcomingEpisodes: weeklyUpcomingEpisodes,
          upcomingMovies: weeklyUpcomingMovies,
          continueWatching,
        });
      }
    }

    return {
      hasUpcomingContent,
      profileAnalyses,
      profileDigests,
    };
  }

  /**
   * Get trending shows
   */
  private async getPopularShows(): Promise<ContentReference[]> {
    try {
      const [trending, topRated] = await Promise.all([
        showService.getTrendingShows(5),
        showService.getTopRatedShows(5),
      ]);

      const combined = [...trending, ...topRated];
      const unique = combined.filter((show, index, self) => index === self.findIndex((s) => s.id === show.id));

      return unique.slice(0, 5);
    } catch (error) {
      cliLogger.error('Failed to get trending shows', error);
      return [];
    }
  }

  /**
   * Get new releases
   */
  private async getNewReleases(): Promise<ContentReference[]> {
    try {
      const [newShows, newMovies] = await Promise.all([
        showService.getNewlyAddedShows(5),
        moviesService.getRecentlyReleasedMovies(5),
      ]);

      const combined = [...newShows, ...newMovies];
      return combined.sort(() => Math.random() - 0.5).slice(0, 5);
    } catch (error) {
      cliLogger.error('Failed to get new releases', error);
      return [];
    }
  }

  /**
   * Get popular movies
   */
  private async getPopularMovies(): Promise<ContentReference[]> {
    try {
      const [trending, topRated] = await Promise.all([
        moviesService.getTrendingMovies(5),
        moviesService.getTopRatedMovies(5),
      ]);

      const combined = [...trending, ...topRated];
      const unique = combined.filter((movie, index, self) => index === self.findIndex((m) => m.id === movie.id));

      return unique.slice(0, 5);
    } catch (error) {
      cliLogger.error('Failed to get popular movies', error);
      return [];
    }
  }
}

/**
 * Factory function for creating new instances
 * Use this in tests to create isolated instances with mocked dependencies
 */
export function createEmailContentService(dependencies?: object): EmailContentService {
  return new EmailContentService(dependencies);
}

/**
 * Singleton instance for production use
 */
let instance: EmailContentService | null = null;

/**
 * Get or create singleton instance
 * Use this in production code
 */
export function getEmailContentService(): EmailContentService {
  if (!instance) {
    instance = createEmailContentService();
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 * Call this in beforeEach/afterEach to ensure test isolation
 */
export function resetEmailContentService(): void {
  instance = null;
}

/**
 * Backward-compatible default export
 * Existing code using `import { emailContentService }` continues to work
 */
export const emailContentService = getEmailContentService();
