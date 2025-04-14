/**
 * Centralized cache keys for the application
 * This helps maintain consistency and prevents typos or duplicated cache key patterns
 */

// Base key patterns by entity type
export const CACHE_KEY_PATTERNS = {
  ACCOUNT: 'account',
  PROFILE: 'profile',
  SHOW: 'show',
  SEASON: 'season',
  EPISODE: 'episode',
  MOVIE: 'movie',
  STREAMING: 'streaming',
  STATISTICS: 'statistics',
  DISCOVER: 'discover',
  SEARCH: 'search',
  RECOMMENDATIONS: 'recommendations',
};

// Account keys
export const ACCOUNT_KEYS = {
  /** Gets the cache key for account profiles */
  profiles: (accountId: number | string) => `${CACHE_KEY_PATTERNS.ACCOUNT}_${accountId}_profiles`,

  /** Gets the cache key for account statistics */
  statistics: (accountId: number | string) => `${CACHE_KEY_PATTERNS.ACCOUNT}_${accountId}_statistics`,
};

// Profile keys
export const PROFILE_KEYS = {
  /** Gets the cache key for a specific profile data */
  profile: (profileId: number | string) => `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}`,

  /** Gets the cache key for profile complete data */
  complete: (profileId: number | string) => `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_complete`,

  /** Gets the cache key for profile shows */
  shows: (profileId: number | string) => `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_shows`,

  /** Gets the cache key for profile movies */
  movies: (profileId: number | string) => `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_movies`,

  /** Gets the cache key for profile episodes */
  episodes: (profileId: number | string) => `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_episodes`,

  /** Gets the cache key for profile recent episodes */
  recentEpisodes: (profileId: number | string) => `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_recent_episodes`,

  /** Gets the cache key for profile upcoming episodes */
  upcomingEpisodes: (profileId: number | string) => `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_upcoming_episodes`,

  /** Gets the cache key for profile next unwatched episodes */
  nextUnwatchedEpisodes: (profileId: number | string) =>
    `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_unwatched_episodes`,

  /** Gets the cache key for profile recent movies */
  recentMovies: (profileId: number | string) => `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_recent_movies`,

  /** Gets the cache key for profile upcoming movies */
  upcomingMovies: (profileId: number | string) => `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_upcoming_movies`,

  /** Gets the cache key for profile statistics */
  statistics: (profileId: number | string) => `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_statistics`,

  /** Gets the cache key for profile show statistics */
  showStatistics: (profileId: number | string) => `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_show_stats`,

  /** Gets the cache key for profile movie statistics */
  movieStatistics: (profileId: number | string) => `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_movie_stats`,

  /** Gets the cache key for profile watch progress */
  watchProgress: (profileId: number | string) => `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_watch_progress`,
};

// Show keys
export const SHOW_KEYS = {
  /** Gets the cache key for detailed show information for a profile */
  details: (profileId: number | string, showId: number | string) =>
    `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_show_details_${showId}`,

  /** Gets the cache key for show recommendations */
  recommendations: (showId: number | string) => `${CACHE_KEY_PATTERNS.RECOMMENDATIONS}_${showId}`,

  /** Gets the cache key for similar shows */
  similar: (showId: number | string) => `similarShows_${showId}`,
};

// Movie keys
export const MOVIE_KEYS = {
  /** Gets the cache key for a specific movie for a profile */
  details: (profileId: number | string, movieId: number | string) =>
    `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_movie_${movieId}`,
};

// Discovery keys
export const DISCOVER_KEYS = {
  /** Gets the cache key for top content discovery */
  top: (showType: string, service: string) => `discover_top_${showType}_${service}`,

  /** Gets the cache key for changes content discovery */
  changes: (showType: string, service: string, changeType: string) =>
    `discover_changes_${showType}_${service}_${changeType}`,

  /** Gets the cache key for trending content discovery */
  trending: (showType: string, page: string) => `discover_trending_${showType}_${page}`,
};

// Search keys
export const SEARCH_KEYS = {
  /** Gets the cache key for search results */
  results: (mediaType: string, searchString: string, year?: string, page: string = '1') =>
    `${mediaType}_search_${searchString}_${year || ''}_${page}`,
};

// Base patterns for invalidation
export const INVALIDATION_PATTERNS = {
  /** Pattern to invalidate all profile-related cache */
  allProfileData: (profileId: number | string) => `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}`,

  /** Pattern to invalidate all profile show-related cache */
  profileShowData: (profileId: number | string) => `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_show`,

  /** Pattern to invalidate all profile movie-related cache */
  profileMovieData: (profileId: number | string) => `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_movie`,

  /** Pattern to invalidate all account-related cache */
  allAccountData: (accountId: number | string) => `${CACHE_KEY_PATTERNS.ACCOUNT}_${accountId}`,
};
