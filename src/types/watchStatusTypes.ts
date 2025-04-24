/**
 * Enum for watch status values
 * Used for shows, seasons, and episodes
 */
export enum WatchStatus {
  NOT_WATCHED = 'NOT_WATCHED',
  WATCHING = 'WATCHING',
  WATCHED = 'WATCHED',
  UP_TO_DATE = 'UP_TO_DATE'
}

/**
 * Watch status type for type safety
 * This is a union type of the allowed watch status values
 */
export type WatchStatusType = 'NOT_WATCHED' | 'WATCHING' | 'WATCHED' | 'UP_TO_DATE';
