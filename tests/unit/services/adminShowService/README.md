# Admin Show Service Tests

This directory contains organized unit tests for the `adminShowService`. The tests have been broken down into smaller, functionality-based units for better maintainability and clarity.

## Test Files

### `basic.test.ts`
Tests for basic CRUD operations:
- `getShowDetails` - Fetching show details with caching
- `getShowSeasons` - Fetching show seasons with caching
- `getSeasonEpisodes` - Fetching season episodes with caching
- `getShowProfiles` - Fetching show profiles with caching
- `getShowWatchProgress` - Fetching watch progress with caching

### `pagination.test.ts`
Tests for paginated data retrieval:
- `getAllShows` - Fetching all shows with pagination
- `getAllShowsByProfile` - Fetching shows by profile with pagination
- Pagination calculation and edge cases

### `complete.test.ts`
Tests for complete show information retrieval:
- `getCompleteShowInfo` - Fetching all show data in one call
- `getShowSeasonsWithEpisodes` - Fetching seasons with nested episodes

### `updates.test.ts`
Tests for update operations:
- `updateShowById` - Updating show data from TMDB
  - Successful updates
  - Error handling
  - Season filtering (excluding season 0)
  - Notification creation for new seasons
  - Update mode variations (latest vs all)
- `updateAllShows` - Batch update operations

### `cache.test.ts`
Tests for cache management:
- `invalidateShowCache` - Invalidating show-specific cache
- `invalidateAllShows` - Invalidating all shows cache pattern

### `references.test.ts`
Tests for show reference operations:
- `getAllShowReferences` - Fetching minimal show reference data

## Helper Files

### `helpers/fixtures.ts`
Contains shared mock data used across tests:
- Mock show details, seasons, episodes
- Mock profiles and watch progress
- Mock TMDB responses
- Mock show references and pagination data

### `helpers/mocks.ts`
Contains shared mock setup functions:
- `setupDefaultMocks()` - Sets up common mocks for all tests
- `createMockCacheService()` - Creates a mock cache service instance

## Running Tests

```bash
# Run all adminShowService tests
npm test -- adminShowService

# Run a specific test file
npm test -- adminShowService/basic.test.ts

# Run tests in watch mode
npm test -- --watch adminShowService
```

## Test Organization Pattern

Each test file follows this structure:
1. Import necessary dependencies and fixtures
2. Mock all external dependencies
3. Set up beforeEach hooks for common test setup
4. Group related tests in describe blocks
5. Use clear, descriptive test names

This organization makes it easier to:
- Find specific tests quickly
- Understand what functionality is being tested
- Maintain and update tests
- Run focused test suites
