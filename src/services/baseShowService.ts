import * as personsDb from '../db/personsDb';
import { cliLogger } from '../logger/logger';
import { TMDBShow, TMDBShowCastMember } from '../types/tmdbTypes';
import { CacheService } from './cacheService';
import { processContentCast } from './castUtility';
import { getTMDBService } from './tmdbService';
import { CreateShowCast } from '@ajgifford/keepwatching-types';

export abstract class BaseShowService {
  protected cache: CacheService;

  constructor(dependencies?: { cacheService?: CacheService }) {
    this.cache = dependencies?.cacheService ?? CacheService.getInstance();
  }

  protected async processShowCast(show: TMDBShow, showId: number): Promise<void> {
    try {
      const latestSeasonNumber = show.last_episode_to_air?.season_number;
      let activePersonIds: number[] = [];
      if (latestSeasonNumber) {
        const latestSeasonCast = await getTMDBService().getSeasonAggregateCredits(show.id, latestSeasonNumber);
        activePersonIds = latestSeasonCast.map((member) => member.id);
      }
      const filteredCast = this.filterShowCastMembers(show.aggregate_credits.cast ?? [], showId, activePersonIds);
      const jobs = filteredCast.map((castMember) => ({
        tmdbPersonId: castMember.person_id,
        save: (personId: number) =>
          personsDb.saveShowCast({
            content_id: showId,
            person_id: personId,
            character_name: castMember.character_name,
            credit_id: castMember.credit_id,
            cast_order: castMember.cast_order,
            total_episodes: castMember.total_episodes,
            active: castMember.active,
          }),
      }));
      await processContentCast(jobs, this.cache);
    } catch (error) {
      cliLogger.error('Error fetching show cast:', error);
    }
  }

  protected filterShowCastMembers(
    showCastMembers: TMDBShowCastMember[],
    contentId: number,
    activePersonIds: number[],
  ): CreateShowCast[] {
    const activePersonIdSet = new Set(activePersonIds);

    const candidates = showCastMembers.flatMap((showMember) => {
      const isActive = activePersonIdSet.has(showMember.id) ? 1 : 0;
      return showMember.roles
        .filter((role) => role.episode_count >= 2)
        .map((role) => ({
          content_id: contentId,
          person_id: showMember.id,
          character_name: role.character,
          credit_id: role.credit_id,
          cast_order: showMember.order,
          total_episodes: role.episode_count,
          active: isActive,
        }));
    });

    // TMDB sometimes lists the same actor/character with multiple credit entries (e.g. per-season
    // credits for a long-running show). Keep only the best row per (person, character) pair:
    // active > most episodes > lowest cast_order.
    const best = new Map<string, CreateShowCast>();
    for (const row of candidates) {
      const key = `${row.person_id}:${row.character_name.toLowerCase()}`;
      const existing = best.get(key);
      if (!existing) {
        best.set(key, row);
      } else {
        const preferNew =
          row.active > existing.active ||
          (row.active === existing.active && row.total_episodes > existing.total_episodes) ||
          (row.active === existing.active &&
            row.total_episodes === existing.total_episodes &&
            row.cast_order < existing.cast_order);
        if (preferNew) best.set(key, row);
      }
    }

    return Array.from(best.values());
  }
}
