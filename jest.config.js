const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
};
