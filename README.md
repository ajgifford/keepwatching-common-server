# KeepWatching Common Server

A comprehensive TypeScript library providing shared services, utilities, and middleware for the KeepWatching platform. This package includes database operations, API integrations, caching, validation, and more.

## 🚀 Features

- **Database Operations**: MySQL connection pooling, transaction helpers, and repository patterns
- **API Integrations**: TMDB and Streaming Availability API clients with retry logic
- **Caching**: Redis-like in-memory caching with TTL and pattern invalidation
- **Validation**: Zod schema validation middleware for Express
- **Error Handling**: Comprehensive error middleware with custom error types
- **Logging**: Winston-based structured logging with rotation
- **Real-time Updates**: Socket.IO service for live notifications
- **Background Jobs**: Cron-based scheduled content updates
- **Testing Utilities**: Mock factories and test helpers

## 📦 Installation

```bash
yarn add @ajgifford/keepwatching-common-server
```

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+
- TypeScript 5+
- MySQL 8+
- Yarn package manager

### Environment Configuration

Create a `.env` file based on `example.env`:

```bash
cp example.env .env
```

Key environment variables:
- `MYSQL_*`: Database connection settings
- `TMDB_TOKEN`: The Movie Database API token
- `STREAMING_API_KEY`: Streaming Availability API key
- `SERVICE_ACCOUNT_PATH`: Firebase service account path

### Installation

```bash
# Install dependencies
yarn install

# Build the project
yarn build

# Run tests
yarn test

# Run with coverage
yarn test:coverage
```

## 🏗️ Project Structure

```
src/
├── config/           # Configuration management
├── constants/        # Application constants and cache keys
├── db/              # Database repositories and operations
├── logger/          # Winston logging setup and utilities
├── middleware/      # Express middleware (validation, error handling)
├── schema/          # Zod validation schemas
├── services/        # Business logic services
├── testing/         # Mock factories and test utilities
├── types/           # TypeScript type definitions
└── utils/           # Utility functions and helpers
```

## 📚 Usage Examples

### Basic Service Usage

```typescript
import { 
  accountService, 
  showService, 
  validateSchema,
  errorHandler 
} from '@ajgifford/keepwatching-common-server';

// Use validation middleware
app.post('/api/accounts', 
  validateSchema(registerAccountBodySchema),
  async (req, res, next) => {
    try {
      const account = await accountService.register(
        req.body.name,
        req.body.email,
        req.body.uid
      );
      res.json(account);
    } catch (error) {
      next(error);
    }
  }
);

// Error handling
app.use(errorHandler);
```

### Database Operations

```typescript
import { getDbPool, TransactionHelper } from '@ajgifford/keepwatching-common-server';

// Simple query
const pool = getDbPool();
const [rows] = await pool.execute('SELECT * FROM shows WHERE id = ?', [showId]);

// Transaction example
const helper = new TransactionHelper();
await helper.executeInTransaction(async (connection) => {
  await connection.execute('INSERT INTO shows (...) VALUES (...)', values);
  await connection.execute('INSERT INTO seasons (...) VALUES (...)', seasonValues);
});
```

### Caching

```typescript
import { CacheService } from '@ajgifford/keepwatching-common-server';

const cache = CacheService.getInstance();

// Cache with TTL
const data = await cache.getOrSet(
  'key',
  async () => expensiveOperation(),
  3600 // 1 hour TTL
);

// Pattern invalidation
cache.invalidatePattern('user_*');
```

### Validation Schemas

```typescript
import { validateSchema } from '@ajgifford/keepwatching-common-server/middleware';
import { showWatchStatusBodySchema } from '@ajgifford/keepwatching-common-server/schema';

app.put('/shows/:id/status',
  validateSchema(showWatchStatusBodySchema),
  handler
);
```

## 🔧 Available Services

### Core Services
- `accountService` - User account management
- `profileService` - User profile operations  
- `showService` - TV show management and tracking
- `moviesService` - Movie management and tracking
- `episodesService` - Episode tracking and progress
- `seasonsService` - Season management

### Admin Services
- `adminShowService` - Administrative show operations
- `adminMovieService` - Administrative movie operations
- `statisticsService` - Usage analytics and statistics

### Utility Services
- `contentDiscoveryService` - Content search and discovery
- `notificationsService` - User notifications
- `socketService` - Real-time WebSocket communication
- `scheduledUpdatesService` - Background content updates

## 🗄️ Database Integration

The library uses MySQL with connection pooling and supports:
- **Connection Management**: Automatic pool management with graceful shutdown
- **Transactions**: Helper class for safe transaction handling
- **Error Handling**: Consistent database error handling across repositories
- **Migration Support**: Scripts for database schema updates

### Connection Setup

```typescript
import { DatabaseService } from '@ajgifford/keepwatching-common-server';

const dbService = DatabaseService.getInstance();
const pool = dbService.getPool();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await dbService.shutdown();
});
```

## 🔍 Testing

### Using Test Utilities

```typescript
import { 
  accountService,
  CacheService,
  databaseService 
} from '@ajgifford/keepwatching-common-server/testing';

// Mock services are automatically configured
const mockAccount = { id: 1, name: 'Test User' };
accountService.findAccountById.mockResolvedValue(mockAccount);

// Set up mock database data
databaseService.setupMockData({
  accounts: [mockAccount],
  profiles: [{ id: 1, account_id: 1, name: 'Profile 1' }]
});
```

### Running Tests

```bash
# Run all tests
yarn test

# Run with coverage
yarn test:coverage

# Run specific test file
yarn test src/services/accountService.test.ts

# Watch mode
yarn test --watch
```

## 🚀 Deployment

### Production Build

```bash
# Build for production
yarn build

# Version and publish
yarn version:patch  # or minor/major
npm publish
```

### Raspberry Pi Deployment

The library is optimized for deployment on Raspberry Pi 5:

1. **Memory Management**: Efficient caching with configurable limits
2. **Database Pooling**: Optimized connection limits for ARM hardware  
3. **Logging**: File rotation to prevent disk space issues
4. **Process Management**: Graceful shutdown handling

## 📋 Scripts

| Script | Description |
|--------|-------------|
| `yarn build` | Compile TypeScript to JavaScript |
| `yarn test` | Run Jest test suite |
| `yarn test:coverage` | Run tests with coverage report |
| `yarn lint` | Run ESLint |
| `yarn format` | Format code with Prettier |
| `yarn version:patch` | Bump patch version |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Write tests for your changes
4. Ensure all tests pass: `yarn test`
5. Follow the existing code style: `yarn lint && yarn format`
6. Commit your changes: `git commit -am 'Add new feature'`
7. Push to the branch: `git push origin feature/new-feature`
8. Submit a pull request

### Code Style

- **TypeScript**: Strict mode enabled with comprehensive type checking
- **ESLint**: Extended configuration with React and Jest support
- **Prettier**: Consistent code formatting with import sorting
- **Testing**: Jest with comprehensive coverage requirements

## 📄 License

ISC License - see LICENSE file for details.

## 🔗 Related Packages

- [`@ajgifford/keepwatching-types`](https://github.com/ajgifford/keepwatching-types) - Shared TypeScript types
- Main KeepWatching API server (private repository)
- KeepWatching React web application (private repository)

## 📞 Support

For issues and questions:
- Create an issue in this repository
- Contact: Gifford Family Dev

---

**Note**: This is a private package published to GitHub Package Registry. Ensure proper authentication is configured for installation and publishing.