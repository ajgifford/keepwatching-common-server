import {
  StatusChange,
  WatchStatusEpisodeRow,
  WatchStatusExtendedEpisodeRow,
  WatchStatusExtendedSeasonRow,
  WatchStatusSeasonRow,
  WatchStatusShowRow,
} from '../../../../../src/types/watchStatusTypes';
import { WatchStatus } from '@ajgifford/keepwatching-types';
import { PoolConnection, RowDataPacket } from 'mysql2/promise';

export interface StatusUpdateContext {
  changes: StatusChange[];
  totalAffectedRows: number;
  connection: PoolConnection;
  profileId: number;
  timestamp: Date;
}

export interface StatusUpdateContext {
  changes: StatusChange[];
  totalAffectedRows: number;
  connection: PoolConnection;
  profileId: number;
  timestamp: Date;
}

type WatchStatusEpisodeRowData = Omit<WatchStatusEpisodeRow, keyof RowDataPacket>;
type WatchStatusExtendedEpisodeRowData = Omit<WatchStatusExtendedEpisodeRow, keyof RowDataPacket>;
type WatchStatusSeasonRowData = Omit<WatchStatusSeasonRow, keyof RowDataPacket>;
type WatchStatusExtendedSeasonRowData = Omit<WatchStatusExtendedSeasonRow, keyof RowDataPacket>;
type WatchStatusShowRowData = Omit<WatchStatusShowRow, keyof RowDataPacket>;

export function createMockEpisodeRow(overrides: Partial<WatchStatusEpisodeRowData> = {}): WatchStatusEpisodeRow {
  return {
    id: 1,
    season_id: 1,
    air_date: '2023-01-15',
    status: WatchStatus.NOT_WATCHED,
    ...overrides,
  } as WatchStatusEpisodeRow;
}

export function createMockEpisodeExtendedRow(
  overrides: Partial<WatchStatusExtendedEpisodeRowData> = {},
): WatchStatusExtendedEpisodeRow {
  return {
    id: 1,
    season_id: 1,
    air_date: '2023-01-15',
    status: WatchStatus.NOT_WATCHED,
    season_status: WatchStatus.NOT_WATCHED,
    season_air_date: '2023-01-01',
    show_id: 1,
    show_in_production: 1,
    show_status: WatchStatus.NOT_WATCHED,
    show_air_date: '2023-01-01',
    ...overrides,
  } as WatchStatusExtendedEpisodeRow;
}

export function createMockSeasonRow(overrides: Partial<WatchStatusSeasonRowData> = {}): WatchStatusSeasonRow {
  return {
    id: 1,
    show_id: 1,
    release_date: '2023-01-01',
    status: WatchStatus.NOT_WATCHED,
    ...overrides,
  } as WatchStatusSeasonRow;
}

export function createMockSeasonExtendedRow(
  overrides: Partial<WatchStatusExtendedSeasonRowData> = {},
): WatchStatusExtendedSeasonRow {
  return {
    id: 1,
    show_id: 1,
    release_date: '2023-01-01',
    status: WatchStatus.NOT_WATCHED,
    show_in_production: 1,
    show_status: WatchStatus.NOT_WATCHED,
    show_air_date: '2023-01-01',
    ...overrides,
  } as WatchStatusExtendedSeasonRow;
}

export function createMockShowRow(overrides: Partial<WatchStatusShowRowData> = {}): WatchStatusShowRow {
  return {
    id: 1,
    release_date: '2023-01-01',
    in_production: 1,
    status: WatchStatus.NOT_WATCHED,
    ...overrides,
  } as WatchStatusShowRow;
}

export function createMockStatusChange(overrides: Partial<StatusChange> = {}): StatusChange {
  return {
    entityType: 'episode',
    entityId: 1,
    from: WatchStatus.NOT_WATCHED,
    to: WatchStatus.WATCHED,
    timestamp: new Date('2023-01-01T10:00:00Z'),
    reason: 'Test change',
    ...overrides,
  };
}

export function createMockContext(overrides: Partial<StatusUpdateContext> = {}): StatusUpdateContext {
  return {
    changes: [],
    totalAffectedRows: 0,
    connection: {} as PoolConnection,
    profileId: 123,
    timestamp: new Date('2023-01-01T10:00:00Z'),
    ...overrides,
  };
}
