import { EmailConfig } from '../config';
import { appLogger, cliLogger } from '../logger/logger';
import { NotVerifiedError } from '../middleware/errorMiddleware';
import { NotFoundError } from '../middleware/errorMiddleware';
import {
  AccountContentAnalysis,
  DigestData,
  DigestEmail,
  DiscoveryEmail,
  EmailBatch,
  ProfileContentAnalysis,
} from '../types/emailTypes';
import {
  generateDiscoveryEmailHTML,
  generateDiscoveryEmailText,
  generateWeeklyDigestHTML,
  generateWeeklyDigestText,
  getUpcomingWeekRange,
} from '../utils/emailUtility';
import { accountService } from './accountService';
import { episodesService } from './episodesService';
import { errorService } from './errorService';
import { moviesService } from './moviesService';
import { profileService } from './profileService';
import { showService } from './showService';
import { MovieReference, Profile, ShowTMDBReference } from '@ajgifford/keepwatching-types';
import nodemailer from 'nodemailer';

/**
 * Service for handling email notifications and weekly digests
 */
export class EmailService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
  }

  /**
   * Verify email connection
   */
  public async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      cliLogger.info('Email service connection verified successfully');
      return true;
    } catch (error) {
      cliLogger.error('Email service connection failed', error);
      return false;
    }
  }

  /**
   * Send weekly digest emails to all accounts
   */
  public async sendWeeklyDigests(): Promise<void> {
    try {
      cliLogger.info('Starting weekly digest email job');
      appLogger.info('Weekly digest email job started');

      const weekRange = getUpcomingWeekRange();

      const { digestEmails, discoveryEmails } = await this.generateAllEmails(weekRange);

      let emailsSent = 0;
      let emailsFailed = 0;

      for (const email of digestEmails) {
        try {
          await this.sendWeeklyDigestEmail(email);
          emailsSent++;
          cliLogger.info(`Digest email sent to: ${email.to}`);
        } catch (error) {
          emailsFailed++;
          cliLogger.error(`Failed to send digest email to: ${email.to}`, error);
          appLogger.error('Digest email failed', {
            email: email.to,
            error,
          });
        }
      }

      for (const email of discoveryEmails) {
        try {
          await this.sendWeeklyDiscoveryEmail(email);
          emailsSent++;
          cliLogger.info(`Discovery email sent to: ${email.to}`);
        } catch (error) {
          emailsFailed++;
          cliLogger.error(`Failed to send discovery email to: ${email.to}`, error);
          appLogger.error('Discovery email failed', {
            email: email.to,
            error,
          });
        }
      }

      cliLogger.info(`Weekly email job completed: ${emailsSent} sent, ${emailsFailed} failed`);
      appLogger.info('Weekly email job completed', {
        digestEmails: digestEmails.length,
        discoveryEmails: discoveryEmails.length,
        emailsSent,
        emailsFailed,
      });
    } catch (error) {
      cliLogger.error('Weekly email job failed', error);
      appLogger.error('Weekly email job failed', { error });
      throw errorService.handleError(error, 'sendWeeklyDigests');
    }
  }

  /**
   * Generate both digest and discovery emails in a single pass through all accounts
   */
  private async generateAllEmails(weekRange: { start: string; end: string }): Promise<EmailBatch> {
    try {
      const accounts = await accountService.getAccounts();
      const digestEmails: DigestEmail[] = [];
      const discoveryEmails: DiscoveryEmail[] = [];

      const featuredContent = await this.getFeaturedContent();

      for (const account of accounts) {
        try {
          if (!account.emailVerified) {
            throw new NotVerifiedError();
          }

          const profiles = await profileService.getProfilesByAccountId(account.id);
          if (profiles.length === 0) {
            continue;
          }

          const contentAnalysis = await this.analyzeAccountContent(profiles, weekRange);

          if (contentAnalysis.hasUpcomingContent) {
            digestEmails.push({
              to: account.email!,
              accountName: account.name,
              profiles: contentAnalysis.profileDigests,
              weekRange,
            });
          } else {
            discoveryEmails.push({
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
      throw errorService.handleError(error, 'generateAllEmails');
    }
  }

  /**
   * Analyze an account's profiles for upcoming content
   *
   * @param profiles - Array of profiles to analyze
   * @param weekRange - Week range to filter content by
   * @returns Analysis of content availability for the account
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

      // Filter upcoming episodes to only include this week
      const weeklyUpcomingEpisodes = upcomingEpisodes.filter((episode) => {
        const airDate = new Date(episode.airDate);
        const weekStart = new Date(weekRange.start);
        const weekEnd = new Date(weekRange.end);
        return airDate >= weekStart && airDate <= weekEnd;
      });

      // Filter upcoming movies to only include this week's releases
      const weeklyUpcomingMovies = upcomingMovies.filter((movie) => {
        // Note: You might need to add a releaseDate field to MovieReference
        // or fetch full movie details to get release dates
        return true; // For now, include all upcoming movies
      });

      const profileHasContent =
        weeklyUpcomingEpisodes.length > 0 || weeklyUpcomingMovies.length > 0 || continueWatching.length > 0;

      const profileAnalysis: ProfileContentAnalysis = {
        profile: {
          id: profile.id,
          name: profile.name,
        },
        hasContent: profileHasContent,
        upcomingEpisodes,
        upcomingMovies,
        continueWatching,
        weeklyUpcomingEpisodes,
        weeklyUpcomingMovies,
      };

      profileAnalyses.push(profileAnalysis);

      if (profileHasContent) {
        hasUpcomingContent = true;

        profileDigests.push({
          profile: {
            id: profile.id,
            name: profile.name,
          },
          upcomingEpisodes: weeklyUpcomingEpisodes,
          upcomingMovies: weeklyUpcomingMovies,
          continueWatching: continueWatching.slice(0, 5),
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
   * Get featured content for discovery emails
   */
  private async getFeaturedContent(): Promise<{
    trendingShows: MovieReference[];
    newReleases: MovieReference[];
    popularMovies: MovieReference[];
  }> {
    try {
      const [trendingShows, newReleases, popularMovies] = await Promise.all([
        this.getPopularShows(),
        this.getNewReleases(),
        this.getPopularMovies(),
      ]);

      return {
        trendingShows: trendingShows.slice(0, 4),
        newReleases: newReleases.slice(0, 4),
        popularMovies: popularMovies.slice(0, 4),
      };
    } catch (error) {
      cliLogger.warn('Failed to get featured content, using empty arrays', error);
      return {
        trendingShows: [],
        newReleases: [],
        popularMovies: [],
      };
    }
  }

  /**
   * Get trending shows
   */
  private async getPopularShows(): Promise<ShowTMDBReference[]> {
    try {
      const [trending, topRated] = await Promise.all([
        showService.getTrendingShows(5),
        showService.getTopRatedShows(5),
      ]);

      const combined = [...trending, ...topRated];
      const unique = combined.filter((movie, index, self) => index === self.findIndex((m) => m.id === movie.id));

      return unique.slice(0, 5);
    } catch (error) {
      cliLogger.error('Failed to get trending shows', error);
      return [];
    }
  }

  /**
   * Get new releases
   */
  private async getNewReleases(): Promise<MovieReference[]> {
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
  private async getPopularMovies(): Promise<MovieReference[]> {
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

  /**
   * Send individual weekly digest email
   */
  private async sendWeeklyDigestEmail(emailData: DigestEmail): Promise<void> {
    try {
      const htmlContent = generateWeeklyDigestHTML(emailData);
      const textContent = generateWeeklyDigestText(emailData);

      const mailOptions = {
        from: this.config.from,
        to: emailData.to,
        subject: `Your Weekly Watch Guide - ${emailData.weekRange.start} to ${emailData.weekRange.end}`,
        html: htmlContent,
        text: textContent,
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      throw errorService.handleError(error, `sendWeeklyDigestEmail(${emailData.to})`);
    }
  }

  /**
   * Send content discovery email
   */
  private async sendWeeklyDiscoveryEmail(emailData: DiscoveryEmail): Promise<void> {
    try {
      const htmlContent = generateDiscoveryEmailHTML(emailData);
      const textContent = generateDiscoveryEmailText(emailData);

      const mailOptions = {
        from: this.config.from,
        to: emailData.to,
        subject: `🎬 Discover Something New This Week - ${emailData.data.weekRange.start} to ${emailData.data.weekRange.end}`,
        html: htmlContent,
        text: textContent,
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      throw errorService.handleError(error, `sendWeeklyDiscoveryEmail(${emailData.to})`);
    }
  }

  /**
   * Send digest email to a specific account
   */
  public async sendManualDigestEmailToAccount(accountEmail: string): Promise<void> {
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
          `Account ${accountEmail} has no upcoming content this week. Use sendTestDiscoveryEmail instead.`,
        );
      }

      const digestEmail: DigestEmail = {
        to: account.email!,
        accountName: account.name,
        profiles: contentAnalysis.profileDigests,
        weekRange,
      };

      await this.sendWeeklyDigestEmail(digestEmail);
      cliLogger.info(`Test weekly digest sent to account: ${accountEmail}`);
    } catch (error) {
      throw errorService.handleError(error, `sendManualDigestEmailToAccount(${accountEmail})`);
    }
  }

  /**
   * Send discovery email to a specific account
   */
  public async sendManualDiscoveryEmailToAccount(accountEmail: string): Promise<void> {
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

      const discoveryEmail: DiscoveryEmail = {
        to: account.email!,
        accountName: account.name,
        data: {
          accountName: account.name,
          profiles: profiles.map((p) => ({ id: p.id, name: p.name })),
          featuredContent,
          weekRange,
        },
      };

      await this.sendWeeklyDiscoveryEmail(discoveryEmail);
      cliLogger.info(`Test weekly discovery email sent to: ${accountEmail}`);
    } catch (error) {
      throw errorService.handleError(error, `sendManualDiscoveryEmailToAccount(${accountEmail})`);
    }
  }

  /**
   * Send weekly digest to a specific account regardless of content availability
   * If no upcoming content, sends discovery email instead
   */
  public async sendManualEmailToAccount(
    accountEmail: string,
  ): Promise<{ emailType: 'digest' | 'discovery'; hasContent: boolean }> {
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

      if (contentAnalysis.hasUpcomingContent) {
        const digestEmail: DigestEmail = {
          to: account.email!,
          accountName: account.name,
          profiles: contentAnalysis.profileDigests,
          weekRange,
        };

        await this.sendWeeklyDigestEmail(digestEmail);
        cliLogger.info(`Test weekly digest sent to account: ${accountEmail}`);
        return { emailType: 'digest', hasContent: true };
      } else {
        const featuredContent = await this.getFeaturedContent();

        const discoveryEmail: DiscoveryEmail = {
          to: account.email!,
          accountName: account.name,
          data: {
            accountName: account.name,
            profiles: profiles.map((p) => ({ id: p.id, name: p.name })),
            featuredContent,
            weekRange,
          },
        };

        await this.sendWeeklyDiscoveryEmail(discoveryEmail);
        cliLogger.info(`Test discovery email sent to account: ${accountEmail}`);
        return { emailType: 'discovery', hasContent: false };
      }
    } catch (error) {
      throw errorService.handleError(error, `sendTestEmailToAccount(${accountEmail})`);
    }
  }

  /**
   * Preview weekly digest data for a specific account without sending email
   */
  public async previewWeeklyDigestForAccount(accountEmail: string): Promise<{
    account: { email: string; name: string };
    emailType: 'digest' | 'discovery';
    profileCount: number;
    profilesWithContent: number;
    profileAnalyses: ProfileContentAnalysis[];
    digestData?: DigestEmail;
    discoveryData?: DiscoveryEmail;
  }> {
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
      throw errorService.handleError(error, `previewWeeklyDigestForAccount(${accountEmail})`);
    }
  }
}

// Singleton instance
let emailServiceInstance: EmailService | null = null;

/**
 * Initialize the email service with configuration
 */
export function initializeEmailService(config: EmailConfig): EmailService {
  emailServiceInstance = new EmailService(config);
  return emailServiceInstance;
}

/**
 * Get the email service instance
 */
export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    throw new Error('Email service not initialized. Call initializeEmailService() first.');
  }
  return emailServiceInstance;
}
