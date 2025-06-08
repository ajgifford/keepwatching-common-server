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

const mockedAccountService = accountService as jest.Mocked<typeof accountService>;
const mockedProfileService = profileService as jest.Mocked<typeof profileService>;
const mockedErrorService = errorService as jest.Mocked<typeof errorService>;
const mockedAppLogger = appLogger as jest.Mocked<typeof appLogger>;
const mockedCliLogger = cliLogger as jest.Mocked<typeof cliLogger>;

const mockedGetUpcomingWeekRange = getUpcomingWeekRange as jest.MockedFunction<typeof getUpcomingWeekRange>;
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

  // Test data
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

    mockedGetUpcomingWeekRange.mockReturnValue(mockWeekRange);
    mockedGenerateWeeklyDigestHTML.mockReturnValue('<html>Digest HTML</html>');
    mockedGenerateWeeklyDigestText.mockReturnValue('Digest Text');
    mockedGenerateDiscoveryEmailHTML.mockReturnValue('<html>Discovery HTML</html>');
    mockedGenerateDiscoveryEmailText.mockReturnValue('Discovery Text');
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
      expect(mockedCliLogger.info).toHaveBeenCalledWith('Email service connection verified successfully');
    });

    it('should return false and log error when connection fails', async () => {
      const error = new Error('Connection failed');
      mockVerify.mockRejectedValue(error);

      const result = await emailService.verifyConnection();

      expect(result).toBe(false);
      expect(mockedCliLogger.error).toHaveBeenCalledWith('Email service connection failed', error);
    });
  });

  describe('sendWeeklyDigests', () => {
    const mockDigestEmail: DigestEmail = {
      to: 'john@example.com',
      accountName: 'John Doe',
      profiles: [],
      weekRange: mockWeekRange,
    };

    const mockDiscoveryEmail: DiscoveryEmail = {
      to: 'jane@example.com',
      accountName: 'Jane Doe',
      data: {
        accountName: 'Jane Doe',
        profiles: [],
        featuredContent: {
          trendingShows: [],
          newReleases: [],
          popularMovies: [],
        },
        weekRange: mockWeekRange,
      },
    };

    beforeEach(() => {
      // Mock the private generateAllEmails method
      const generateAllEmailsSpy = jest.spyOn(emailService as any, 'generateAllEmails');
      generateAllEmailsSpy.mockResolvedValue({
        digestEmails: [mockDigestEmail],
        discoveryEmails: [mockDiscoveryEmail],
      });

      // Mock the private send methods
      const sendWeeklyDigestEmailSpy = jest.spyOn(emailService as any, 'sendWeeklyDigestEmail');
      const sendWeeklyDiscoveryEmailSpy = jest.spyOn(emailService as any, 'sendWeeklyDiscoveryEmail');
      sendWeeklyDigestEmailSpy.mockResolvedValue(undefined);
      sendWeeklyDiscoveryEmailSpy.mockResolvedValue(undefined);
    });

    it('should send digest and discovery emails successfully', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'test-id' });

      await emailService.sendWeeklyDigests();

      expect(mockedCliLogger.info).toHaveBeenCalledWith('Starting weekly digest email job');
      expect(mockedAppLogger.info).toHaveBeenCalledWith('Weekly digest email job started');
      expect(mockedCliLogger.info).toHaveBeenCalledWith('Weekly email job completed: 2 sent, 0 failed');
      expect(mockedAppLogger.info).toHaveBeenCalledWith('Weekly email job completed', {
        digestEmails: 1,
        discoveryEmails: 1,
        emailsSent: 2,
        emailsFailed: 0,
      });
    });

    it('should handle email sending failures gracefully', async () => {
      const sendError = new Error('Send failed');
      const sendWeeklyDigestEmailSpy = jest.spyOn(emailService as any, 'sendWeeklyDigestEmail');
      sendWeeklyDigestEmailSpy.mockRejectedValue(sendError);

      await emailService.sendWeeklyDigests();

      expect(mockedCliLogger.error).toHaveBeenCalledWith('Failed to send digest email to: john@example.com', sendError);
      expect(mockedAppLogger.error).toHaveBeenCalledWith('Digest email failed', {
        email: 'john@example.com',
        error: sendError,
      });
      expect(mockedCliLogger.info).toHaveBeenCalledWith('Weekly email job completed: 1 sent, 1 failed');
    });

    it('should handle generateAllEmails failure and rethrow error', async () => {
      const generateError = new Error('Generate failed');
      const generateAllEmailsSpy = jest.spyOn(emailService as any, 'generateAllEmails');
      generateAllEmailsSpy.mockRejectedValue(generateError);

      await expect(emailService.sendWeeklyDigests()).rejects.toThrow(generateError);

      expect(mockedCliLogger.error).toHaveBeenCalledWith('Weekly email job failed', generateError);
      expect(mockedAppLogger.error).toHaveBeenCalledWith('Weekly email job failed', { error: generateError });
      expect(mockedErrorService.handleError).toHaveBeenCalledWith(generateError, 'sendWeeklyDigests');
    });
  });

  describe('sendManualDigestEmailToAccount', () => {
    beforeEach(() => {
      mockedAccountService.getCombinedAccountByEmail.mockResolvedValue(mockAccount);
      mockedProfileService.getProfilesByAccountId.mockResolvedValue([mockProfile]);

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

      expect(mockedAccountService.getCombinedAccountByEmail).toHaveBeenCalledWith('john@example.com');
      expect(mockedProfileService.getProfilesByAccountId).toHaveBeenCalledWith(mockAccount.id);
      expect(mockedCliLogger.info).toHaveBeenCalledWith('Test weekly digest sent to account: john@example.com');
    });

    it('should throw NotFoundError when account not found', async () => {
      mockedAccountService.getCombinedAccountByEmail.mockResolvedValue(null);

      await expect(emailService.sendManualDigestEmailToAccount('missing@example.com')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotVerifiedError when account email not verified', async () => {
      mockedAccountService.getCombinedAccountByEmail.mockResolvedValue({
        ...mockAccount,
        emailVerified: false,
      });

      await expect(emailService.sendManualDigestEmailToAccount('john@example.com')).rejects.toThrow(NotVerifiedError);
    });

    it('should throw NotFoundError when account has no profiles', async () => {
      mockedProfileService.getProfilesByAccountId.mockResolvedValue([]);

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
      mockedAccountService.getCombinedAccountByEmail.mockResolvedValue(mockAccount);
      mockedProfileService.getProfilesByAccountId.mockResolvedValue([mockProfile]);

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

      expect(mockedAccountService.getCombinedAccountByEmail).toHaveBeenCalledWith('john@example.com');
      expect(mockedProfileService.getProfilesByAccountId).toHaveBeenCalledWith(mockAccount.id);
      expect(mockedCliLogger.info).toHaveBeenCalledWith('Test weekly discovery email sent to: john@example.com');
    });

    it('should throw NotFoundError when account not found', async () => {
      mockedAccountService.getCombinedAccountByEmail.mockResolvedValue(null);

      await expect(emailService.sendManualDiscoveryEmailToAccount('missing@example.com')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw NotVerifiedError when account email not verified', async () => {
      mockedAccountService.getCombinedAccountByEmail.mockResolvedValue({
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
      mockedAccountService.getCombinedAccountByEmail.mockResolvedValue(mockAccount);
      mockedProfileService.getProfilesByAccountId.mockResolvedValue([mockProfile]);
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
      expect(mockedCliLogger.info).toHaveBeenCalledWith('Test weekly digest sent to account: john@example.com');
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
      expect(mockedCliLogger.info).toHaveBeenCalledWith('Test discovery email sent to account: john@example.com');
    });

    it('should throw NotFoundError when account not found', async () => {
      mockedAccountService.getCombinedAccountByEmail.mockResolvedValue(null);

      await expect(emailService.sendManualEmailToAccount('missing@example.com')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when account has no profiles', async () => {
      mockedProfileService.getProfilesByAccountId.mockResolvedValue([]);

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
      mockedAccountService.getCombinedAccountByEmail.mockResolvedValue(mockAccount);
      mockedProfileService.getProfilesByAccountId.mockResolvedValue([mockProfile]);

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
      mockedAccountService.getCombinedAccountByEmail.mockResolvedValue(null);

      await expect(emailService.previewWeeklyDigestForAccount('missing@example.com')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotVerifiedError when account email not verified', async () => {
      mockedAccountService.getCombinedAccountByEmail.mockResolvedValue({
        ...mockAccount,
        emailVerified: false,
      });

      await expect(emailService.previewWeeklyDigestForAccount('john@example.com')).rejects.toThrow(NotVerifiedError);
    });

    it('should throw NotFoundError when account has no profiles', async () => {
      mockedProfileService.getProfilesByAccountId.mockResolvedValue([]);

      await expect(emailService.previewWeeklyDigestForAccount('john@example.com')).rejects.toThrow(NotFoundError);
    });
  });

  describe('private methods', () => {
    describe('sendWeeklyDigestEmail', () => {
      it('should send digest email with correct parameters', async () => {
        const digestEmail: DigestEmail = {
          to: 'john@example.com',
          accountName: 'John Doe',
          profiles: [],
          weekRange: mockWeekRange,
        };

        mockSendMail.mockResolvedValue({ messageId: 'test-id' });

        await (emailService as any).sendWeeklyDigestEmail(digestEmail);

        expect(mockedGenerateWeeklyDigestHTML).toHaveBeenCalledWith(digestEmail);
        expect(mockedGenerateWeeklyDigestText).toHaveBeenCalledWith(digestEmail);
        expect(mockSendMail).toHaveBeenCalledWith({
          from: mockConfig.from,
          to: digestEmail.to,
          subject: `Your Weekly Watch Guide - ${mockWeekRange.start} to ${mockWeekRange.end}`,
          html: '<html>Digest HTML</html>',
          text: 'Digest Text',
        });
      });

      it('should handle email sending errors', async () => {
        const digestEmail: DigestEmail = {
          to: 'john@example.com',
          accountName: 'John Doe',
          profiles: [],
          weekRange: mockWeekRange,
        };

        const sendError = new Error('Send failed');
        mockSendMail.mockRejectedValue(sendError);

        await expect((emailService as any).sendWeeklyDigestEmail(digestEmail)).rejects.toThrow(sendError);
        expect(mockedErrorService.handleError).toHaveBeenCalledWith(
          sendError,
          `sendWeeklyDigestEmail(${digestEmail.to})`,
        );
      });
    });

    describe('sendWeeklyDiscoveryEmail', () => {
      it('should send discovery email with correct parameters', async () => {
        const discoveryEmail: DiscoveryEmail = {
          to: 'john@example.com',
          accountName: 'John Doe',
          data: {
            accountName: 'John Doe',
            profiles: [],
            featuredContent: {
              trendingShows: [],
              newReleases: [],
              popularMovies: [],
            },
            weekRange: mockWeekRange,
          },
        };

        mockSendMail.mockResolvedValue({ messageId: 'test-id' });

        await (emailService as any).sendWeeklyDiscoveryEmail(discoveryEmail);

        expect(mockedGenerateDiscoveryEmailHTML).toHaveBeenCalledWith(discoveryEmail);
        expect(mockedGenerateDiscoveryEmailText).toHaveBeenCalledWith(discoveryEmail);
        expect(mockSendMail).toHaveBeenCalledWith({
          from: mockConfig.from,
          to: discoveryEmail.to,
          subject: `🎬 Discover Something New This Week - ${mockWeekRange.start} to ${mockWeekRange.end}`,
          html: '<html>Discovery HTML</html>',
          text: 'Discovery Text',
        });
      });

      it('should handle email sending errors', async () => {
        const discoveryEmail: DiscoveryEmail = {
          to: 'john@example.com',
          accountName: 'John Doe',
          data: {
            accountName: 'John Doe',
            profiles: [],
            featuredContent: {
              trendingShows: [],
              newReleases: [],
              popularMovies: [],
            },
            weekRange: mockWeekRange,
          },
        };

        const sendError = new Error('Send failed');
        mockSendMail.mockRejectedValue(sendError);

        await expect((emailService as any).sendWeeklyDiscoveryEmail(discoveryEmail)).rejects.toThrow(sendError);
        expect(mockedErrorService.handleError).toHaveBeenCalledWith(
          sendError,
          `sendWeeklyDiscoveryEmail(${discoveryEmail.to})`,
        );
      });
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
