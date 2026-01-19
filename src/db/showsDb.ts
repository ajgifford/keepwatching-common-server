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
  getAllShowsFiltered,
  getAllShowsByProfile,
  getAllShowReferences,
  getShowsCount,
  getShowsCountByProfile,
  getShowsCountFiltered,
  getShowFilterOptions,
  getAdminShowDetails,
  getAdminShowSeasons,
  getAdminShowSeasonsWithEpisodes,
  getAdminSeasonEpisodes,
  getAdminShowProfiles,
  getAdminShowWatchProgress,
} from './shows/adminShowRepository';

export type { ShowFilterOptions } from './shows/adminShowRepository';

export { getTrendingShows, getNewlyAddedShows, getTopRatedShows } from './shows/digestShowRepository';
