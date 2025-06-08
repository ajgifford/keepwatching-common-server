# ShowService Tests

This directory contains tests for the ShowService, split into logical groups for maintainability.

## Structure

- `helpers/` - Shared test utilities and fixtures
- `basic.test.ts` - Core functionality tests
- `episodes.test.ts` - Episode related tests
- `digest.test.ts` - Email digest related tests
- `favorites.test.ts` - Favorites management tests
- `watchStatus.test.ts` - Watch status management tests
- `recommendations.test.ts` - Show recommendation tests
- `statistics.test.ts` - Statistics calculation tests
- `updates.test.ts` - Content update tests
- `cache.test.ts` - Cache management tests

## Running Tests

Run all ShowService tests:
```bash
yarn test services/showService
```

Run a specific test file:
```bash
yarn test tests/unit/services/showService/basic.test.ts
```