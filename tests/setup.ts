// Set a longer timeout for certain tests
jest.setTimeout(10000);

// Automatically mock all services
jest.mock('@services/accountService');
jest.mock('@services/profileService');
jest.mock('@services/showService');
jest.mock('@services/moviesService');
jest.mock('@services/episodesService');
jest.mock('@services/seasonsService');
jest.mock('@services/statisticsService');
jest.mock('@services/contentDiscoveryService');
jest.mock('@services/notificationsService');
jest.mock('@services/errorService');
jest.mock('@services/socketService');
jest.mock('@services/cacheService');
jest.mock('@services/tmdbService');

// Mock utilities
jest.mock('@utils/db');
jest.mock('@utils/imageUtility');
jest.mock('@utils/genreUtility');
jest.mock('@utils/usSearchFilter');
jest.mock('@utils/retryUtil');
jest.mock('@utils/changesUtility');
jest.mock('@utils/contentUtility');
jest.mock('@utils/transactionHelper');
jest.mock('@utils/watchProvidersUtility');

// Mock middleware
jest.mock('@middleware/errorMiddleware');

// Mock external dependencies
jest.mock('axios');
jest.mock('axios-retry');
jest.mock('node-cron');
jest.mock('streaming-availability');
jest.mock('winston');
jest.mock('mysql2/promise');

// Global setup for all tests
beforeEach(() => {
  // Clear all mock implementations and call history before each test
  jest.clearAllMocks();
});

// Global teardown
afterAll(() => {
  // Clean up any resources if needed
  jest.restoreAllMocks();
});
