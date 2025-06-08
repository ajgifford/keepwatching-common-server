import { AccountContentAnalysis, DigestEmail, DiscoveryEmail } from '../../../src/types/emailTypes';
import {
  CombinedAccount,
  KeepWatchingShow,
  MovieReference,
  Profile,
  RecentUpcomingEpisode,
} from '@ajgifford/keepwatching-types';
import { EmailConfig } from '@config/config';
import { appLogger, cliLogger } from '@logger/logger';
import { NotFoundError, NotVerifiedError } from '@middleware/errorMiddleware';
import { accountService } from '@services/accountService';
import { EmailService, getEmailService, initializeEmailService } from '@services/emailService';
import { episodesService } from '@services/episodesService';
import { errorService } from '@services/errorService';
import { moviesService } from '@services/moviesService';
import { profileService } from '@services/profileService';
import { showService } from '@services/showService';
import {
  generateDiscoveryEmailHTML,
  generateDiscoveryEmailText,
  generateWeeklyDigestHTML,
  generateWeeklyDigestText,
  getUpcomingWeekRange,
} from '@utils/emailUtility';
import { profile } from 'console';
import nodemailer from 'nodemailer';

jest.mock('@logger/logger');
jest.mock('@services/accountService');
jest.mock('@services/profileService');
jest.mock('@services/episodesService');
jest.mock('@services/moviesService');
jest.mock('@services/showService');
jest.mock('@services/errorService');
jest.mock('@utils/emailUtility');
jest.mock('nodemailer');

const mockSendMail = jest.fn();
const mockVerify = jest.fn();
const mockCreateTransporter = jest.fn().mockReturnValue({
  sendMail: mockSendMail,
  verify: mockVerify,
});
(nodemailer.createTransport as jest.Mock) = mockCreateTransporter;

const mockedGenerateWeeklyDigestHTML = generateWeeklyDigestHTML as jest.MockedFunction<typeof generateWeeklyDigestHTML>;
const mockedGenerateWeeklyDigestText = generateWeeklyDigestText as jest.MockedFunction<typeof generateWeeklyDigestText>;
const mockedGenerateDiscoveryEmailHTML = generateDiscoveryEmailHTML as jest.MockedFunction<
  typeof generateDiscoveryEmailHTML
>;
const mockedGenerateDiscoveryEmailText = generateDiscoveryEmailText as jest.MockedFunction<
  typeof generateDiscoveryEmailText
>;

describe('EmailService', () => {
  let emailService: EmailService;
  let mockConfig: EmailConfig;

  const mockWeekRange = { start: '2025-06-02', end: '2025-06-08' };

  const mockAccount: CombinedAccount = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    emailVerified: true,
    uid: '',
    image: 'account-image-1.png',
    defaultProfileId: 0,
    displayName: '',
    photoURL: '',
    disabled: false,
    metadata: {
      creationTime: '',
      lastSignInTime: '',
      lastRefreshTime: '',
    },
    databaseCreatedAt: new Date('2024-12-20T00:00:00'),
  };

  const mockProfile: Profile = {
    id: 1,
    accountId: 1,
    name: 'John Profile',
    image: 'profile-image-2.png',
  };

  const mockUpcomingEpisode: RecentUpcomingEpisode = {
    profileId: 1,
    showId: 1,
    seasonNumber: 1,
    episodeNumber: 5,
    episodeTitle: 'Test Episode',
    airDate: '2025-06-05',
    episodeStillImage: '/test.jpg',
    showName: 'Test Show',
    streamingServices: '',
    network: '',
  };

  const mockMovie: MovieReference = {
    id: 1,
    title: 'Test Movie',
    tmdbId: 101,
  };

  const mockContinueWatching: KeepWatchingShow = {
    showId: 1,
    showTitle: 'Test Show',
    posterImage: '/poster.jpg',
    lastWatched: '2025-05-01T00:00:00',
    episodes: [
      {
        episodeTitle: 'Next Episode',
        seasonNumber: 1,
        episodeNumber: 6,
        airDate: '2025-06-06',
        episodeId: 0,
        overview: '',
        episodeStillImage: '',
        showId: 0,
        showName: '',
        seasonId: 0,
        posterImage: '',
        network: '',
        streamingServices: '',
        profileId: 0,
      },
    ],
  };

  const mockTopRatedShows = [
    { id: 6, tmdbId: 201, title: 'Legends Never Die' },
    { id: 7, tmdbId: 202, title: 'Celestial Wars' },
    { id: 8, tmdbId: 203, title: 'Iron Truth' },
    { id: 9, tmdbId: 204, title: 'Empire of Ashes' },
    { id: 10, tmdbId: 205, title: 'Chronicles of Terra' },
  ];
  const mockTrendingShows = [
    { id: 1, tmdbId: 101, title: 'Echoes of Time' },
    { id: 2, tmdbId: 102, title: 'Digital Shadows' },
    { id: 3, tmdbId: 103, title: 'The Forgotten Code' },
    { id: 4, tmdbId: 104, title: 'Zero Signal' },
    { id: 5, tmdbId: 105, title: 'Quantum Division' },
  ];
  const mockNewShows = [
    { id: 11, tmdbId: 301, title: 'Neon Divide' },
    { id: 12, tmdbId: 302, title: 'Encrypted' },
    { id: 13, tmdbId: 303, title: 'The Drift' },
    { id: 14, tmdbId: 304, title: 'Crimson Protocol' },
    { id: 15, tmdbId: 305, title: 'Urban Myths' },
  ];
  const mockTopRatedMovies = [
    { id: 26, tmdbId: 601, title: 'Kingdom Come' },
    { id: 27, tmdbId: 602, title: 'The Eternal Quest' },
    { id: 28, tmdbId: 603, title: 'Iron Resolve' },
    { id: 29, tmdbId: 604, title: 'Twilight Siege' },
    { id: 30, tmdbId: 605, title: 'The Last Dominion' },
  ];
  const mockTrendingMovies = [
    { id: 21, tmdbId: 501, title: 'Nightfall Protocol' },
    { id: 22, tmdbId: 502, title: 'Synthetic Dreams' },
    { id: 23, tmdbId: 503, title: 'The Mercury Directive' },
    { id: 24, tmdbId: 504, title: 'Obsidian Skies' },
    { id: 25, tmdbId: 505, title: 'AI Uprising' },
  ];
  const mockNewMovies = [
    { id: 16, tmdbId: 401, title: 'Solar Flare' },
    { id: 17, tmdbId: 402, title: 'Last Transmission' },
    { id: 18, tmdbId: 403, title: 'Glacier Run' },
    { id: 19, tmdbId: 404, title: 'The Collapse' },
    { id: 20, tmdbId: 405, title: 'Fractured Earth' },
  ];
  const mockUpcomingProfileEpisodes = [
    {
      profileId: 1,
      showId: 101,
      showName: 'Echoes of Time',
      streamingServices: 'Netflix',
      network: 'Netflix',
      episodeTitle: 'Ripple Effect',
      airDate: '2025-06-10',
      episodeNumber: 3,
      seasonNumber: 2,
      episodeStillImage: 'https://example.com/images/echoes-s2e3.jpg',
    },
    {
      profileId: 1,
      showId: 102,
      showName: 'Digital Shadows',
      streamingServices: 'Hulu',
      network: 'FX',
      episodeTitle: 'Ghost Protocol',
      airDate: '2025-06-11',
      episodeNumber: 5,
      seasonNumber: 1,
      episodeStillImage: 'https://example.com/images/digital-s1e5.jpg',
    },
    {
      profileId: 1,
      showId: 103,
      showName: 'The Forgotten Code',
      streamingServices: 'HBO Max',
      network: 'HBO',
      episodeTitle: 'Line of Memory',
      airDate: '2025-06-09',
      episodeNumber: 7,
      seasonNumber: 3,
      episodeStillImage: 'https://example.com/images/forgotten-s3e7.jpg',
    },
    {
      profileId: 1,
      showId: 104,
      showName: 'Zero Signal',
      streamingServices: 'Amazon Prime',
      network: 'Prime Video',
      episodeTitle: 'Static Noise',
      airDate: '2025-06-08',
      episodeNumber: 2,
      seasonNumber: 2,
      episodeStillImage: 'https://example.com/images/zero-s2e2.jpg',
    },
    {
      profileId: 1,
      showId: 105,
      showName: 'Quantum Division',
      streamingServices: 'Disney+',
      network: 'Marvel Studios',
      episodeTitle: 'Multiverse Unraveled',
      airDate: '2025-06-12',
      episodeNumber: 6,
      seasonNumber: 1,
      episodeStillImage: 'https://example.com/images/quantum-s1e6.jpg',
    },
  ];
  const mockUpcomingProfileMovies = [
    { id: 16, tmdbId: 401, title: 'Solar Flare' },
    { id: 17, tmdbId: 402, title: 'Last Transmission' },
    { id: 18, tmdbId: 403, title: 'Glacier Run' },
  ];
  const mockNextUnwatchedEpisodes = [
    {
      showId: 101,
      showTitle: 'Echoes of Time',
      posterImage: 'https://example.com/posters/echoes.jpg',
      lastWatched: '2025-06-06T20:30:00Z',
      episodes: [
        {
          episodeId: 301,
          episodeTitle: 'Ripple Effect',
          overview: 'Tensions rise as a paradox threatens reality.',
          episodeNumber: 3,
          seasonNumber: 2,
          episodeStillImage: 'https://example.com/images/echoes-s2e3.jpg',
          airDate: '2025-06-10',
          showId: 101,
          showName: 'Echoes of Time',
          seasonId: 202,
          posterImage: 'https://example.com/posters/echoes.jpg',
          network: 'Netflix',
          streamingServices: 'Netflix',
          profileId: 1,
        },
      ],
    },
    {
      showId: 103,
      showTitle: 'The Forgotten Code',
      posterImage: 'https://example.com/posters/code.jpg',
      lastWatched: '2025-06-05T19:15:00Z',
      episodes: [
        {
          episodeId: 303,
          episodeTitle: 'Line of Memory',
          overview: 'A dangerous truth resurfaces from buried archives.',
          episodeNumber: 7,
          seasonNumber: 3,
          episodeStillImage: 'https://example.com/images/forgotten-s3e7.jpg',
          airDate: '2025-06-09',
          showId: 103,
          showName: 'The Forgotten Code',
          seasonId: 303,
          posterImage: 'https://example.com/posters/code.jpg',
          network: 'HBO',
          streamingServices: 'HBO Max',
          profileId: 2,
        },
      ],
    },
    {
      showId: 104,
      showTitle: 'Zero Signal',
      posterImage: 'https://example.com/posters/zero.jpg',
      lastWatched: '2025-06-07T14:45:00Z',
      episodes: [
        {
          episodeId: 304,
          episodeTitle: 'Static Noise',
          overview: 'Interference leads to a surprising revelation.',
          episodeNumber: 2,
          seasonNumber: 2,
          episodeStillImage: 'https://example.com/images/zero-s2e2.jpg',
          airDate: '2025-06-08',
          showId: 104,
          showName: 'Zero Signal',
          seasonId: 204,
          posterImage: 'https://example.com/posters/zero.jpg',
          network: 'Prime Video',
          streamingServices: 'Amazon Prime',
          profileId: 3,
        },
      ],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      auth: {
        user: 'test@example.com',
        pass: 'testPass',
      },
      from: 'noreply@test.com',
    };

    emailService = new EmailService(mockConfig);

    (getUpcomingWeekRange as jest.Mock).mockReturnValue(mockWeekRange);

    (errorService.handleError as jest.Mock).mockImplementation((error) => {
      throw error;
    });
  });

  describe('constructor', () => {
    it('should create transporter with correct configuration', () => {
      expect(mockCreateTransporter).toHaveBeenCalledWith({
        host: mockConfig.host,
        port: mockConfig.port,
        secure: mockConfig.secure,
        auth: mockConfig.auth,
      });
    });
  });

  describe('verifyConnection', () => {
    it('should return true when connection is successful', async () => {
      mockVerify.mockResolvedValue(true);

      const result = await emailService.verifyConnection();

      expect(result).toBe(true);
      expect(mockVerify).toHaveBeenCalled();
      expect(cliLogger.info).toHaveBeenCalledWith('Email service connection verified successfully');
    });

    it('should return false and log error when connection fails', async () => {
      const error = new Error('Connection failed');
      mockVerify.mockRejectedValue(error);

      const result = await emailService.verifyConnection();

      expect(result).toBe(false);
      expect(cliLogger.error).toHaveBeenCalledWith('Email service connection failed', error);
    });
  });

  describe('sendWeeklyDigests', () => {
    const mockAccounts = [
      { id: 1, name: 'Account 1', email: 'account1@example.com', emailVerified: true },
      { id: 2, name: 'Account 2', email: 'account2@example.com', emailVerified: true },
      { id: 3, name: 'Account 3', email: 'account3@example.com', emailVerified: true },
    ];

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should send digest and discovery emails successfully', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'test-id' });
      (accountService.getAccounts as jest.Mock).mockResolvedValue(mockAccounts);
      (profileService.getProfilesByAccountId as jest.Mock).mockImplementation((accountId) => {
        if (accountId === 1) {
          return Promise.resolve([
            { id: 10, name: 'Profile A1' },
            { id: 11, name: 'Profile A2' },
            { id: 12, name: 'Profile A3' },
          ]);
        } else if (accountId === 2) {
          return Promise.resolve([
            { id: 20, name: 'Profile B1' },
            { id: 21, name: 'Profile B2' },
          ]);
        } else if (accountId === 3) {
          return Promise.resolve([
            { id: 30, name: 'Profile C1' },
            { id: 31, name: 'Profile C2' },
          ]);
        } else {
          return Promise.resolve([]); // default
        }
      });
      (showService.getTopRatedShows as jest.Mock).mockResolvedValue(mockTopRatedShows);
      (showService.getTrendingShows as jest.Mock).mockResolvedValue(mockTrendingShows);
      (showService.getNewlyAddedShows as jest.Mock).mockResolvedValue(mockNewShows);
      (moviesService.getTopRatedMovies as jest.Mock).mockResolvedValue(mockTopRatedMovies);
      (moviesService.getTrendingMovies as jest.Mock).mockResolvedValue(mockTrendingMovies);
      (moviesService.getRecentlyReleasedMovies as jest.Mock).mockResolvedValue(mockNewMovies);

      (showService.getNextUnwatchedEpisodesForProfile as jest.Mock).mockImplementation((profileId) => {
        if (profileId === 30 || profileId === 31) {
          return [];
        } else {
          return mockNextUnwatchedEpisodes;
        }
      });
      (episodesService.getUpcomingEpisodesForProfile as jest.Mock).mockImplementation((profileId) => {
        if (profileId === 30 || profileId === 31) {
          return [];
        } else {
          return mockUpcomingProfileEpisodes;
        }
      });
      (moviesService.getUpcomingMoviesForProfile as jest.Mock).mockImplementation((profileId) => {
        if (profileId === 30 || profileId === 31) {
          return [];
        } else {
          return mockUpcomingProfileMovies;
        }
      });

      await emailService.sendWeeklyDigests();

      expect(cliLogger.info).toHaveBeenCalledWith('Starting weekly digest email job');
      expect(cliLogger.info).toHaveBeenCalledWith('Digest email sent to: account1@example.com');
      expect(cliLogger.info).toHaveBeenCalledWith('Digest email sent to: account2@example.com');
      expect(cliLogger.info).toHaveBeenCalledWith('Discovery email sent to: account3@example.com');
      expect(cliLogger.info).toHaveBeenCalledWith('Weekly email job completed: 3 sent, 0 failed');

      expect(appLogger.info).toHaveBeenCalledWith('Weekly digest email job started');
      expect(appLogger.info).toHaveBeenCalledWith('Weekly email job completed', {
        digestEmails: 2,
        discoveryEmails: 1,
        emailsSent: 3,
        emailsFailed: 0,
      });
    });

    it('should not send digest and discovery emails when there are no accounts', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'test-id' });
      (accountService.getAccounts as jest.Mock).mockResolvedValueOnce([]);

      await emailService.sendWeeklyDigests();

      expect(cliLogger.info).toHaveBeenCalledWith('Starting weekly digest email job');
      expect(cliLogger.info).toHaveBeenCalledWith('Weekly email job completed: 0 sent, 0 failed');

      expect(appLogger.info).toHaveBeenCalledWith('Weekly digest email job started');
      expect(appLogger.info).toHaveBeenCalledWith('Weekly email job completed', {
        digestEmails: 0,
        discoveryEmails: 0,
        emailsSent: 0,
        emailsFailed: 0,
      });
    });

    it('should not send digest and discovery emails when the accounts email is not verified', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'test-id' });
      (accountService.getAccounts as jest.Mock).mockResolvedValueOnce([
        { id: 5, name: 'Account 5', email: 'account5@example.com', emailVerified: false },
      ]);

      await emailService.sendWeeklyDigests();

      expect(cliLogger.info).toHaveBeenCalledWith('Starting weekly digest email job');
      expect(cliLogger.error).toHaveBeenCalledWith(
        `Failed to process account: account5@example.com - `,
        new NotVerifiedError(),
      );
      expect(cliLogger.info).toHaveBeenCalledWith('Weekly email job completed: 0 sent, 0 failed');

      expect(appLogger.info).toHaveBeenCalledWith('Weekly digest email job started');
      expect(appLogger.info).toHaveBeenCalledWith('Weekly email job completed', {
        digestEmails: 0,
        discoveryEmails: 0,
        emailsSent: 0,
        emailsFailed: 0,
      });
    });

    it('should handle errors from the featured content when sending a discovery email', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'test-id' });
      (accountService.getAccounts as jest.Mock).mockResolvedValueOnce([
        { id: 3, name: 'Account 3', email: 'account3@example.com', emailVerified: true },
      ]);
      (profileService.getProfilesByAccountId as jest.Mock).mockImplementation((accountId) => {
        if (accountId === 3) {
          return Promise.resolve([
            { id: 30, name: 'Profile C1' },
            { id: 31, name: 'Profile C2' },
          ]);
        } else {
          return Promise.resolve([]);
        }
      });

      const mockError = new Error('service error');
      (showService.getTrendingShows as jest.Mock).mockRejectedValueOnce(mockError);
      (showService.getNewlyAddedShows as jest.Mock).mockRejectedValueOnce(mockError);
      (moviesService.getTrendingMovies as jest.Mock).mockRejectedValueOnce(mockError);

      (showService.getNextUnwatchedEpisodesForProfile as jest.Mock).mockImplementation((profileId) => {
        if (profileId === 30 || profileId === 31) {
          return [];
        } else {
          return mockNextUnwatchedEpisodes;
        }
      });
      (episodesService.getUpcomingEpisodesForProfile as jest.Mock).mockImplementation((profileId) => {
        if (profileId === 30 || profileId === 31) {
          return [];
        } else {
          return mockUpcomingProfileEpisodes;
        }
      });
      (moviesService.getUpcomingMoviesForProfile as jest.Mock).mockImplementation((profileId) => {
        if (profileId === 30 || profileId === 31) {
          return [];
        } else {
          return mockUpcomingProfileMovies;
        }
      });

      await emailService.sendWeeklyDigests();

      expect(cliLogger.info).toHaveBeenCalledWith('Starting weekly digest email job');
      expect(cliLogger.error).toHaveBeenCalledWith(`Failed to get trending shows`, mockError);
      expect(cliLogger.error).toHaveBeenCalledWith(`Failed to get new releases`, mockError);
      expect(cliLogger.error).toHaveBeenCalledWith(`Failed to get popular movies`, mockError);
      expect(cliLogger.info).toHaveBeenCalledWith('Weekly email job completed: 1 sent, 0 failed');

      expect(appLogger.info).toHaveBeenCalledWith('Weekly digest email job started');
      expect(appLogger.info).toHaveBeenCalledWith('Weekly email job completed', {
        digestEmails: 0,
        discoveryEmails: 1,
        emailsSent: 1,
        emailsFailed: 0,
      });
    });

    it('should handle email sending failures gracefully', async () => {
      (accountService.getAccounts as jest.Mock).mockResolvedValue(mockAccounts);
      (profileService.getProfilesByAccountId as jest.Mock).mockImplementation((accountId) => {
        if (accountId === 1) {
          return Promise.resolve([
            { id: 10, name: 'Profile A1' },
            { id: 11, name: 'Profile A2' },
            { id: 12, name: 'Profile A3' },
          ]);
        } else if (accountId === 2) {
          return Promise.resolve([
            { id: 20, name: 'Profile B1' },
            { id: 21, name: 'Profile B2' },
          ]);
        } else if (accountId === 3) {
          return Promise.resolve([
            { id: 30, name: 'Profile C1' },
            { id: 31, name: 'Profile C2' },
          ]);
        } else {
          return Promise.resolve([]); // default
        }
      });
      const mockError = new Error('Failed to send');
      const sendWeeklyDigestEmailSpy = jest.spyOn(emailService as any, 'sendWeeklyDigestEmail');
      sendWeeklyDigestEmailSpy.mockRejectedValue(mockError);
      const sendWeeklyDiscoveryEmailSpy = jest.spyOn(emailService as any, 'sendWeeklyDiscoveryEmail');
      sendWeeklyDiscoveryEmailSpy.mockRejectedValue(mockError);

      await emailService.sendWeeklyDigests();

      expect(cliLogger.error).toHaveBeenCalledWith('Failed to send digest email to: account1@example.com', mockError);
      expect(cliLogger.error).toHaveBeenCalledWith('Failed to send digest email to: account2@example.com', mockError);
      expect(cliLogger.error).toHaveBeenCalledWith(
        'Failed to send discovery email to: account3@example.com',
        mockError,
      );
      expect(appLogger.error).toHaveBeenCalledWith('Digest email failed', {
        email: 'account1@example.com',
        error: mockError,
      });
      expect(cliLogger.info).toHaveBeenCalledWith('Weekly email job completed: 0 sent, 3 failed');
    });

    it('should handle and rethrow error', async () => {
      const mockError = new Error('Generate failed');
      const generateAllEmailsSpy = jest.spyOn(emailService as any, 'generateAllEmails');
      generateAllEmailsSpy.mockRejectedValue(mockError);

      await expect(emailService.sendWeeklyDigests()).rejects.toThrow(mockError);

      expect(cliLogger.error).toHaveBeenCalledWith('Weekly email job failed', mockError);
      expect(appLogger.error).toHaveBeenCalledWith('Weekly email job failed', { error: mockError });
      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'sendWeeklyDigests');
    });
  });

  describe('sendManualDigestEmailToAccount', () => {
    beforeEach(() => {
      (accountService.getCombinedAccountByEmail as jest.Mock).mockResolvedValue(mockAccount);
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue([mockProfile]);

      // Mock analyzeAccountContent method
      const analyzeAccountContentSpy = jest.spyOn(emailService as any, 'analyzeAccountContent');
      analyzeAccountContentSpy.mockResolvedValue({
        hasUpcomingContent: true,
        profileDigests: [],
      });

      // Mock sendWeeklyDigestEmail method
      const sendWeeklyDigestEmailSpy = jest.spyOn(emailService as any, 'sendWeeklyDigestEmail');
      sendWeeklyDigestEmailSpy.mockResolvedValue(undefined);
    });

    it('should send digest email to specific account', async () => {
      await emailService.sendManualDigestEmailToAccount('john@example.com');

      expect(accountService.getCombinedAccountByEmail).toHaveBeenCalledWith('john@example.com');
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(mockAccount.id);
      expect(cliLogger.info).toHaveBeenCalledWith('Test weekly digest sent to account: john@example.com');
    });

    it('should throw NotFoundError when account not found', async () => {
      (accountService.getCombinedAccountByEmail as jest.Mock).mockResolvedValue(null);

      await expect(emailService.sendManualDigestEmailToAccount('missing@example.com')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotVerifiedError when account email not verified', async () => {
      (accountService.getCombinedAccountByEmail as jest.Mock).mockResolvedValue({
        ...mockAccount,
        emailVerified: false,
      });

      await expect(emailService.sendManualDigestEmailToAccount('john@example.com')).rejects.toThrow(NotVerifiedError);
    });

    it('should throw NotFoundError when account has no profiles', async () => {
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue([]);

      await expect(emailService.sendManualDigestEmailToAccount('john@example.com')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when account has no upcoming content', async () => {
      const analyzeAccountContentSpy = jest.spyOn(emailService as any, 'analyzeAccountContent');
      analyzeAccountContentSpy.mockResolvedValue({
        hasUpcomingContent: false,
        profileDigests: [],
      });

      await expect(emailService.sendManualDigestEmailToAccount('john@example.com')).rejects.toThrow(NotFoundError);
    });
  });

  describe('sendManualDiscoveryEmailToAccount', () => {
    beforeEach(() => {
      (accountService.getCombinedAccountByEmail as jest.Mock).mockResolvedValue(mockAccount);
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue([mockProfile]);

      // Mock getFeaturedContent method
      const getFeaturedContentSpy = jest.spyOn(emailService as any, 'getFeaturedContent');
      getFeaturedContentSpy.mockResolvedValue({
        trendingShows: [],
        newReleases: [],
        popularMovies: [],
      });

      // Mock sendWeeklyDiscoveryEmail method
      const sendWeeklyDiscoveryEmailSpy = jest.spyOn(emailService as any, 'sendWeeklyDiscoveryEmail');
      sendWeeklyDiscoveryEmailSpy.mockResolvedValue(undefined);
    });

    it('should send discovery email to specific account', async () => {
      await emailService.sendManualDiscoveryEmailToAccount('john@example.com');

      expect(accountService.getCombinedAccountByEmail).toHaveBeenCalledWith('john@example.com');
      expect(profileService.getProfilesByAccountId).toHaveBeenCalledWith(mockAccount.id);
      expect(cliLogger.info).toHaveBeenCalledWith('Test weekly discovery email sent to: john@example.com');
    });

    it('should throw NotFoundError when account not found', async () => {
      (accountService.getCombinedAccountByEmail as jest.Mock).mockResolvedValue(null);

      await expect(emailService.sendManualDiscoveryEmailToAccount('missing@example.com')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw NotVerifiedError when account email not verified', async () => {
      (accountService.getCombinedAccountByEmail as jest.Mock).mockResolvedValue({
        ...mockAccount,
        emailVerified: false,
      });

      await expect(emailService.sendManualDiscoveryEmailToAccount('john@example.com')).rejects.toThrow(
        NotVerifiedError,
      );
    });
  });

  describe('sendManualEmailToAccount', () => {
    beforeEach(() => {
      (accountService.getCombinedAccountByEmail as jest.Mock).mockResolvedValue(mockAccount);
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue([mockProfile]);
    });

    it('should send digest email when account has upcoming content', async () => {
      const analyzeAccountContentSpy = jest.spyOn(emailService as any, 'analyzeAccountContent');
      analyzeAccountContentSpy.mockResolvedValue({
        hasUpcomingContent: true,
        profileDigests: [],
      });

      const sendWeeklyDigestEmailSpy = jest.spyOn(emailService as any, 'sendWeeklyDigestEmail');
      sendWeeklyDigestEmailSpy.mockResolvedValue(undefined);

      const result = await emailService.sendManualEmailToAccount('john@example.com');

      expect(result).toEqual({ emailType: 'digest', hasContent: true });
      expect(cliLogger.info).toHaveBeenCalledWith('Test weekly digest sent to account: john@example.com');
    });

    it('should send discovery email when account has no upcoming content', async () => {
      const analyzeAccountContentSpy = jest.spyOn(emailService as any, 'analyzeAccountContent');
      analyzeAccountContentSpy.mockResolvedValue({
        hasUpcomingContent: false,
        profileDigests: [],
      });

      const getFeaturedContentSpy = jest.spyOn(emailService as any, 'getFeaturedContent');
      getFeaturedContentSpy.mockResolvedValue({
        trendingShows: [],
        newReleases: [],
        popularMovies: [],
      });

      const sendWeeklyDiscoveryEmailSpy = jest.spyOn(emailService as any, 'sendWeeklyDiscoveryEmail');
      sendWeeklyDiscoveryEmailSpy.mockResolvedValue(undefined);

      const result = await emailService.sendManualEmailToAccount('john@example.com');

      expect(result).toEqual({ emailType: 'discovery', hasContent: false });
      expect(cliLogger.info).toHaveBeenCalledWith('Test discovery email sent to account: john@example.com');
    });

    it('should throw NotFoundError when account not found', async () => {
      (accountService.getCombinedAccountByEmail as jest.Mock).mockResolvedValue(null);

      await expect(emailService.sendManualEmailToAccount('missing@example.com')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when account has no profiles', async () => {
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue([]);

      await expect(emailService.sendManualEmailToAccount('john@example.com')).rejects.toThrow(NotFoundError);
    });
  });

  describe('previewWeeklyDigestForAccount', () => {
    const mockContentAnalysis: AccountContentAnalysis = {
      hasUpcomingContent: true,
      profileAnalyses: [
        {
          profile: { id: 1, name: 'John Profile' },
          hasContent: true,
          upcomingEpisodes: [mockUpcomingEpisode],
          upcomingMovies: [mockMovie],
          continueWatching: [mockContinueWatching],
          weeklyUpcomingEpisodes: [mockUpcomingEpisode],
          weeklyUpcomingMovies: [mockMovie],
        },
      ],
      profileDigests: [],
    };

    beforeEach(() => {
      (accountService.getCombinedAccountByEmail as jest.Mock).mockResolvedValue(mockAccount);
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue([mockProfile]);

      const analyzeAccountContentSpy = jest.spyOn(emailService as any, 'analyzeAccountContent');
      analyzeAccountContentSpy.mockResolvedValue(mockContentAnalysis);
    });

    it('should return digest preview when account has upcoming content', async () => {
      const result = await emailService.previewWeeklyDigestForAccount('john@example.com');

      expect(result).toEqual({
        account: { email: mockAccount.email, name: mockAccount.name },
        emailType: 'digest',
        profileCount: 1,
        profilesWithContent: 1,
        profileAnalyses: mockContentAnalysis.profileAnalyses,
        digestData: {
          to: mockAccount.email,
          accountName: mockAccount.name,
          profiles: [],
          weekRange: mockWeekRange,
        },
      });
    });

    it('should return discovery preview when account has no upcoming content', async () => {
      const analyzeAccountContentSpy = jest.spyOn(emailService as any, 'analyzeAccountContent');
      analyzeAccountContentSpy.mockResolvedValue({
        ...mockContentAnalysis,
        hasUpcomingContent: false,
        profileAnalyses: [
          {
            ...mockContentAnalysis.profileAnalyses[0],
            hasContent: false,
          },
        ],
      });

      const getFeaturedContentSpy = jest.spyOn(emailService as any, 'getFeaturedContent');
      getFeaturedContentSpy.mockResolvedValue({
        trendingShows: [],
        newReleases: [],
        popularMovies: [],
      });

      const result = await emailService.previewWeeklyDigestForAccount('john@example.com');

      expect(result.emailType).toBe('discovery');
      expect(result.profilesWithContent).toBe(0);
      expect(result.discoveryData).toBeDefined();
    });

    it('should throw NotFoundError when account not found', async () => {
      (accountService.getCombinedAccountByEmail as jest.Mock).mockResolvedValue(null);

      await expect(emailService.previewWeeklyDigestForAccount('missing@example.com')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotVerifiedError when account email not verified', async () => {
      (accountService.getCombinedAccountByEmail as jest.Mock).mockResolvedValue({
        ...mockAccount,
        emailVerified: false,
      });

      await expect(emailService.previewWeeklyDigestForAccount('john@example.com')).rejects.toThrow(NotVerifiedError);
    });

    it('should throw NotFoundError when account has no profiles', async () => {
      (profileService.getProfilesByAccountId as jest.Mock).mockResolvedValue([]);

      await expect(emailService.previewWeeklyDigestForAccount('john@example.com')).rejects.toThrow(NotFoundError);
    });
  });
});

describe('EmailService singleton functions', () => {
  let mockConfig: EmailConfig;

  beforeEach(() => {
    // Reset singleton state
    (require('@services/emailService') as any).emailServiceInstance = null;

    mockConfig = {
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      auth: {
        user: 'test@example.com',
        pass: 'testpass',
      },
      from: 'noreply@test.com',
    };
  });

  describe('initializeEmailService', () => {
    it('should create and return EmailService instance', () => {
      const service = initializeEmailService(mockConfig);

      expect(service).toBeInstanceOf(EmailService);
      expect(mockCreateTransporter).toHaveBeenCalledWith({
        host: mockConfig.host,
        port: mockConfig.port,
        secure: mockConfig.secure,
        auth: mockConfig.auth,
      });
    });

    it('should overwrite existing instance when called again', () => {
      const service1 = initializeEmailService(mockConfig);
      const service2 = initializeEmailService(mockConfig);

      expect(service1).toBeInstanceOf(EmailService);
      expect(service2).toBeInstanceOf(EmailService);
      expect(service1).not.toBe(service2);
    });
  });

  describe('getEmailService', () => {
    it('should return initialized EmailService instance', () => {
      const initializedService = initializeEmailService(mockConfig);
      const retrievedService = getEmailService();

      expect(retrievedService).toBe(initializedService);
    });
  });
});
