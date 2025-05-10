export {
  saveMovie,
  updateMovie,
  saveFavorite,
  removeFavorite,
  updateWatchStatus,
  findMovieById,
  findMovieByTMDBId,
  getAllMoviesForProfile,
  getMovieForProfile,
  getRecentMovieReleasesForProfile,
  getUpcomingMovieReleasesForProfile,
  getMoviesForUpdates,
  createMovie,
} from './movies/movieRepository';

export { getAllMovies, getMoviesCount, getMovieDetails, getMovieProfiles } from './movies/adminMovieRepository';
