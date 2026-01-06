import { RowDataPacket } from 'mysql2';

export interface CountRow extends RowDataPacket {
  count: number;
}

export interface SummaryCountRow extends RowDataPacket {
  entity: string;
  count: number;
}
