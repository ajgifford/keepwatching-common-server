import {
  ContentReference,
  Email,
  EmailStatus,
  EmailTemplate,
  KeepWatchingShow,
  MovieReference,
  RecentUpcomingEpisode,
} from '@ajgifford/keepwatching-types';
import { RowDataPacket } from 'mysql2';

export interface ProfileContentAnalysis {
  profile: {
    id: number;
    name: string;
  };
  hasContent: boolean;
  upcomingEpisodes: RecentUpcomingEpisode[];
  upcomingMovies: MovieReference[];
  continueWatching: KeepWatchingShow[];
  weeklyUpcomingEpisodes: RecentUpcomingEpisode[];
  weeklyUpcomingMovies: MovieReference[];
}

export interface AccountContentAnalysis {
  hasUpcomingContent: boolean;
  profileAnalyses: ProfileContentAnalysis[];
  profileDigests: DigestData[];
}

export interface DiscoveryData {
  accountName: string;
  profiles: {
    id: number;
    name: string;
  }[];
  featuredContent: {
    trendingShows: MovieReference[];
    newReleases: MovieReference[];
    popularMovies: MovieReference[];
  };
  weekRange: {
    start: string;
    end: string;
  };
}

export interface EmailContentResult {
  account: { email: string; name: string };
  emailType: 'digest' | 'discovery';
  profileCount: number;
  profilesWithContent: number;
  profileAnalyses: ProfileContentAnalysis[];
  digestData?: DigestEmail;
  discoveryData?: DiscoveryEmail;
}

export interface FeaturedContent {
  trendingShows: ContentReference[];
  newReleases: ContentReference[];
  popularMovies: ContentReference[];
}

export interface DiscoveryEmail {
  accountId: number;
  to: string;
  accountName: string;
  data: DiscoveryData;
}

export interface DigestData {
  profile: {
    id: number;
    name: string;
  };
  upcomingEpisodes: RecentUpcomingEpisode[];
  upcomingMovies: MovieReference[];
  continueWatching: KeepWatchingShow[];
}

export interface DigestEmail {
  accountId: number;
  to: string;
  accountName: string;
  profiles: DigestData[];
  weekRange: {
    start: string;
    end: string;
  };
}

export interface EmailBatch {
  digestEmails: DigestEmail[];
  discoveryEmails: DiscoveryEmail[];
}

export interface CreateEmailRow {
  subject: string;
  message: string;
  sent_to_all: boolean;
  account_count: number;
  scheduled_date: string | null;
  sent_date: string | null;
  status: EmailStatus;
}

export interface UpdateEmailRow extends CreateEmailRow {
  id: number;
}

export interface EmailTemplateRow extends RowDataPacket {
  id: number;
  name: string;
  subject: string;
  message: string;
  created_at: string;
  updated_at: string;
}

export interface EmailRow extends RowDataPacket {
  id: number;
  subject: string;
  message: string;
  sent_to_all: number;
  account_count: number;
  scheduled_date: string | null;
  sent_date: string | null;
  status: EmailStatus;
  created_at: string;
  updated_at: string;
}

export function transformEmailTemplateRow(emailTemplateRow: EmailTemplateRow): EmailTemplate {
  return {
    id: emailTemplateRow.id,
    name: emailTemplateRow.name,
    subject: emailTemplateRow.subject,
    message: emailTemplateRow.message,
    createdAt: emailTemplateRow.created_at,
    updatedAt: emailTemplateRow.updated_at,
  };
}

export function transformEmailRow(sentEmailRow: EmailRow): Email {
  return {
    id: sentEmailRow.id,
    subject: sentEmailRow.subject,
    message: sentEmailRow.message,
    sentToAll: sentEmailRow.sent_to_all === 1,
    accountCount: sentEmailRow.account_count,
    scheduledDate: sentEmailRow.scheduled_date,
    sentDate: sentEmailRow.sent_date,
    status: sentEmailRow.status,
    createdAt: sentEmailRow.created_at,
    updatedAt: sentEmailRow.updated_at,
  };
}
