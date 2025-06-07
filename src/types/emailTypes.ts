import { KeepWatchingShow, MovieReference, RecentUpcomingEpisode } from '@ajgifford/keepwatching-types';

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

export interface DiscoveryEmail {
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
