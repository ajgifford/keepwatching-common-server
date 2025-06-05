import {
  ACCOUNT_KEYS,
  CACHE_KEY_PATTERNS,
  DISCOVER_KEYS,
  INVALIDATION_PATTERNS,
  MOVIE_KEYS,
  PROFILE_KEYS,
  SEARCH_KEYS,
  SHOW_KEYS,
} from '@constants/cacheKeys';

describe('Cache Keys Module', () => {
  describe('CACHE_KEY_PATTERNS', () => {
    it('should define all required base patterns', () => {
      expect(CACHE_KEY_PATTERNS).toBeDefined();
      expect(CACHE_KEY_PATTERNS.ACCOUNT).toBe('account');
      expect(CACHE_KEY_PATTERNS.PROFILE).toBe('profile');
      expect(CACHE_KEY_PATTERNS.SHOW).toBe('show');
      expect(CACHE_KEY_PATTERNS.SEASON).toBe('season');
      expect(CACHE_KEY_PATTERNS.EPISODE).toBe('episode');
      expect(CACHE_KEY_PATTERNS.MOVIE).toBe('movie');
      expect(CACHE_KEY_PATTERNS.STREAMING).toBe('streaming');
      expect(CACHE_KEY_PATTERNS.STATISTICS).toBe('statistics');
      expect(CACHE_KEY_PATTERNS.DISCOVER).toBe('discover');
      expect(CACHE_KEY_PATTERNS.SEARCH).toBe('search');
      expect(CACHE_KEY_PATTERNS.RECOMMENDATIONS).toBe('recommendations');
    });
  });

  describe('ACCOUNT_KEYS', () => {
    it('should generate correct keys for account data', () => {
      expect(ACCOUNT_KEYS.profiles(123)).toBe('account_123_profiles');
      expect(ACCOUNT_KEYS.profiles('abc')).toBe('account_abc_profiles');
      expect(ACCOUNT_KEYS.statistics(123)).toBe('account_123_statistics');
      expect(ACCOUNT_KEYS.statistics('abc')).toBe('account_abc_statistics');
    });
  });

  describe('PROFILE_KEYS', () => {
    it('should generate correct keys for profile data', () => {
      expect(PROFILE_KEYS.profile(123)).toBe('profile_123');
      expect(PROFILE_KEYS.complete(123)).toBe('profile_123_complete');
      expect(PROFILE_KEYS.shows(123)).toBe('profile_123_shows');
      expect(PROFILE_KEYS.movies(123)).toBe('profile_123_movies');
      expect(PROFILE_KEYS.episodes(123)).toBe('profile_123_episodes');
      expect(PROFILE_KEYS.recentEpisodes(123)).toBe('profile_123_recent_episodes');
      expect(PROFILE_KEYS.upcomingEpisodes(123)).toBe('profile_123_upcoming_episodes');
      expect(PROFILE_KEYS.nextUnwatchedEpisodes(123)).toBe('profile_123_unwatched_episodes');
      expect(PROFILE_KEYS.recentMovies(123)).toBe('profile_123_recent_movies');
      expect(PROFILE_KEYS.upcomingMovies(123)).toBe('profile_123_upcoming_movies');
      expect(PROFILE_KEYS.statistics(123)).toBe('profile_123_statistics');
      expect(PROFILE_KEYS.showStatistics(123)).toBe('profile_123_show_stats');
      expect(PROFILE_KEYS.movieStatistics(123)).toBe('profile_123_movie_stats');
      expect(PROFILE_KEYS.watchProgress(123)).toBe('profile_123_watch_progress');
    });

    it('should handle string IDs correctly', () => {
      expect(PROFILE_KEYS.profile('abc')).toBe('profile_abc');
      expect(PROFILE_KEYS.episodes('456')).toBe('profile_456_episodes');
    });
  });

  describe('SHOW_KEYS', () => {
    it('should generate correct keys for show data', () => {
      expect(SHOW_KEYS.detailsForProfile('123', '456')).toBe('profile_123_show_details_456');
      expect(SHOW_KEYS.detailsForProfile(123, 456)).toBe('profile_123_show_details_456');
      expect(SHOW_KEYS.recommendations(789)).toBe('recommendations_789');
      expect(SHOW_KEYS.similar(789)).toBe('similar_789');
    });
  });

  describe('MOVIE_KEYS', () => {
    it('should generate correct keys for movie data', () => {
      expect(MOVIE_KEYS.details('123', '456')).toBe('profile_123_movie_456');
      expect(MOVIE_KEYS.details(123, 456)).toBe('profile_123_movie_456');
    });
  });

  describe('DISCOVER_KEYS', () => {
    it('should generate correct keys for discover functionality', () => {
      expect(DISCOVER_KEYS.top('movie', 'netflix')).toBe('discover_top_movie_netflix');
      expect(DISCOVER_KEYS.changes('series', 'hbo', 'new')).toBe('discover_changes_series_hbo_new');
      expect(DISCOVER_KEYS.trending('movie', 1)).toBe('discover_trending_movie_1');
    });
  });

  describe('SEARCH_KEYS', () => {
    it('should generate correct keys for search functionality', () => {
      expect(SEARCH_KEYS.results('movie', 'star wars')).toBe('movie_search_star wars__1');
      expect(SEARCH_KEYS.results('tv', 'office', '2005')).toBe('tv_search_office_2005_1');
      expect(SEARCH_KEYS.results('movie', 'avengers', undefined, 2)).toBe('movie_search_avengers__2');
    });
  });

  describe('INVALIDATION_PATTERNS', () => {
    it('should generate correct patterns for cache invalidation', () => {
      expect(INVALIDATION_PATTERNS.allProfileData(123)).toBe('profile_123');
      expect(INVALIDATION_PATTERNS.profileShowData(123)).toBe('profile_123_show');
      expect(INVALIDATION_PATTERNS.profileMovieData(123)).toBe('profile_123_movie');
      expect(INVALIDATION_PATTERNS.allAccountData(123)).toBe('account_123');
    });

    it('should handle string IDs correctly', () => {
      expect(INVALIDATION_PATTERNS.allProfileData('abc')).toBe('profile_abc');
      expect(INVALIDATION_PATTERNS.allAccountData('def')).toBe('account_def');
    });
  });

  describe('Key Relationships', () => {
    it('should have consistent relationships between keys and invalidation patterns', () => {
      const profileId = '123';

      // Profile keys should match the profile invalidation pattern
      expect(PROFILE_KEYS.profile(profileId)).toMatch(INVALIDATION_PATTERNS.allProfileData(profileId));
      expect(PROFILE_KEYS.shows(profileId)).toMatch(INVALIDATION_PATTERNS.allProfileData(profileId));
      expect(PROFILE_KEYS.statistics(profileId)).toMatch(INVALIDATION_PATTERNS.allProfileData(profileId));

      // Show-related keys should match the profile show invalidation pattern
      expect(PROFILE_KEYS.shows(profileId)).toMatch(INVALIDATION_PATTERNS.profileShowData(profileId));

      // Movie-related keys should match the profile movie invalidation pattern
      expect(PROFILE_KEYS.movies(profileId)).toMatch(INVALIDATION_PATTERNS.profileMovieData(profileId));

      // Account keys should match the account invalidation pattern
      const accountId = '456';
      expect(ACCOUNT_KEYS.profiles(accountId)).toMatch(INVALIDATION_PATTERNS.allAccountData(accountId));
      expect(ACCOUNT_KEYS.statistics(accountId)).toMatch(INVALIDATION_PATTERNS.allAccountData(accountId));
    });
  });
});
