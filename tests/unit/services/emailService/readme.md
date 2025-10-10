# EmailService Tests

This directory contains tests for the EmailService, split into logical groups for maintainability.

## Structure

- `helpers/` - Shared test utilities and fixtures
  - `mocks.ts` - Mock setup functions and cleanup utilities
  - `fixtures.ts` - Reusable test data and mock objects
- `basic.test.ts` - Core functionality tests (constructor, verifyConnection)
- `batch.test.ts` - Batch email sending tests (sendWeeklyDigests)
- `digest.test.ts` - Digest email sending tests (sendDigestEmailToAccount)
- `discovery.test.ts` - Discovery email sending tests (sendDiscoveryEmailToAccount)
- `weekly.test.ts` - Weekly email operations (sendWeeklyEmailToAccount, preview)
- `templates.test.ts` - Email template CRUD operations
- `management.test.ts` - Email management (getAllEmails, deleteEmail)
- `scheduling.test.ts` - Email scheduling operations (schedule, cancel, getActiveJobs)
- `delivery.test.ts` - Email delivery operations (sendImmediately, saveRecipients)
- `orchestration.test.ts` - Main orchestration logic (sendScheduleOrSaveEmail)

## Running Tests

Run all EmailService tests:
```bash
yarn test services/emailService
```

Run a specific test file:
```bash
yarn test tests/unit/services/emailService/basic.test.ts
```

Run a specific test suite:
```bash
yarn test tests/unit/services/emailService/digest.test.ts
```

## Test Organization

Each test file focuses on a specific domain of functionality:

- **Basic**: Core service initialization and connection verification
- **Batch**: Weekly digest batch processing for multiple accounts
- **Digest**: Individual digest email generation and sending
- **Discovery**: Individual discovery email generation and sending
- **Weekly**: Combined weekly email logic that routes to digest or discovery
- **Templates**: CRUD operations for email templates
- **Management**: Retrieving and deleting emails with pagination
- **Scheduling**: Scheduling emails for future delivery and job management
- **Delivery**: Immediate email sending and recipient management
- **Orchestration**: High-level orchestration that coordinates sending, scheduling, or saving

## Shared Utilities

### Mocks (`helpers/mocks.ts`)

- `setupMocks()` - Sets up common mocks with default behaviors
- `setupEmailDbMocks()` - Sets up default mock implementations for emailDb functions
- `cleanupScheduledJobs()` - Cleans up any scheduled jobs after tests

### Fixtures (`helpers/fixtures.ts`)

- `mockDigestData` - Sample digest email data
- `mockDiscoveryData` - Sample discovery email data
- `mockDigestContentResult` - Sample email content result
- `mockEmailTemplates` - Sample email templates
- `mockSentEmails` - Sample sent emails
- `mockEmailRecipients` - Sample email recipients
- `mockBatchEmailContent` - Sample batch email content

## Best Practices

1. Always use `setupMocks()` in `beforeEach()` to ensure clean test state
2. Always clean up scheduled jobs in `afterEach()` to prevent test pollution
3. Import shared fixtures from `helpers/fixtures.ts` to avoid duplication
4. Use `setupEmailDbMocks()` when tests require database operations
5. Follow the existing test patterns for consistency
