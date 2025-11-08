# Factory Pattern Refactor Guide

## Problem Statement

The test suite exhibits **flaky behavior** with non-deterministic failures across runs. Tests report "SyntaxError:
Unexpected end of input" for files that are syntactically valid.

### Root Cause

The issue is **NOT** syntax errors or circular dependencies. The actual causes are:

1. **Singleton State Pollution**: Services are exported as singleton instances
   (`export const serviceName = new ServiceName()`)
2. **Shared Module State**: All test files importing a service share the same instance
3. **Test Collection Phase Failures**: Vitest's module loader fails when multiple tests try to mock the same singleton
   instance
4. **Object.defineProperty Conflicts**: Tests using `Object.defineProperty` on singleton instances interfere with each
   other

### Evidence

- **Run 1**: `activity/profile.test.ts` failed
- **Run 2**: Different set of 8 test suites failed
- **Run 3**: Different set of 6 test suites failed

The non-deterministic failures confirm the issue is test environment/timing, not code quality.

---

## Solution: Factory Pattern with Dependency Injection

Refactor all services to use a factory pattern that:

- ✅ Allows dependency injection for testing
- ✅ Provides singleton instances for production
- ✅ Maintains backward compatibility
- ✅ Eliminates test state pollution

---

## Implementation Pattern

### Service File Template

Every service should follow this pattern:

```typescript
export class ServiceName {
  private cache: CacheService;
  // ... other dependencies

  /**
   * Constructor accepts optional dependencies for testing
   */
  constructor(dependencies?: {
    cacheService?: CacheService;
    // ... other injectable dependencies
  }) {
    this.cache = dependencies?.cacheService ?? CacheService.getInstance();
    // ... initialize other dependencies with fallback to defaults
  }

  // ... service methods (unchanged)
}

/**
 * Factory function for creating new instances
 * Use this in tests to create isolated instances with mocked dependencies
 */
export function createServiceName(dependencies?: { cacheService?: CacheService }): ServiceName {
  return new ServiceName(dependencies);
}

/**
 * Singleton instance for production use
 */
let instance: ServiceName | null = null;

/**
 * Get or create singleton instance
 * Use this in production code
 */
export function getServiceName(): ServiceName {
  if (!instance) {
    instance = createServiceName();
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 * Call this in beforeEach/afterEach to ensure test isolation
 */
export function resetServiceName(): void {
  instance = null;
}

/**
 * Backward-compatible default export
 * Existing code using `import { serviceName }` continues to work
 */
export const serviceName = getServiceName();
```

### Test File Template

Update test files to use the factory pattern:

```typescript
import { ServiceName, createServiceName, resetServiceName } from '@services/serviceName';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@db/someDb');
vi.mock('@services/otherService');

describe('ServiceName', () => {
  let service: ServiceName;
  let mockCache: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // ✅ Reset singleton to ensure test isolation
    resetServiceName();

    // ✅ Create mocks for dependencies
    mockCache = {
      getOrSet: vi.fn(),
      invalidate: vi.fn(),
    };

    // ✅ Create fresh instance with mocked dependencies
    service = createServiceName({ cacheService: mockCache });
  });

  afterEach(() => {
    // ✅ Clean up after each test
    resetServiceName();
    vi.resetModules();
  });

  describe('someMethod', () => {
    it('should do something', async () => {
      // ✅ Use the locally scoped service instance
      mockCache.getOrSet.mockResolvedValue(mockData);

      const result = await service.someMethod(123);

      expect(result).toEqual(mockData);
      expect(mockCache.getOrSet).toHaveBeenCalledWith('cache_key', expect.any(Function), 1800);
    });
  });
});
```

---

## Reference Implementation

See **`src/services/statistics/profileStatisticsService.ts`** for the complete reference implementation.

Key aspects of the reference:

- Constructor accepts `CacheService` as optional dependency
- Factory function `createProfileStatisticsService()`
- Singleton getter `getProfileStatisticsService()`
- Reset function `resetProfileStatisticsService()`
- Backward-compatible export `profileStatisticsService`

---

## Services to Refactor

### Statistics Services (3)

- [x] `profileStatisticsService` - **REFERENCE IMPLEMENTATION**
- [ ] `accountStatisticsService`
- [ ] `adminStatisticsService`

### Core Services (8)

- [ ] `accountService`
- [ ] `profileService`
- [ ] `showService`
- [ ] `moviesService`
- [ ] `episodesService`
- [ ] `seasonsService`
- [ ] `watchStatusService`
- [ ] `personService`

### Supporting Services (10)

- [ ] `errorService`
- [ ] `notificationsService`
- [ ] `preferencesService`
- [ ] `contentUpdatesService`
- [ ] `contentDiscoveryService`
- [ ] `achievementDetectionService`
- [ ] `healthService`
- [ ] `databaseService`
- [ ] `socketService`
- [ ] `scheduledJobsService`
- [ ] `streamingAvailabilityService`

### Email Services (3)

- [ ] `emailService`
- [ ] `emailContentService`
- [ ] `emailDeliveryService`

### Admin Services (2)

- [ ] `adminShowService`
- [ ] `adminMovieService`

### Special Cases

#### CacheService

**Status**: Already implements singleton pattern with `getInstance()`. No changes needed.

#### TMDBService

**Status**: Already uses getter function `getTMDBService()`. No changes needed.

---

## Migration Steps

For each service:

1. **Update Service File**
   - Make constructor accept optional dependencies object
   - Add factory function `createServiceName()`
   - Add singleton getter `getServiceName()`
   - Add reset function `resetServiceName()`
   - Keep backward-compatible export

2. **Update Test Files**
   - Import factory and reset functions
   - Add `resetServiceName()` to `beforeEach` and `afterEach`
   - Use factory function to create service with mocked dependencies
   - Remove `Object.defineProperty` hacks
   - Use locally scoped service instance in tests

3. **Update Exports** (if needed)
   - Check `src/services.ts` for any aggregated exports
   - Ensure factory and reset functions are exported if needed

4. **Test**
   - Run test suite for the refactored service
   - Verify no regressions
   - Check that tests pass consistently

---

## Benefits

1. **Test Isolation**: Each test gets a fresh service instance
2. **No State Pollution**: Tests don't affect each other
3. **Better Mocking**: Direct dependency injection, no `Object.defineProperty` hacks
4. **Backward Compatible**: Existing production code works unchanged
5. **Consistent Patterns**: All services follow the same structure
6. **Easier Debugging**: Clear dependency flow

---

## Breaking Changes

**None!** The backward-compatible exports ensure all existing code continues to work without modification.

---

## Verification

After refactoring all services:

1. Run full test suite 3 times
2. All runs should have identical results
3. No flaky "syntax error" failures
4. Test count should remain the same

---

## Notes for AI Agents

- Use `profileStatisticsService` as the exact template
- Copy the pattern exactly for consistency
- Don't skip the reset function - it's critical for test isolation
- Ensure all dependencies are injectable
- Keep the backward-compatible export for production code
- Update test files to use the factory pattern
- Test each service after refactoring before moving to the next

---

## Questions?

Refer to the reference implementation in `src/services/statistics/profileStatisticsService.ts` for any clarification.
