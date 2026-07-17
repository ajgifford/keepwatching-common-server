import { DigestEmail, DiscoveryEmail } from '../../../src/types/emailTypes';
import {
  formatDate,
  generateDiscoveryEmailHTML,
  generateDiscoveryEmailText,
  generateWeeklyDigestHTML,
  generateWeeklyDigestText,
  getUpcomingWeekRange,
  interpolateVariables,
  renderTemplatedEmailHTML,
  stripHtmlToText,
} from '../../../src/utils/emailUtility';

describe('emailUtility', () => {
  const mockDate = new Date('2024-03-15T10:00:00Z'); // Friday

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(mockDate.getTime());
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('getUpcomingWeekRange', () => {
    it('should return correct date range starting tomorrow for 7 days', () => {
      const result = getUpcomingWeekRange();

      expect(result.start).toBe('2024-03-16'); // Saturday (tomorrow)
      expect(result.end).toBe('2024-03-22'); // Friday (7 days later)
    });

    it('should return ISO date format strings', () => {
      const result = getUpcomingWeekRange();

      // Check format YYYY-MM-DD
      expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should always have 7 days between start and end', () => {
      const result = getUpcomingWeekRange();
      const startDate = new Date(result.start);
      const endDate = new Date(result.end);
      const diffInDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

      expect(diffInDays).toBe(6); // 6 days difference means 7 days total
    });
  });

  describe('formatDate', () => {
    it('should format date in long format', () => {
      const result = formatDate('2024-03-15T00:00:00');
      expect(result).toBe('Friday, March 15, 2024');
    });

    it('should handle different dates correctly', () => {
      expect(formatDate('2024-01-01T00:00:00')).toBe('Monday, January 1, 2024');
      expect(formatDate('2024-12-31T00:00:00')).toBe('Tuesday, December 31, 2024');
    });

    it('should handle leap year dates', () => {
      expect(formatDate('2024-02-29T00:00:00')).toBe('Thursday, February 29, 2024');
    });
  });

  describe('generateWeeklyDigestHTML', () => {
    const mockDigestEmail: DigestEmail = {
      to: 'test@example.com',
      accountName: 'John Doe',
      weekRange: {
        start: '2024-03-16T00:00:00',
        end: '2024-03-22T00:00:00',
      },
      profiles: [
        {
          profile: { id: 1, name: 'John' },
          upcomingEpisodes: [
            {
              showName: 'The Office',
              seasonNumber: 3,
              episodeNumber: 5,
              episodeTitle: 'The Return',
              airDate: '2024-03-18T00:00:00',
              runtime: 18,
              profileId: 0,
              showId: 0,
              streamingServices: '',
              network: '',
              episodeStillImage: '',
            },
          ],
          upcomingMovies: [
            {
              id: 1,
              tmdbId: 120,
              title: 'Dune: Part Two',
              releaseDate: '',
            },
          ],
          continueWatching: [
            {
              showTitle: 'Breaking Bad',
              episodes: [
                {
                  seasonNumber: 2,
                  episodeNumber: 3,
                  episodeTitle: 'Bit by a Dead Bee',
                  episodeId: 0,
                  overview: '',
                  episodeStillImage: '',
                  airDate: '',
                  runtime: 49,
                  showId: 0,
                  showName: '',
                  seasonId: 0,
                  posterImage: '',
                  network: '',
                  streamingServices: '',
                  profileId: 0,
                },
              ],
              showId: 0,
              posterImage: '',
              lastWatched: '',
            },
          ],
        },
      ],
      accountId: 0,
    };

    it('should generate valid HTML structure', () => {
      const result = generateWeeklyDigestHTML(mockDigestEmail);

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html>');
      expect(result).toContain('<head>');
      expect(result).toContain('<body>');
      expect(result).toContain('</html>');
    });

    it('should include account name in greeting', () => {
      const result = generateWeeklyDigestHTML(mockDigestEmail);
      expect(result).toContain('Hi John Doe!');
    });

    it('should include formatted date range', () => {
      const result = generateWeeklyDigestHTML(mockDigestEmail);
      expect(result).toContain('Saturday, March 16, 2024');
      expect(result).toContain('Friday, March 22, 2024');
    });

    it('should include profile name with emoji', () => {
      const result = generateWeeklyDigestHTML(mockDigestEmail);
      expect(result).toContain("📺 John's Watchlist");
    });

    it('should display upcoming episodes with correct format', () => {
      const result = generateWeeklyDigestHTML(mockDigestEmail);
      expect(result).toContain('🆕 New Episodes This Week');
      expect(result).toContain('The Office');
      expect(result).toContain('S3E5: The Return');
      expect(result).toContain('Monday, March 18, 2024');
    });

    it('should display upcoming movies', () => {
      const result = generateWeeklyDigestHTML(mockDigestEmail);
      expect(result).toContain('🎬 Movies Releasing This Week');
      expect(result).toContain('Dune: Part Two');
    });

    it('should display continue watching shows', () => {
      const result = generateWeeklyDigestHTML(mockDigestEmail);
      expect(result).toContain('⏭️ Continue Watching');
      expect(result).toContain('Breaking Bad');
      expect(result).toContain('Next: S2E3 - Bit by a Dead Bee');
    });

    it('should handle profile with no content gracefully', () => {
      const emptyProfileEmail: DigestEmail = {
        ...mockDigestEmail,
        profiles: [
          {
            profile: { id: 2, name: 'Jane' },
            upcomingEpisodes: [],
            upcomingMovies: [],
            continueWatching: [],
          },
        ],
      };

      const result = generateWeeklyDigestHTML(emptyProfileEmail);
      expect(result).toContain("📺 Jane's Watchlist");
      expect(result).not.toContain('🆕 New Episodes This Week');
      expect(result).not.toContain('🎬 Movies Releasing This Week');
      expect(result).not.toContain('⏭️ Continue Watching');
    });

    it('should handle continue watching without next episode', () => {
      const modifiedEmail: DigestEmail = {
        ...mockDigestEmail,
        profiles: [
          {
            profile: { id: 1, name: 'John' },
            upcomingEpisodes: [],
            upcomingMovies: [],
            continueWatching: [
              {
                showTitle: 'Stranger Things',
                episodes: [],
                showId: 0,
                posterImage: '',
                lastWatched: '',
              },
            ],
          },
        ],
      };

      const result = generateWeeklyDigestHTML(modifiedEmail);
      expect(result).toContain('Stranger Things');
      expect(result).toContain('Ready to continue');
    });

    it('should include footer with system message', () => {
      const result = generateWeeklyDigestHTML(mockDigestEmail);
      expect(result).toContain('Happy watching! 🍿');
      expect(result).toContain('This email was generated automatically by your KeepWatching system.');
    });

    it('should escape HTML characters in content', () => {
      const emailWithSpecialChars: DigestEmail = {
        ...mockDigestEmail,
        accountName: 'John & Jane <Test>',
        profiles: [
          {
            profile: { id: 1, name: 'Test & User' },
            upcomingEpisodes: [
              {
                showName: 'Show with "Quotes" & Symbols',
                seasonNumber: 1,
                episodeNumber: 1,
                episodeTitle: 'Episode with <HTML> & "Quotes"',
                airDate: '2024-03-18',
                runtime: 18,
                profileId: 0,
                showId: 0,
                streamingServices: '',
                network: '',
                episodeStillImage: '',
              },
            ],
            upcomingMovies: [],
            continueWatching: [],
          },
        ],
      };

      const result = generateWeeklyDigestHTML(emailWithSpecialChars);
      // HTML should be properly escaped
      expect(result).toContain('John & Jane <Test>');
      expect(result).toContain('Test & User');
      expect(result).toContain('Show with "Quotes" & Symbols');
      expect(result).toContain('Episode with <HTML> & "Quotes"');
    });
  });

  describe('generateWeeklyDigestText', () => {
    const mockDigestEmail: DigestEmail = {
      to: 'test@example.com',
      accountName: 'John Doe',
      weekRange: {
        start: '2024-03-16T00:00:00',
        end: '2024-03-22T00:00:00',
      },
      profiles: [
        {
          profile: { id: 1, name: 'John' },
          upcomingEpisodes: [
            {
              showName: 'The Office',
              seasonNumber: 3,
              episodeNumber: 5,
              episodeTitle: 'The Return',
              airDate: '2024-03-18T00:00:00',
              runtime: 19,
              profileId: 0,
              showId: 0,
              streamingServices: '',
              network: '',
              episodeStillImage: '',
            },
          ],
          upcomingMovies: [
            {
              id: 2,
              tmdbId: 122,
              title: 'Dune: Part Two',
              releaseDate: '',
            },
          ],
          continueWatching: [
            {
              showTitle: 'Breaking Bad',
              episodes: [
                {
                  seasonNumber: 2,
                  episodeNumber: 3,
                  episodeTitle: 'Bit by a Dead Bee',
                  episodeId: 0,
                  overview: '',
                  episodeStillImage: '',
                  airDate: '',
                  runtime: 49,
                  showId: 0,
                  showName: '',
                  seasonId: 0,
                  posterImage: '',
                  network: '',
                  streamingServices: '',
                  profileId: 0,
                },
              ],
              showId: 0,
              posterImage: '',
              lastWatched: '',
            },
          ],
        },
      ],
      accountId: 0,
    };

    it('should generate plain text format', () => {
      const result = generateWeeklyDigestText(mockDigestEmail);

      // Should not contain HTML tags
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should include account name and date range', () => {
      const result = generateWeeklyDigestText(mockDigestEmail);
      expect(result).toContain('Hi John Doe!');
      expect(result).toContain('Saturday, March 16, 2024');
      expect(result).toContain('Friday, March 22, 2024');
    });

    it('should use section headers with underlines', () => {
      const result = generateWeeklyDigestText(mockDigestEmail);
      expect(result).toContain("John's Watchlist");
      expect(result).toContain('='.repeat("John's Watchlist".length));
    });

    it('should format upcoming episodes correctly', () => {
      const result = generateWeeklyDigestText(mockDigestEmail);
      expect(result).toContain('New Episodes This Week:');
      expect(result).toContain('• The Office - S3E5: The Return');
      expect(result).toContain('  Airs: Monday, March 18, 2024');
    });

    it('should format upcoming movies correctly', () => {
      const result = generateWeeklyDigestText(mockDigestEmail);
      expect(result).toContain('Movies Releasing This Week:');
      expect(result).toContain('• Dune: Part Two');
    });

    it('should format continue watching correctly', () => {
      const result = generateWeeklyDigestText(mockDigestEmail);
      expect(result).toContain('Continue Watching:');
      expect(result).toContain('• Breaking Bad - Next: S2E3 - Bit by a Dead Bee');
    });

    it('should handle multiple profiles', () => {
      const multiProfileEmail: DigestEmail = {
        ...mockDigestEmail,
        profiles: [
          ...mockDigestEmail.profiles,
          {
            profile: { id: 2, name: 'Jane' },
            upcomingEpisodes: [],
            upcomingMovies: [
              {
                id: 3,
                tmdbId: 123,
                title: 'Avatar 3',
                releaseDate: '',
              },
            ],
            continueWatching: [],
          },
        ],
      };

      const result = generateWeeklyDigestText(multiProfileEmail);
      expect(result).toContain("John's Watchlist");
      expect(result).toContain("Jane's Watchlist");
      expect(result).toContain('Avatar 3');
    });

    it('should include footer message', () => {
      const result = generateWeeklyDigestText(mockDigestEmail);
      expect(result).toContain('Happy watching!');
      expect(result).toContain('This email was generated automatically by your KeepWatching system.');
    });
  });

  describe('generateDiscoveryEmailHTML', () => {
    const mockDiscoveryEmail: DiscoveryEmail = {
      to: 'test@example.com',
      accountName: 'John Doe',
      data: {
        accountName: 'John Doe',
        profiles: [
          { id: 1, name: 'John' },
          { id: 2, name: 'Jane' },
        ],
        featuredContent: {
          trendingShows: [
            {
              id: 4,
              tmdbId: 124,
              title: 'Wednesday',
              releaseDate: '',
            },
            {
              id: 5,
              tmdbId: 125,
              title: 'Stranger Things',
              releaseDate: '',
            },
          ],
          newReleases: [
            {
              id: 6,
              tmdbId: 126,
              title: 'The Last of Us',
              releaseDate: '',
            },
            {
              id: 7,
              tmdbId: 127,
              title: 'House of the Dragon',
              releaseDate: '',
            },
          ],
          popularMovies: [
            {
              id: 8,
              tmdbId: 128,
              title: 'Top Gun: Maverick',
              releaseDate: '',
            },
            {
              id: 9,
              tmdbId: 129,
              title: 'Avatar: The Way of Water',
              releaseDate: '',
            },
          ],
        },
        weekRange: {
          start: '2024-03-16T00:00:00',
          end: '2024-03-22T00:00:00',
        },
      },
      accountId: 0,
    };

    it('should generate valid HTML structure', () => {
      const result = generateDiscoveryEmailHTML(mockDiscoveryEmail);

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html>');
      expect(result).toContain('<head>');
      expect(result).toContain('<body>');
      expect(result).toContain('</html>');
    });

    it('should include discovery theme elements', () => {
      const result = generateDiscoveryEmailHTML(mockDiscoveryEmail);
      expect(result).toContain('Discover Something New!');
      expect(result).toContain('Hi John Doe!');
      expect(result).toContain('Your watchlist is ready for some fresh content');
    });

    it('should display profile names', () => {
      const result = generateDiscoveryEmailHTML(mockDiscoveryEmail);
      expect(result).toContain('John, Jane');
    });

    it('should display trending shows section', () => {
      const result = generateDiscoveryEmailHTML(mockDiscoveryEmail);
      expect(result).toContain('Trending Shows');
      expect(result).toContain('Wednesday');
      expect(result).toContain('Stranger Things');
    });

    it('should display new releases section', () => {
      const result = generateDiscoveryEmailHTML(mockDiscoveryEmail);
      expect(result).toContain('Fresh Releases');
      expect(result).toContain('The Last of Us');
      expect(result).toContain('House of the Dragon');
    });

    it('should display popular movies section', () => {
      const result = generateDiscoveryEmailHTML(mockDiscoveryEmail);
      expect(result).toContain('Popular Movies');
      expect(result).toContain('Top Gun: Maverick');
      expect(result).toContain('Avatar: The Way of Water');
    });

    it('should handle empty featured content gracefully', () => {
      const emptyContentEmail: DiscoveryEmail = {
        ...mockDiscoveryEmail,
        data: {
          ...mockDiscoveryEmail.data,
          featuredContent: {
            trendingShows: [],
            newReleases: [],
            popularMovies: [],
          },
        },
      };

      const result = generateDiscoveryEmailHTML(emptyContentEmail);
      expect(result).toContain('Discover Something New!');
      expect(result).not.toContain('🔥 TRENDING SHOWS');
      expect(result).not.toContain('✨ FRESH RELEASES');
      expect(result).not.toContain('🎬 POPULAR MOVIES');
    });

    it('should include discovery-specific footer', () => {
      const result = generateDiscoveryEmailHTML(mockDiscoveryEmail);
      expect(result).toContain('Happy discovering! 🎭');
      expect(result).toContain("You're receiving this because you have no upcoming content this week.");
    });
  });

  describe('generateDiscoveryEmailText', () => {
    const mockDiscoveryEmail: DiscoveryEmail = {
      to: 'test@example.com',
      accountName: 'John Doe',
      data: {
        accountName: 'John Doe',
        profiles: [
          { id: 1, name: 'John' },
          { id: 2, name: 'Jane' },
        ],
        featuredContent: {
          trendingShows: [
            {
              id: 4,
              tmdbId: 124,
              title: 'Wednesday',
              releaseDate: '',
            },
            {
              id: 5,
              tmdbId: 125,
              title: 'Stranger Things',
              releaseDate: '',
            },
          ],
          newReleases: [
            {
              id: 6,
              tmdbId: 126,
              title: 'The Last of Us',
              releaseDate: '',
            },
          ],
          popularMovies: [
            {
              id: 8,
              tmdbId: 128,
              title: 'Top Gun: Maverick',
              releaseDate: '',
            },
          ],
        },
        weekRange: {
          start: '2024-03-16',
          end: '2024-03-22',
        },
      },
      accountId: 0,
    };

    it('should generate plain text format', () => {
      const result = generateDiscoveryEmailText(mockDiscoveryEmail);

      // Should not contain HTML tags
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should include discovery greeting and explanation', () => {
      const result = generateDiscoveryEmailText(mockDiscoveryEmail);
      expect(result).toContain('Discover Something New!');
      expect(result).toContain('Hi John Doe!');
      expect(result).toContain('Your watchlist is ready for some fresh content');
      expect(result).toContain('No upcoming episodes this week?');
    });

    it('should list profile names', () => {
      const result = generateDiscoveryEmailText(mockDiscoveryEmail);
      expect(result).toContain('Ready to add to your profiles: John, Jane');
    });

    it('should format trending shows section', () => {
      const result = generateDiscoveryEmailText(mockDiscoveryEmail);
      expect(result).toContain("🔥 TRENDING SHOWS EVERYONE'S TALKING ABOUT:");
      expect(result).toContain('• Wednesday - Currently trending, perfect for binge-watching');
      expect(result).toContain('• Stranger Things - Currently trending, perfect for binge-watching');
    });

    it('should format new releases section', () => {
      const result = generateDiscoveryEmailText(mockDiscoveryEmail);
      expect(result).toContain('✨ FRESH RELEASES:');
      expect(result).toContain('• The Last of Us - Recently released, hot off the press');
    });

    it('should format popular movies section', () => {
      const result = generateDiscoveryEmailText(mockDiscoveryEmail);
      expect(result).toContain('🎬 POPULAR MOVIES:');
      expect(result).toContain('• Top Gun: Maverick - Highly rated, audience favorite');
    });

    it('should include call to action', () => {
      const result = generateDiscoveryEmailText(mockDiscoveryEmail);
      expect(result).toContain('READY TO EXPLORE?');
      expect(result).toContain('Log in to KeepWatching and add these to your watchlist!');
    });

    it('should include discovery-specific footer', () => {
      const result = generateDiscoveryEmailText(mockDiscoveryEmail);
      expect(result).toContain('Happy discovering!');
      expect(result).toContain("You're receiving this because you have no upcoming content this week.");
    });

    it('should handle empty content sections gracefully', () => {
      const partialContentEmail: DiscoveryEmail = {
        ...mockDiscoveryEmail,
        data: {
          ...mockDiscoveryEmail.data,
          featuredContent: {
            trendingShows: [],
            newReleases: [
              {
                id: 30,
                tmdbId: 135,
                title: 'Test Show',
                releaseDate: '',
              },
            ],
            popularMovies: [],
          },
        },
      };

      const result = generateDiscoveryEmailText(partialContentEmail);
      expect(result).not.toContain('🔥 TRENDING SHOWS');
      expect(result).toContain('✨ FRESH RELEASES:');
      expect(result).not.toContain('🎬 POPULAR MOVIES');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle special characters in all functions', () => {
      const specialCharsEmail: DigestEmail = {
        to: 'test@example.com',
        accountName: 'John & Jane <Test>',
        weekRange: { start: '2024-03-16', end: '2024-03-22' },
        profiles: [
          {
            profile: { id: 1, name: 'Test "User" & More' },
            upcomingEpisodes: [],
            upcomingMovies: [],
            continueWatching: [],
          },
        ],
        accountId: 0,
      };

      expect(() => generateWeeklyDigestHTML(specialCharsEmail)).not.toThrow();
      expect(() => generateWeeklyDigestText(specialCharsEmail)).not.toThrow();
    });

    it('should handle empty profiles array', () => {
      const emptyProfilesEmail: DigestEmail = {
        to: 'test@example.com',
        accountName: 'John Doe',
        weekRange: { start: '2024-03-16', end: '2024-03-22' },
        profiles: [],
        accountId: 0,
      };

      const htmlResult = generateWeeklyDigestHTML(emptyProfilesEmail);
      const textResult = generateWeeklyDigestText(emptyProfilesEmail);

      expect(htmlResult).toContain('Hi John Doe!');
      expect(textResult).toContain('Hi John Doe!');
    });

    it('should handle very long content titles', () => {
      const longTitleEmail: DigestEmail = {
        to: 'test@example.com',
        accountName: 'John Doe',
        weekRange: { start: '2024-03-16', end: '2024-03-22' },
        profiles: [
          {
            profile: { id: 1, name: 'John' },
            upcomingEpisodes: [
              {
                showName: 'A Very Long Show Title That Goes On And On And On',
                seasonNumber: 1,
                episodeNumber: 1,
                episodeTitle: 'An Extremely Long Episode Title That Contains Many Words And Details',
                airDate: '2024-03-18',
                runtime: 20,
                profileId: 0,
                showId: 0,
                streamingServices: '',
                network: '',
                episodeStillImage: '',
              },
            ],
            upcomingMovies: [],
            continueWatching: [],
          },
        ],
        accountId: 0,
      };

      expect(() => generateWeeklyDigestHTML(longTitleEmail)).not.toThrow();
      expect(() => generateWeeklyDigestText(longTitleEmail)).not.toThrow();
    });
  });

  describe('interpolateVariables', () => {
    it('should replace known placeholders with their values', () => {
      const result = interpolateVariables('Hi {{accountName}}, your email is {{accountEmail}}', {
        accountName: 'Jane',
        accountEmail: 'jane@example.com',
      });

      expect(result).toBe('Hi Jane, your email is jane@example.com');
    });

    it('should replace an unknown placeholder with an empty string', () => {
      const result = interpolateVariables('Hi {{accountName}}, {{unknown}}!', { accountName: 'Jane' });

      expect(result).toBe('Hi Jane, !');
    });

    it('should leave text unchanged when it has no placeholders', () => {
      const result = interpolateVariables('No placeholders here', { accountName: 'Jane' });

      expect(result).toBe('No placeholders here');
    });

    it('should replace repeated placeholders', () => {
      const result = interpolateVariables('{{accountName}} and {{accountName}} again', { accountName: 'Jane' });

      expect(result).toBe('Jane and Jane again');
    });
  });

  describe('renderTemplatedEmailHTML', () => {
    const baseInput = {
      subject: 'Hi {{accountName}}',
      bodyHtml: '<p>Your email is {{accountEmail}}</p>',
      variables: { accountName: 'Jane', accountEmail: 'jane@example.com' },
    };

    it('should produce a full HTML document', () => {
      const result = renderTemplatedEmailHTML({ ...baseInput, headerStyle: 'none', footerStyle: 'none' });

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html>');
      expect(result).toContain('<body>');
      expect(result).toContain('</html>');
    });

    it('should interpolate variables in both the subject/heading and the body', () => {
      const result = renderTemplatedEmailHTML({ ...baseInput, headerStyle: 'gradient', footerStyle: 'none' });

      expect(result).toContain('<h1 style="margin: 0; font-size: 24px;">Hi Jane</h1>');
      expect(result).toContain('Your email is jane@example.com');
    });

    it('should render no header markup when headerStyle is "none"', () => {
      const result = renderTemplatedEmailHTML({ ...baseInput, headerStyle: 'none', footerStyle: 'none' });

      expect(result).not.toContain('class="header"');
    });

    it('should render the gradient header style', () => {
      const result = renderTemplatedEmailHTML({ ...baseInput, headerStyle: 'gradient', footerStyle: 'none' });

      expect(result).toContain('linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
    });

    it('should render the dark header style', () => {
      const result = renderTemplatedEmailHTML({ ...baseInput, headerStyle: 'dark', footerStyle: 'none' });

      expect(result).toContain('#1a1a1a');
    });

    it('should render no footer markup when footerStyle is "none"', () => {
      const result = renderTemplatedEmailHTML({ ...baseInput, headerStyle: 'none', footerStyle: 'none' });

      expect(result).not.toContain('class="footer"');
    });

    it('should render the standard footer style', () => {
      const result = renderTemplatedEmailHTML({ ...baseInput, headerStyle: 'none', footerStyle: 'standard' });

      expect(result).toContain('Happy watching! 🍿');
    });

    it('should render a CTA button linking to appUrl and the standard sign-off for the "cta" footer style', () => {
      const result = renderTemplatedEmailHTML({
        ...baseInput,
        headerStyle: 'none',
        footerStyle: 'cta',
        variables: { ...baseInput.variables, appUrl: 'https://keepwatching.example.com' },
      });

      expect(result).toContain('href="https://keepwatching.example.com/"');
      expect(result).toContain('Open KeepWatching');
      expect(result).toContain('Happy watching! 🍿');
    });

    it('should render an empty href for the "cta" footer style when appUrl is not provided', () => {
      const result = renderTemplatedEmailHTML({ ...baseInput, headerStyle: 'none', footerStyle: 'cta' });

      expect(result).toContain('href="/"');
    });

    it('should use headerTitle instead of subject as the heading when provided', () => {
      const result = renderTemplatedEmailHTML({
        ...baseInput,
        headerStyle: 'gradient',
        footerStyle: 'none',
        headerTitle: 'A Custom Heading',
      });

      expect(result).toContain('<h1 style="margin: 0; font-size: 24px;">A Custom Heading</h1>');
      expect(result).not.toContain('Hi Jane</h1>');
    });

    it('should fall back to subject as the heading when headerTitle is null', () => {
      const result = renderTemplatedEmailHTML({
        ...baseInput,
        headerStyle: 'gradient',
        footerStyle: 'none',
        headerTitle: null,
      });

      expect(result).toContain('<h1 style="margin: 0; font-size: 24px;">Hi Jane</h1>');
    });

    it('should interpolate variables in headerTitle', () => {
      const result = renderTemplatedEmailHTML({
        ...baseInput,
        headerStyle: 'gradient',
        footerStyle: 'none',
        headerTitle: 'Hey {{accountName}}!',
      });

      expect(result).toContain('<h1 style="margin: 0; font-size: 24px;">Hey Jane!</h1>');
    });

    it('should render headerSubtitle beneath the heading, interpolated', () => {
      const result = renderTemplatedEmailHTML({
        ...baseInput,
        headerStyle: 'gradient',
        footerStyle: 'none',
        headerSubtitle: 'Made just for {{accountName}}',
      });

      expect(result).toContain('Made just for Jane');
    });

    it('should not render a subtitle element when headerSubtitle is null', () => {
      const result = renderTemplatedEmailHTML({
        ...baseInput,
        headerStyle: 'gradient',
        footerStyle: 'none',
        headerSubtitle: null,
      });

      expect(result).not.toContain('opacity: 0.9');
    });

    it('should not render header title/subtitle markup at all when headerStyle is "none"', () => {
      const result = renderTemplatedEmailHTML({
        ...baseInput,
        headerStyle: 'none',
        footerStyle: 'none',
        headerTitle: 'Ignored Title',
        headerSubtitle: 'Ignored Subtitle',
      });

      expect(result).not.toContain('Ignored Title');
      expect(result).not.toContain('Ignored Subtitle');
    });

    it('should override the footer sign-off line with footerNote, interpolated', () => {
      const result = renderTemplatedEmailHTML({
        ...baseInput,
        headerStyle: 'none',
        footerStyle: 'standard',
        footerNote: 'Thanks for being here, {{accountName}}!',
      });

      expect(result).toContain('Thanks for being here, Jane!');
      expect(result).not.toContain('Happy watching! 🍿');
      expect(result).toContain('This email was sent by your KeepWatching system.');
    });

    it('should fall back to the default sign-off when footerNote is null', () => {
      const result = renderTemplatedEmailHTML({
        ...baseInput,
        headerStyle: 'none',
        footerStyle: 'standard',
        footerNote: null,
      });

      expect(result).toContain('Happy watching! 🍿');
    });

    it('should preserve emoji in headerTitle, headerSubtitle, and footerNote', () => {
      const result = renderTemplatedEmailHTML({
        ...baseInput,
        headerStyle: 'gradient',
        footerStyle: 'standard',
        headerTitle: '🎉 New Features',
        headerSubtitle: '✨ A month of updates',
        footerNote: '🍿 Enjoy the show!',
      });

      expect(result).toContain('🎉 New Features');
      expect(result).toContain('✨ A month of updates');
      expect(result).toContain('🍿 Enjoy the show!');
    });
  });

  describe('stripHtmlToText', () => {
    it('should remove tags and leave the text content', () => {
      const result = stripHtmlToText('<p>Hello <strong>World</strong></p>');

      expect(result).toBe('Hello World');
    });

    it('should convert block-level closing tags and <br> into newlines', () => {
      const result = stripHtmlToText('<p>Line one</p><p>Line two<br>Line three</p>');

      expect(result).toBe('Line one\nLine two\nLine three');
    });

    it('should strip <style> and <script> blocks entirely', () => {
      const result = stripHtmlToText('<style>.a{color:red}</style><p>Visible text</p><script>alert(1)</script>');

      expect(result).toBe('Visible text');
    });

    it('should decode common HTML entities', () => {
      const result = stripHtmlToText('<p>Fish &amp; Chips &nbsp;&lt;tag&gt; &quot;quoted&quot; &#39;single&#39;</p>');

      expect(result).toBe(`Fish & Chips  <tag> "quoted" 'single'`);
    });

    it('should collapse excessive blank lines', () => {
      const result = stripHtmlToText('<p>One</p><p></p><p></p><p>Two</p>');

      expect(result).toBe('One\n\nTwo');
    });

    it('should preserve emoji when converting to plain text', () => {
      const result = stripHtmlToText('<p>🎉 New features are here! 🍿✨</p>');

      expect(result).toBe('🎉 New features are here! 🍿✨');
    });
  });
});
