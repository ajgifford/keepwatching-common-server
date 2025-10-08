# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript library providing shared services, utilities, and middleware for the KeepWatching platform - a TV show and movie tracking application. It's a private NPM package published to GitHub Package Registry and consumed by the main API server and web application.

## Development Commands

```bash
# Build
yarn build              # Compile TypeScript to dist/
yarn clean              # Remove dist/ directory
yarn rebuild            # Clean and build

# Testing
yarn test                      # Run Jest test suite
yarn test:coverage            # Run tests with coverage report
yarn test path/to/test.ts     # Run specific test file

# Code Quality
yarn lint              # Run ESLint
yarn lint:fix          # Auto-fix linting issues
yarn format            # Format with Prettier
yarn format:check      # Check formatting without changes
yarn type-check        # TypeScript type checking without emit

# Versioning (updates package.json and creates git tag)
yarn version:patch     # Bump patch version (0.5.0 -> 0.5.1)
yarn version:minor     # Bump minor version (0.5.0 -> 0.6.0)
yarn version:major     # Bump major version (0.5.0 -> 1.0.0)
```

## Architecture

### Service Layer Pattern

The codebase follows a **three-tier architecture**:

1. **DB Layer** (`src/db/`) - Repository pattern for database operations
   - One file per domain entity (e.g., `accountsDb.ts`, `showsDb.ts`, `emailDb.ts`)
   - Sub-directories for complex domains (`shows/`, `movies/`)
   - All DB operations use MySQL connection pool from `getDbPool()`
   - Return raw database rows or `null` for not found

2. **Service Layer** (`src/services/`) - Business logic and orchestration
   - One service per domain (e.g., `accountService.ts`, `showService.ts`)
   - Services orchestrate multiple DB operations, handle caching, call external APIs
   - All services are singletons exported as instances (e.g., `export const accountService = new AccountService()`)
   - Services handle error throwing and validation

3. **Middleware Layer** (`src/middleware/`) - Express middleware
   - `errorMiddleware.ts` - Global error handler (use at end of Express app)
   - `validationMiddleware.ts` - Zod schema validation (use before route handlers)
   - `loggerMiddleware.ts` - Request/response logging

### Key Architectural Patterns

**Transaction Management**: Use `TransactionHelper` from `src/utils/transactionHelper.ts` for multi-step database operations:

```typescript
const helper = new TransactionHelper();
await helper.executeInTransaction(async (connection) => {
  await connection.execute('INSERT INTO ...', values);
  await connection.execute('UPDATE ...', values);
});
```

**Caching**: The `CacheService` (singleton) provides in-memory caching with TTL and pattern invalidation:
- Cache keys are defined in `src/constants/cacheKeys.ts`
- Services use `cache.getOrSet()` for lazy loading with TTL
- Use `cache.invalidatePattern()` for bulk invalidation (e.g., `user_*`)

**External API Integration**:
- `tmdbService.ts` - The Movie Database API for content metadata
- `streamingAvailabilityService.ts` - Streaming platform availability
- Both use `axiosInstance.ts` with retry logic via `axios-retry`

**Error Handling**:
- Custom error classes in `src/middleware/errorMiddleware.ts`
- Services throw errors, middleware catches and formats responses
- `errorService.ts` logs errors to database for tracking

**Scheduled Jobs**:
- `scheduledJobsService.ts` manages cron jobs using `node-cron`
- Three content update jobs: shows (daily 2 AM), movies (weekly), people (daily 3 AM)
- Email digest job (weekly Sunday 9 AM by default)
- Jobs track status, last run time, and next scheduled run

### Package Exports

The library uses multiple entry points (see `package.json` exports):

```typescript
import { accountService } from '@ajgifford/keepwatching-common-server';
import { validateSchema } from '@ajgifford/keepwatching-common-server/middleware';
import { showSchema } from '@ajgifford/keepwatching-common-server/schema';
import { getEmailConfig } from '@ajgifford/keepwatching-common-server/config';
import { TransactionHelper } from '@ajgifford/keepwatching-common-server/utils';
```

### Path Aliases

TypeScript path aliases are configured in `tsconfig.json`:

```typescript
import { accountService } from '@services/accountService';
import { CacheService } from '@services/cacheService';
import { getEmailConfig } from '@config/config';
import { showsDb } from '@db/showsDb';
```

## Email System

The email system sends weekly digest emails to users with upcoming content:

**Configuration**:
- Set via environment variables (`EMAIL_HOST`, `EMAIL_USER`, etc.)
- Use `getEmailConfig()` from `src/config/config.ts`
- Enable/disable with `EMAIL_ENABLED=true`

**Email Service** (`src/services/emailService.ts`):
- Singleton instance: `export const emailService = new EmailService(config)`
- `sendWeeklyDigests()` - Main method called by scheduled job
- `sendTestEmail()` - Development testing utility
- Email templates in `src/services/email/` subdirectory

**Database Integration**:
- `emailDb.ts` tracks email delivery status and history
- Prevents duplicate sends and tracks engagement

## Testing Infrastructure

**Test Structure**:
- `tests/unit/` mirrors `src/` structure
- `tests/setup.ts` runs before all tests
- Use `jest-mock-extended` for type-safe mocks

**Test Utilities** (`src/testing/`):
- Mock service instances for all services
- Mock middleware and utilities
- Use in tests: `import { accountService } from '@ajgifford/keepwatching-common-server/testing'`

**Running Tests**:
- Tests use in-memory mocks, no real database required
- Path aliases work in tests via `moduleNameMapper` in `jest.config.js`
- Coverage excludes `src/index.ts` and `src/testing/**`

## Important Development Notes

**Database Connections**:
- Use `getDbPool()` from `src/utils/db.ts` for all DB operations
- Connection pool is configured via environment variables
- Always release connections in finally blocks or use TransactionHelper

**Type Safety**:
- Strict TypeScript mode enabled
- Types shared via `@ajgifford/keepwatching-types` package
- Local types in `src/types/` for internal use only

**Logging**:
- Winston-based structured logging with daily rotation
- Two loggers: `appLogger` (application logs) and `cliLogger` (CLI output)
- Import from `src/logger/logger.ts`

**Environment Configuration**:
- Use `.env` file (copy from `example.env`)
- All config accessed via functions in `src/config/config.ts`
- Never use `process.env` directly in services or DB modules

**Real-time Updates**:
- `socketService.ts` provides Socket.IO integration
- Used by API server to notify clients of content updates

**Deployment Target**:
- Optimized for Raspberry Pi 5 production environment
- Memory-efficient caching and connection pooling
- Log rotation prevents disk space issues
