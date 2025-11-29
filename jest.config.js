/** @type {import('jest').Config} */
export default {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest/presets/default-esm',

  // Test environment
  testEnvironment: 'node',

  // ESM support
  extensionsToTreatAsEsm: ['.ts'],

  // Module name mapper for path aliases (matching tsconfig.json paths)
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@context/(.*)$': '<rootDir>/src/context/$1',
    '^@db/(.*)$': '<rootDir>/src/db/$1',
    '^@logger/(.*)$': '<rootDir>/src/logger/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@schema/(.*)$': '<rootDir>/src/schema/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
  },

  // Transform configuration for ts-jest with ESM
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'esnext',
          moduleResolution: 'bundler',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
    '^.+\\.js$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          allowJs: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },

  // Test match patterns
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.spec.ts'],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Coverage configuration
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/testing/**/*', '!dist/**', '!tests/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coverageProvider: 'v8',

  // Mock settings
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Test timeout
  testTimeout: 10000,

  // Module file extensions
  moduleFileExtensions: ['ts', 'js', 'json'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/tests/unit/db/watchStatus/helpers/',
    '/tests/unit/services/adminShowService/helpers/',
    '/tests/unit/services/emailService/helpers/',
    '/tests/unit/services/showService/helpers/',
  ],

  // Transform ESM modules from @ajgifford scope and uuid (ESM-only in v13+)
  transformIgnorePatterns: ['node_modules/(?!(@ajgifford|uuid)/)'],
};
