/** @type {import('jest').Config} */
const config = {
  // The test environment that will be used for testing
  testEnvironment: 'node',

  // A list of paths to directories that Jest should use to search for files in
  roots: ['<rootDir>/src'],

  // The glob patterns Jest uses to detect test files
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],

  // An array of regexp pattern strings that are matched against all test paths
  // We ignore frontend tests for now to keep them separate
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/frontend/'
  ],

  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',

  // A list of glob patterns indicating a set of files for which coverage information should be collected
  collectCoverageFrom: [
    'src/adapters/**/*.js',
    '!src/adapters/index.js',
    '!src/adapters/BaseAdapter.js',
    '!src/adapters/ScraperManager.js'
  ],

  // Display a detailed report of the results of the tests
  verbose: true,
};

module.exports = config;
