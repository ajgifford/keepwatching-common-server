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
  getShowForProfile,
  getShowForProfileByChild,
  getShowWithSeasonsForProfile,
  getShowWithSeasonsForProfileByChild,
  getNextUnwatchedEpisodesForProfile,
  getProfilesForShow,
} from './shows/profileShowRepository';

export { saveFavorite, removeFavorite } from './shows/showWatchStatusRepository';

export {
  getAllShows,
  getShowsCount,
  getAdminShowDetails,
  getAdminShowSeasons,
  getAdminShowSeasonsWithEpisodes,
  getAdminSeasonEpisodes,
  getAdminShowProfiles,
  getAdminShowWatchProgress,
} from './shows/adminShowRepository';

export { getTrendingShows, getNewlyAddedShows, getTopRatedShows } from './shows/digestShowRepository';
