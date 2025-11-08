import { cliLogger } from '@logger/logger';
import { NotFoundError, NotVerifiedError } from '@middleware/errorMiddleware';
import { accountService } from '@services/accountService';
import {
  EmailContentService,
  createEmailContentService,
  resetEmailContentService,
} from '@services/email/emailContentService';
import { episodesService } from '@services/episodesService';
import { errorService } from '@services/errorService';
import { moviesService } from '@services/moviesService';
import { preferencesService } from '@services/preferencesService';
import { profileService } from '@services/profileService';
import { showService } from '@services/showService';
import * as emailUtility from '@utils/emailUtility';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@logger/logger');
vi.mock('@services/errorService');
vi.mock('@services/accountService');
vi.mock('@services/profileService');
vi.mock('@services/episodesService');
vi.mock('@services/moviesService');
vi.mock('@services/showService');
vi.mock('@services/preferencesService');
vi.mock('@utils/emailUtility');

describe('EmailContentService', () => {
  let emailContentService: EmailContentService;

  const mockAccount = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
  };

  const mockProfile = {
    id: 1,
    name: 'Test Profile',
  };

  const mockWeekRange = {
    start: '2025-08-01',
    end: '2025-08-07',
  };

  const mockUpcomingEpisode = {
    id: 1,
    title: 'Test Episode',
    airDate: '2025-08-02',
    showName: 'Test Show',
  };

  const mockUpcomingMovie = {
    id: 1,
    title: 'Test Movie',
    releaseDate: '2025-08-03',
  };

  const mockContinueWatching = {
    id: 1,
    showName: 'Continue Show',
    episodeTitle: 'Next Episode',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetEmailContentService();
    emailContentService = createEmailContentService();

    // Setup default mocks
    (emailUtility.getUpcomingWeekRange as Mock).mockReturnValue(mockWeekRange);
    (errorService.handleError as Mock).mockImplementation((error) => error);
    (accountService.getCombinedAccountByEmail as Mock).mockResolvedValue(mockAccount);
    (profileService.getProfilesByAccountId as Mock).mockResolvedValue([mockProfile]);
    (episodesService.getUpcomingEpisodesForProfile as Mock).mockResolvedValue([mockUpcomingEpisode]);
    (moviesService.getUpcomingMoviesForProfile as Mock).mockResolvedValue([mockUpcomingMovie]);
    (showService.getNextUnwatchedEpisodesForProfile as Mock).mockResolvedValue([mockContinueWatching]);
    (showService.getTrendingShows as Mock).mockResolvedValue([{ id: 1, title: 'Trending Show' }]);
    (showService.getTopRatedShows as Mock).mockResolvedValue([{ id: 2, title: 'Top Rated Show' }]);
    (showService.getNewlyAddedShows as Mock).mockResolvedValue([{ id: 3, title: 'New Show' }]);
    (moviesService.getTrendingMovies as Mock).mockResolvedValue([{ id: 4, title: 'Trending Movie' }]);
    (moviesService.getTopRatedMovies as Mock).mockResolvedValue([{ id: 5, title: 'Top Rated Movie' }]);
    (moviesService.getRecentlyReleasedMovies as Mock).mockResolvedValue([{ id: 6, title: 'Recent Movie' }]);
  });

  afterEach(() => {
    resetEmailContentService();
  });

  describe('generateEmailContent', () => {
    it('should generate digest content when account has upcoming content', async () => {
      const result = await emailContentService.generateEmailContent('test@example.com');

      expect(result.emailType).toBe('digest');
      expect(result.account.email).toBe('test@example.com');
      expect(result.profileCount).toBe(1);
      expect(result.profilesWithContent).toBe(1);
      expect(result.digestData).toBeDefined();
      expect(result.discoveryData).toBeUndefined();
    });

    it('should generate discovery content when account has no upcoming content', async () => {
      // Mock no upcoming content
      (episodesService.getUpcomingEpisodesForProfile as Mock).mockResolvedValue([]);
      (moviesService.getUpcomingMoviesForProfile as Mock).mockResolvedValue([]);
      (showService.getNextUnwatchedEpisodesForProfile as Mock).mockResolvedValue([]);

      const result = await emailContentService.generateEmailContent('test@example.com');

      expect(result.emailType).toBe('discovery');
      expect(result.profilesWithContent).toBe(0);
      expect(result.discoveryData).toBeDefined();
      expect(result.digestData).toBeUndefined();
    });

    it('should throw NotFoundError when account not found', async () => {
      (accountService.getCombinedAccountByEmail as Mock).mockResolvedValue(null);

      await expect(emailContentService.generateEmailContent('missing@example.com')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotVerifiedError when account email not verified', async () => {
      (accountService.getCombinedAccountByEmail as Mock).mockResolvedValue({
        ...mockAccount,
        emailVerified: false,
      });

      await expect(emailContentService.generateEmailContent('test@example.com')).rejects.toThrow(NotVerifiedError);
    });

    it('should throw NotFoundError when account has no profiles', async () => {
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue([]);

      await expect(emailContentService.generateEmailContent('test@example.com')).rejects.toThrow(NotFoundError);
    });
  });

  describe('generateBatchEmailContent', () => {
    const mockAccounts = [
      { id: 1, name: 'Account 1', email: 'account1@example.com', emailVerified: true },
      { id: 2, name: 'Account 2', email: 'account2@example.com', emailVerified: true },
    ];

    beforeEach(() => {
      (accountService.getAccounts as Mock).mockResolvedValue(mockAccounts);
      (preferencesService.getAccountsWithEmailPreference as Mock)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .mockResolvedValue(mockAccounts.map(({ emailVerified, ...rest }) => rest));
      (profileService.getProfilesByAccountId as Mock).mockResolvedValue([mockProfile]);
    });

    it('should generate batch email content successfully', async () => {
      const result = await emailContentService.generateBatchEmailContent();

      expect(result.digestEmails).toHaveLength(2);
      expect(result.discoveryEmails).toHaveLength(0);
      expect(accountService.getAccounts).toHaveBeenCalled();
      expect(preferencesService.getAccountsWithEmailPreference).toHaveBeenCalledWith('weeklyDigest');
    });

    it('should handle accounts without email preferences', async () => {
      (preferencesService.getAccountsWithEmailPreference as Mock).mockResolvedValue([]);

      const result = await emailContentService.generateBatchEmailContent();

      expect(result.digestEmails).toHaveLength(0);
      expect(result.discoveryEmails).toHaveLength(0);
      expect(cliLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('is configured not to receive the weekly digest'),
      );
    });

    it('should return empty arrays when no accounts found', async () => {
      (accountService.getAccounts as Mock).mockResolvedValue([]);

      const result = await emailContentService.generateBatchEmailContent();

      expect(result.digestEmails).toHaveLength(0);
      expect(result.discoveryEmails).toHaveLength(0);
      expect(cliLogger.error).toHaveBeenCalledWith('No accounts found, no emails will be generated');
    });
  });

  describe('generateDigestContent', () => {
    it('should generate digest content when account has upcoming content', async () => {
      const result = await emailContentService.generateDigestContent('test@example.com');

      expect(result.account.email).toBe('test@example.com');
      expect(result.digestData).toBeDefined();
      expect(result.digestData.to).toBe('test@example.com');
    });

    it('should throw NotFoundError when account has no upcoming content', async () => {
      // Mock no upcoming content
      (episodesService.getUpcomingEpisodesForProfile as Mock).mockResolvedValue([]);
      (moviesService.getUpcomingMoviesForProfile as Mock).mockResolvedValue([]);
      (showService.getNextUnwatchedEpisodesForProfile as Mock).mockResolvedValue([]);

      await expect(emailContentService.generateDigestContent('test@example.com')).rejects.toThrow(NotFoundError);
    });
  });

  describe('generateDiscoveryContent', () => {
    it('should generate discovery content successfully', async () => {
      const result = await emailContentService.generateDiscoveryContent('test@example.com');

      expect(result.account.email).toBe('test@example.com');
      expect(result.discoveryData).toBeDefined();
      expect(result.discoveryData.to).toBe('test@example.com');
      expect(result.discoveryData.data.featuredContent).toBeDefined();
    });
  });

  describe('getFeaturedContent', () => {
    it('should return featured content successfully', async () => {
      const result = await emailContentService.getFeaturedContent();

      expect(result).toEqual({
        trendingShows: expect.any(Array),
        newReleases: expect.any(Array),
        popularMovies: expect.any(Array),
      });
      expect(result.trendingShows.length).toBeLessThanOrEqual(4);
      expect(result.newReleases.length).toBeLessThanOrEqual(4);
      expect(result.popularMovies.length).toBeLessThanOrEqual(4);
    });

    it('should return empty arrays when services fail', async () => {
      const error = new Error('Service failed');
      (showService.getTrendingShows as Mock).mockRejectedValue(error);
      (showService.getTopRatedShows as Mock).mockRejectedValue(error);
      (showService.getNewlyAddedShows as Mock).mockRejectedValue(error);
      (moviesService.getTrendingMovies as Mock).mockRejectedValue(error);
      (moviesService.getTopRatedMovies as Mock).mockRejectedValue(error);
      (moviesService.getRecentlyReleasedMovies as Mock).mockRejectedValue(error);

      const result = await emailContentService.getFeaturedContent();

      expect(result).toEqual({
        trendingShows: [],
        newReleases: [],
        popularMovies: [],
      });
      expect(cliLogger.warn).toHaveBeenCalledWith(
        'Failed to get featured content, using empty arrays',
        expect.any(Error),
      );
    });
  });

  describe('private methods integration', () => {
    it('should filter content by week range correctly', async () => {
      // Mock episodes with different air dates
      const episodesOutsideRange = [
        { ...mockUpcomingEpisode, airDate: '2025-07-30' }, // Before range
        { ...mockUpcomingEpisode, airDate: '2025-08-10' }, // After range
      ];
      const episodesInRange = [
        { ...mockUpcomingEpisode, airDate: '2025-08-02' }, // In range
      ];

      (episodesService.getUpcomingEpisodesForProfile as Mock).mockResolvedValue([
        ...episodesOutsideRange,
        ...episodesInRange,
      ]);

      const result = await emailContentService.generateEmailContent('test@example.com');

      // Should only include episodes within the week range in the digest
      expect(result.profileAnalyses[0].weeklyUpcomingEpisodes).toHaveLength(1);
      expect(result.profileAnalyses[0].weeklyUpcomingEpisodes[0].airDate).toBe('2025-08-02');
    });

    it('should deduplicate trending and top-rated content', async () => {
      // Mock overlapping content
      const overlappingShow = { id: 1, title: 'Popular Show' };
      (showService.getTrendingShows as Mock).mockResolvedValue([overlappingShow]);
      (showService.getTopRatedShows as Mock).mockResolvedValue([overlappingShow]);

      const result = await emailContentService.getFeaturedContent();

      // Should deduplicate the overlapping show
      expect(result.trendingShows.filter((show) => show.id === 1)).toHaveLength(1);
    });

    it('should handle profiles with mixed content availability', async () => {
      const profileWithContent = { id: 1, name: 'Profile 1' };
      const profileWithoutContent = { id: 2, name: 'Profile 2' };

      (profileService.getProfilesByAccountId as Mock).mockResolvedValue([profileWithContent, profileWithoutContent]);

      (episodesService.getUpcomingEpisodesForProfile as Mock).mockImplementation((profileId) => {
        if (profileId === 1) return Promise.resolve([mockUpcomingEpisode]);
        return Promise.resolve([]);
      });

      (moviesService.getUpcomingMoviesForProfile as Mock).mockImplementation((profileId) => {
        if (profileId === 1) return Promise.resolve([mockUpcomingMovie]);
        return Promise.resolve([]);
      });

      (showService.getNextUnwatchedEpisodesForProfile as Mock).mockImplementation((profileId) => {
        if (profileId === 1) return Promise.resolve([mockContinueWatching]);
        return Promise.resolve([]);
      });

      const result = await emailContentService.generateEmailContent('test@example.com');

      expect(result.profileCount).toBe(2);
      expect(result.profilesWithContent).toBe(1);
      expect(result.profileAnalyses).toHaveLength(2);
      expect(result.profileAnalyses[0].hasContent).toBe(true);
      expect(result.profileAnalyses[1].hasContent).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully in featured content', async () => {
      (showService.getTrendingShows as Mock).mockRejectedValue(new Error('Trending shows failed'));
      (moviesService.getTrendingMovies as Mock).mockRejectedValue(new Error('Trending movies failed'));

      const result = await emailContentService.getFeaturedContent();

      expect(result.trendingShows).toEqual([]);
      expect(result.popularMovies).toEqual([]);
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to get trending shows', expect.any(Error));
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to get popular movies', expect.any(Error));
    });

    it('should continue processing other accounts when one fails', async () => {
      const accounts = [
        { id: 1, name: 'Good Account', email: 'good@example.com', emailVerified: true },
        { id: 2, name: 'Bad Account', email: 'bad@example.com', emailVerified: true },
      ];

      (accountService.getAccounts as Mock).mockResolvedValue(accounts);
      (preferencesService.getAccountsWithEmailPreference as Mock)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .mockResolvedValue(accounts.map(({ emailVerified, ...rest }) => rest));

      (profileService.getProfilesByAccountId as Mock).mockImplementation((accountId) => {
        if (accountId === 1) return Promise.resolve([mockProfile]);
        if (accountId === 2) throw new Error('Profile service failed');
        return Promise.resolve([]);
      });

      const result = await emailContentService.generateBatchEmailContent();

      // Should process the good account and continue despite the bad one
      expect(result.digestEmails).toHaveLength(1);
      expect(result.digestEmails[0].to).toBe('good@example.com');
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to process account: bad@example.com - ', expect.any(Error));
    });
  });
});
