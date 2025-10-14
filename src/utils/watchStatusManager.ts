import { StatusChange, WatchStatusEpisode, WatchStatusSeason, WatchStatusShow } from '../types/watchStatusTypes';
import { WatchStatus } from '@ajgifford/keepwatching-types';

/**
 * Centralized watch status management system
 */
export class WatchStatusManager {
  private static instance: WatchStatusManager;
  private statusChangeListeners: ((change: StatusChange) => void)[] = [];

  public static getInstance(): WatchStatusManager {
    if (!WatchStatusManager.instance) {
      WatchStatusManager.instance = new WatchStatusManager();
    }
    return WatchStatusManager.instance;
  }

  /**
   * Subscribe to status change events
   */
  public onStatusChange(listener: (change: StatusChange) => void): void {
    this.statusChangeListeners.push(listener);
  }

  /**
   * Emit status change event
   */
  private emitStatusChange(change: StatusChange): void {
    this.statusChangeListeners.forEach((listener) => listener(change));
  }

  /**
   * Helper method to check if a date is valid and in the past
   */
  private hasAired(date: Date, now: Date = new Date()): boolean {
    // Check if date is valid and not in the future
    return date instanceof Date && !isNaN(date.getTime()) && date <= now;
  }

  /**
   * Helper method to check if a date is valid and in the future
   */
  private isUnaired(date: Date, now: Date = new Date()): boolean {
    // If date is invalid (null/undefined/invalid string), treat as unaired
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return true;
    }
    return date > now;
  }

  /**
   * Calculate the current status of an episode
   */
  public calculateEpisodeStatus(episode: WatchStatusEpisode, now: Date = new Date()): WatchStatus {
    if (this.isUnaired(episode.airDate, now)) {
      return WatchStatus.UNAIRED;
    }

    return episode.watchStatus === WatchStatus.WATCHED ? WatchStatus.WATCHED : WatchStatus.NOT_WATCHED;
  }

  /**
   * Calculate the current status of a season
   */
  public calculateSeasonStatus(season: WatchStatusSeason, now: Date = new Date()): WatchStatus {
    const { episodes } = season;

    if (this.isUnaired(season.airDate, now)) {
      return WatchStatus.UNAIRED;
    }

    const airedEpisodes = episodes.filter((e) => this.hasAired(e.airDate, now));
    const unairedEpisodes = episodes.filter((e) => this.isUnaired(e.airDate, now));
    const watchedAiredEpisodes = airedEpisodes.filter((e) => e.watchStatus === WatchStatus.WATCHED);

    // No aired episodes means season hasn't really started
    if (airedEpisodes.length === 0) {
      return WatchStatus.UNAIRED;
    }

    // No watched episodes
    if (watchedAiredEpisodes.length === 0) {
      return WatchStatus.NOT_WATCHED;
    }

    // Some but not all aired episodes watched
    if (watchedAiredEpisodes.length < airedEpisodes.length) {
      return WatchStatus.WATCHING;
    }

    // All aired episodes watched, but more episodes coming
    if (unairedEpisodes.length > 0) {
      return WatchStatus.UP_TO_DATE;
    }

    // All episodes watched and none coming
    return WatchStatus.WATCHED;
  }

  /**
   * Calculate the current status of a show
   */
  public calculateShowStatus(show: WatchStatusShow, now: Date = new Date()): WatchStatus {
    const { seasons, inProduction } = show;

    // If show hasn't aired yet
    if (this.isUnaired(show.airDate, now)) {
      return WatchStatus.UNAIRED;
    }

    // Filter seasons by air status - a season is only "aired" if it has episodes that have aired
    const airedSeasons =
      seasons?.filter((s) => {
        // If no episodes, season should be treated as unaired regardless of air date
        if (!s.episodes || s.episodes.length === 0) {
          return false;
        }
        // Season has aired if at least one episode has aired
        return s.episodes.some((ep) => this.hasAired(ep.airDate, now));
      }) || [];
    const unairedSeasons =
      seasons?.filter((s) => {
        // If no episodes, season should be treated as unaired
        if (!s.episodes || s.episodes.length === 0) {
          return true;
        }
        // Season is unaired if all episodes are unaired
        return s.episodes.every((ep) => this.isUnaired(ep.airDate, now));
      }) || [];

    // No aired seasons
    if (airedSeasons.length === 0) {
      return WatchStatus.UNAIRED;
    }

    // Calculate status for each aired season
    const seasonStatuses = airedSeasons.map((season) => season.watchStatus || this.calculateSeasonStatus(season, now));
    const watchedSeasons = seasonStatuses.filter((s) => s === WatchStatus.WATCHED);
    const upToDateSeasons = seasonStatuses.filter((s) => s === WatchStatus.UP_TO_DATE);
    const watchingSeasons = seasonStatuses.filter((s) => s === WatchStatus.WATCHING);
    const notWatchedSeasons = seasonStatuses.filter((s) => s === WatchStatus.NOT_WATCHED);

    // All seasons not watched
    if (notWatchedSeasons.length === airedSeasons.length) {
      return WatchStatus.NOT_WATCHED;
    }

    // Any season currently being watched
    if (watchingSeasons.length > 0) {
      return WatchStatus.WATCHING;
    }

    // Mix of watched/up-to-date and not watched (actual progress)
    if (notWatchedSeasons.length > 0 && (watchedSeasons.length > 0 || upToDateSeasons.length > 0)) {
      return WatchStatus.WATCHING;
    }

    // All seasons watched or up to date
    const allComplete = watchedSeasons.length + upToDateSeasons.length === airedSeasons.length;

    if (allComplete) {
      // If show is still in production or has future seasons, it's up to date
      if (inProduction || unairedSeasons.length > 0) {
        return WatchStatus.UP_TO_DATE;
      }
      // Show is complete and no longer in production
      return WatchStatus.WATCHED;
    }

    // Default fallback
    return WatchStatus.WATCHING;
  }

  /**
   * Generate status summary for debugging
   */
  public generateStatusSummary(show: WatchStatusShow, now: Date = new Date()): string {
    const showStatus = this.calculateShowStatus(show, now);
    let summary = `Show "${show.id}" - Status: ${showStatus}\n`;
    summary += `  Air Date: ${this.isUnaired(show.airDate, now) ? 'INVALID/UNAIRED' : show.airDate.toISOString()}\n`;
    summary += `  In Production: ${show.inProduction}\n`;
    summary += `  Seasons: ${show.seasons?.length}\n\n`;

    show.seasons!.forEach((season) => {
      const seasonStatus = this.calculateSeasonStatus(season, now);
      summary += `  Season "${season.id}" - Status: ${seasonStatus}\n`;
      summary += `    Air Date: ${this.isUnaired(season.airDate, now) ? 'INVALID/UNAIRED' : season.airDate.toISOString()}\n`;
      summary += `    Episodes: ${season.episodes.length}\n`;

      const watchedCount = season.episodes.filter((e) => e.watchStatus === WatchStatus.WATCHED).length;
      const airedCount = season.episodes.filter((e) => this.hasAired(e.airDate, now)).length;
      summary += `    Progress: ${watchedCount}/${airedCount} aired episodes watched\n\n`;
    });

    return summary;
  }
}
