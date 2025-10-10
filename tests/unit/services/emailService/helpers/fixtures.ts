import { EmailContentResult } from '../../../../../src/types/emailTypes';

/**
 * Mock digest email data
 */
export const mockDigestData = {
  to: 'user1@example.com',
  accountName: 'User 1',
  accountId: 1,
  profiles: [],
  weekRange: { start: '2025-06-02', end: '2025-06-08' },
};

/**
 * Mock discovery email data
 */
export const mockDiscoveryData = {
  to: 'user2@example.com',
  accountName: 'User 2',
  accountId: 2,
  trendingShows: [],
  newReleases: [],
  popularMovies: [],
  data: { weekRange: { start: '2025-06-02', end: '2025-06-08' } },
};

/**
 * Mock email content result for digest
 */
export const mockDigestContentResult: EmailContentResult = {
  account: { email: 'john@example.com', name: 'John Doe' },
  emailType: 'digest',
  profileCount: 1,
  profilesWithContent: 1,
  profileAnalyses: [],
  digestData: {
    to: 'john@example.com',
    accountName: 'John Doe',
    profiles: [],
    weekRange: { start: '2025-06-02', end: '2025-06-08' },
    accountId: 0,
  },
};

/**
 * Mock email templates
 */
export const mockEmailTemplates = [
  {
    id: 1,
    name: 'Welcome',
    subject: 'Welcome!',
    body: 'Hello',
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
  },
  {
    id: 2,
    name: 'Reminder',
    subject: 'Reminder',
    body: "Don't forget",
    created_at: '2025-01-02',
    updated_at: '2025-01-02',
  },
];

/**
 * Mock sent emails
 */
export const mockSentEmails = [
  { id: 1, subject: 'Email 1', message: 'Message 1', status: 'sent' },
  { id: 2, subject: 'Email 2', message: 'Message 2', status: 'sent' },
];

/**
 * Mock email recipients
 */
export const mockEmailRecipients = [
  { id: 1, email: 'user1@example.com' },
  { id: 2, email: 'user2@example.com' },
];

/**
 * Mock batch email content
 */
export const mockBatchEmailContent = {
  digestEmails: [
    {
      to: 'user1@example.com',
      accountName: 'User 1',
      accountId: 1,
      profiles: [],
      weekRange: { start: '2025-06-02', end: '2025-06-08' },
    },
    {
      to: 'user2@example.com',
      accountName: 'User 2',
      accountId: 2,
      profiles: [],
      weekRange: { start: '2025-06-02', end: '2025-06-08' },
    },
  ],
  discoveryEmails: [
    {
      to: 'user3@example.com',
      accountName: 'User 3',
      accountId: 3,
      trendingShows: [],
      newReleases: [],
      popularMovies: [],
      data: { weekRange: { start: '2025-06-02', end: '2025-06-08' } },
    },
  ],
};
