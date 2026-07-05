export {
  saveMovie,
  updateMovie,
  saveFavorite,
  removeFavorite,
  updateWatchStatus,
  hasMovieWatchHistory,
  rebuildMovieStatusFromHistory,
  findMovieById,
  findMovieByTMDBId,
  getAllMoviesForProfile,
  getMovieForProfile,
  getMovieDetailsForProfile,
  getRecentMovieReleasesForProfile,
  getUpcomingMovieReleasesForProfile,
  getMoviesForUpdates,
} from './movies/movieRepository';

export {
  getAllMovies,
  getAllMoviesFiltered,
  getAllMoviesByProfile,
  getAllMoviesReferences,
  getMoviesCount,
  getMoviesCountByProfile,
  getMoviesCountFiltered,
  getMovieFilterOptions,
  getMovieDetails,
  getMovieProfiles,
} from './movies/adminMovieRepository';

export type { MovieFilterOptions } from '../types/movieTypes';

export { getRecentlyReleasedMovies, getTopRatedMovies, getTrendingMovies } from './movies/digestMovieRepository';
