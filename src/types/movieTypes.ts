/**
 * Represents a movie associated with a user profile, including watch status
 * This interface is used when retrieving movies with their watch status for a specific profile
 */
export interface ProfileMovie {
  /** ID of the profile this movie is associated with */
  profile_id: number;
  /** ID of the movie in the database */
  movie_id: number;
  /** TMDB API identifier for the movie */
  tmdb_id: number;
  /** Title of the movie */
  title: string;
  /** Synopsis/description of the movie */
  description: string;
  /** Release date of the movie (YYYY-MM-DD format) */
  release_date: string;
  /** Path to the movie's poster image */
  poster_image: string;
  /** Path to the movie's backdrop image */
  backdrop_image: string;
  /** Runtime of the movie in minutes */
  runtime: number;
  /** User/critical rating of the movie (typically on a scale of 0-10) */
  user_rating: number;
  /** MPAA rating or equivalent content rating (e.g., "PG", "PG-13", "R") */
  mpa_rating: string;
  /** Watch status of the movie ('WATCHED', 'WATCHING', or 'NOT_WATCHED') */
  watch_status: 'WATCHED' | 'WATCHING' | 'NOT_WATCHED';
  /** Array of genre names associated with the movie */
  genres: string;
  /** Array of streaming service names where the movie is available */
  streaming_services: string;
}

/**
 * Represents a movie with recent release date from a profile's watchlist
 */
export interface RecentMovie {
  movie_id: number;
  title: string;
  release_date: string;
  poster_image: string;
  watch_status: 'WATCHED' | 'WATCHING' | 'NOT_WATCHED';
}

/**
 * Represents a movie with upcoming release date from a profile's watchlist
 */
export interface UpcomingMovie {
  movie_id: number;
  title: string;
  release_date: string;
  poster_image: string;
  watch_status: 'WATCHED' | 'WATCHING' | 'NOT_WATCHED';
}
