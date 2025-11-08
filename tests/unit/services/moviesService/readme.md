# MoviesService Tests

This directory contains tests for the MoviesService, split into logical groups for maintainability.

## Structure

- `helpers/` - Shared test utilities and fixtures
  - `fixtures.ts` - Mock data and TMDB responses
  - `mocks.ts` - Mock setup functions and utilities
- `basic.test.ts` - Core functionality tests (getMoviesForProfile, getMovieDetailsForProfile, etc.)
- `favorites.test.ts` - Favorites management tests (add/remove)
- `watchStatus.test.ts` - Watch status management tests
- `updates.test.ts` - Content update tests (checkMovieForChanges, getMoviesForUpdates)
- `statistics.test.ts` - Statistics calculation tests
- `cache.test.ts` - Cache management tests
- `digest.test.ts` - Content discovery tests (trending, recently released, top rated)
- `recommendations.test.ts` - Movie recommendation tests

## Running Tests

Run all MoviesService tests:
```bash
yarn test services/moviesService
```

Run a specific test file:
```bash
yarn test tests/unit/services/moviesService/basic.test.ts
```

## Pattern

All tests follow the factory pattern for proper test isolation:

```typescript
import { setupMoviesService } from './helpers/mocks';

describe('MoviesService - [Category]', () => {
  let service: ReturnType<typeof setupMoviesService>['service'];
  let mockCache: ReturnType<typeof setupMoviesService>['mockCache'];

  beforeEach(() => {
    const setup = setupMoviesService();
    service = setup.service;
    mockCache = setup.mockCache;
  });

  // tests...
});
```

Each test gets a fresh service instance with mocked dependencies for complete isolation.
