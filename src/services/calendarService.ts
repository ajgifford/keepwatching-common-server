import * as episodesDb from '../db/episodesDb';
import * as moviesDb from '../db/movies/movieRepository';
import { errorService } from './errorService';
import { CalendarContentResponse } from '@ajgifford/keepwatching-types';

const DEFAULT_PAST_DAYS = 30;
const DEFAULT_FUTURE_DAYS = 60;

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - DEFAULT_PAST_DAYS);
  return toISODate(d);
}

function defaultEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + DEFAULT_FUTURE_DAYS);
  return toISODate(d);
}

/**
 * Service for calendar content — episodes and movies for a profile within a date range.
 */
export class CalendarService {
  /**
   * Gets all episodes and movies for a profile within a date range.
   *
   * @param profileId - ID of the profile
   * @param startDate - Start of range in ISO format (YYYY-MM-DD). Defaults to 30 days ago.
   * @param endDate - End of range in ISO format (YYYY-MM-DD). Defaults to 60 days from now.
   * @returns Combined calendar content response
   */
  public async getCalendarContentForProfile(
    profileId: number,
    startDate?: string,
    endDate?: string,
  ): Promise<CalendarContentResponse> {
    try {
      const start = startDate ?? defaultStartDate();
      const end = endDate ?? defaultEndDate();

      const [episodes, movies] = await Promise.all([
        episodesDb.getCalendarEpisodesForProfile(profileId, start, end),
        moviesDb.getCalendarMoviesForProfile(profileId, start, end),
      ]);

      return { episodes, movies };
    } catch (error) {
      throw errorService.handleError(error, `getCalendarContentForProfile(${profileId})`);
    }
  }
}

export const calendarService = new CalendarService();
