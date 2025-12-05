export {
  saveShow,
  updateShow,
  findShowById,
  findShowByTMDBId,
  getShowsForUpdates,
  saveShowGenre,
  saveShowStreamingService,
} from './shows/showRepository';

export {
  getAllShowsForProfile,
  getNextUnwatchedEpisodesForProfile,
  getProfilesForShow,
  getShowForProfile,
  getShowForProfileByChild,
  getShowWithSeasonsForProfile,
  getShowWithSeasonsForProfileByChild,
  getWatchProgressForProfile,
} from './shows/profileShowRepository';

export { saveFavorite, removeFavorite } from './shows/showWatchStatusRepository';

export {
  getAllShows,
  getAllShowsByProfile,
  getAllShowReferences,
  getShowsCount,
  getShowsCountByProfile,
  getAdminShowDetails,
  getAdminShowSeasons,
  getAdminShowSeasonsWithEpisodes,
  getAdminSeasonEpisodes,
  getAdminShowProfiles,
  getAdminShowWatchProgress,
} from './shows/adminShowRepository';

export { getTrendingShows, getNewlyAddedShows, getTopRatedShows } from './shows/digestShowRepository';
