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
  PERSON: 'person',
  STREAMING: 'streaming',
  STATISTICS: 'statistics',
  DISCOVER: 'discover',
  SEARCH: 'search',
  RECOMMENDATIONS: 'recommendations',
  SIMILAR: 'similar',
  ADMIN: 'admin',
  NOTIFICATION: 'notification',
};

// Account keys
export const ACCOUNT_KEYS = {
  /** Gets the cache key for account profiles */
  profiles: (accountId: number | string) => `${CACHE_KEY_PATTERNS.ACCOUNT}_${accountId}_profiles`,

  adminProfiles: (accountId: number | string) => `${CACHE_KEY_PATTERNS.ACCOUNT}_${accountId}_adminProfiles`,

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

  /** Gets the cache key for profile watching velocity stats */
  watchingVelocity: (profileId: number | string, days: number) =>
    `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_velocity_${days}`,

  /** Gets the cache key for profile daily activity timeline */
  dailyActivity: (profileId: number | string, days: number) =>
    `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_daily_activity_${days}`,

  /** Gets the cache key for profile weekly activity timeline */
  weeklyActivity: (profileId: number | string, weeks: number) =>
    `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_weekly_activity_${weeks}`,

  /** Gets the cache key for profile monthly activity timeline */
  monthlyActivity: (profileId: number | string, months: number) =>
    `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_monthly_activity_${months}`,
};

// Show keys
export const SHOW_KEYS = {
  /** Gets the cache key for detailed show information for a profile */
  detailsForProfile: (profileId: number | string, showId: number | string) =>
    `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_show_details_${showId}`,

  /** Gets the cache key for detailed show information for a profile by child */
  detailsForProfileByChild: (
    profileId: number | string,
    childId: number | string,
    childEntity: 'episodes' | 'seasons',
  ) => `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_show_details_${childEntity}_${childId}`,

  /** Gets the cache key for a specific show and its cast members */
  castMembers: (showId: number | string) => `${CACHE_KEY_PATTERNS.SHOW}_cast_${showId}`,

  /** Gets the cache key for show recommendations */
  recommendations: (showId: number | string) => `${CACHE_KEY_PATTERNS.RECOMMENDATIONS}_show_${showId}`,

  /** Gets the cache key for similar shows */
  similar: (showId: number | string) => `${CACHE_KEY_PATTERNS.SIMILAR}_show_${showId}`,
};

export const ADMIN_KEYS = {
  /** Gets the cache key for all shows */
  allShows: (page: number, offset: number, limit: number) => `allShows_${page}_${offset}_${limit}`,

  allShowsByProfile: (profileId: number, page: number, offset: number, limit: number) =>
    `allShowsByProfile_${profileId}_${page}_${offset}_${limit}`,

  allShowReferences: () => `allShowReferences`,

  /** Gets the cache key for all movies */
  allMovies: (page: number, offset: number, limit: number) => `allMovies_${page}_${offset}_${limit}`,

  allMoviesByProfile: (profileId: number, page: number, offset: number, limit: number) =>
    `allMoviesByProfile_${profileId}_${page}_${offset}_${limit}`,

  allMovieReferences: () => `allMovieReferences`,

  /** Gets the cache key for admin show details */
  showDetails: (showId: number | string) => `${CACHE_KEY_PATTERNS.ADMIN}_show_details_${showId}`,

  /** Gets the cache key for admin show seasons */
  showSeasons: (showId: number | string) => `${CACHE_KEY_PATTERNS.ADMIN}_show_seasons_${showId}`,

  /** Gets the cache key for admin season episodes */
  seasonEpisodes: (seasonId: number | string) => `${CACHE_KEY_PATTERNS.ADMIN}_season_episodes_${seasonId}`,

  /** Gets the cache key for admin show profiles */
  showProfiles: (showId: number | string) => `${CACHE_KEY_PATTERNS.ADMIN}_show_profiles_${showId}`,

  /** Gets the cache key for admin show watch progress */
  showWatchProgress: (showId: number | string) => `${CACHE_KEY_PATTERNS.ADMIN}_show_watch_progress_${showId}`,

  /** Gets the cache key for seasons with episodes */
  showSeasonsWithEpisodes: (showId: number | string) =>
    `${CACHE_KEY_PATTERNS.ADMIN}_show_seasons_with_episodes_${showId}`,

  /** Gets the cache key for complete admin show information */
  showComplete: (showId: number | string) => `${CACHE_KEY_PATTERNS.ADMIN}_show_complete_${showId}`,

  /** Gets a pattern for invalidating all season episodes for a show */
  showSeasonsPattern: (showId: number | string) => `${CACHE_KEY_PATTERNS.ADMIN}_season_episodes_${showId}`,

  /** Gets the cache key for admin movie details */
  movieDetails: (movieId: number | string) => `${CACHE_KEY_PATTERNS.ADMIN}_movie_details_${movieId}`,

  /** Gets the cache key for admin movie profiles */
  movieProfiles: (movieId: number | string) => `${CACHE_KEY_PATTERNS.ADMIN}_movie_profiles_${movieId}`,

  /** Gets the cache key for complete admin movie information */
  movieComplete: (movieId: number | string) => `${CACHE_KEY_PATTERNS.ADMIN}_movie_complete_${movieId}`,
};

// Movie keys
export const MOVIE_KEYS = {
  /** Gets the cache key for a specific movie for a profile */
  details: (profileId: number | string, movieId: number | string) =>
    `${CACHE_KEY_PATTERNS.PROFILE}_${profileId}_movie_${movieId}`,

  /** Gets the cache key for a specific movie and its cast members */
  castMembers: (movieId: number | string) => `${CACHE_KEY_PATTERNS.MOVIE}_cast_${movieId}`,

  /** Gets the cache key for movie recommendations */
  recommendations: (movieId: number | string) => `${CACHE_KEY_PATTERNS.RECOMMENDATIONS}_movie_${movieId}`,

  /** Gets the cache key for similar movies */
  similar: (movieId: number | string) => `${CACHE_KEY_PATTERNS.SIMILAR}_movie_${movieId}`,
};

export const PERSON_KEYS = {
  details: (personId: number | string) => `${CACHE_KEY_PATTERNS.PERSON}_details_${personId}`,

  tmdbDetails: (personId: number | string) => `${CACHE_KEY_PATTERNS.PERSON}_tmdb_details_${personId}`,

  tmdbCredits: (personId: number | string) => `${CACHE_KEY_PATTERNS.PERSON}_tmdb_credits_${personId}`,

  list: (firstLetter: string, page: number, limit: number, offset: number) =>
    `person:list:${firstLetter}:${page}:${limit}:${offset}`,
};

// Discovery keys
export const DISCOVER_KEYS = {
  /** Gets the cache key for top content discovery */
  top: (showType: string, service: string) => `discover_top_${showType}_${service}`,

  /** Gets the cache key for changes content discovery */
  changes: (showType: string, service: string, changeType: string) =>
    `discover_changes_${showType}_${service}_${changeType}`,

  /** Gets the cache key for trending content discovery */
  trending: (showType: string, page: number) => `discover_trending_${showType}_${page}`,
};

// Search keys
export const SEARCH_KEYS = {
  /** Gets the cache key for search results */
  results: (mediaType: string, searchString: string, year?: string, page: number = 1) =>
    `${mediaType}_search_${searchString}_${year || ''}_${page}`,

  peopleResults: (searchString: string, page: number) => `people_search_${searchString}_${page}`,
};

// Notification keys
export const NOTIFICATION_KEYS = {
  /** Gets the cache key for account notifications */
  forAccount: (accountId: number | string, includeDismissed: boolean) =>
    `${CACHE_KEY_PATTERNS.NOTIFICATION}_account_${accountId}_dismissed_${includeDismissed}`,

  /** Gets the cache key for all notifications (admin) */
  all: (page: number, offset: number, limit: number, options: string) =>
    `${CACHE_KEY_PATTERNS.NOTIFICATION}_all_${page}_${offset}_${limit}_${options}`,
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
