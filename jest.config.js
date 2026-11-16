// Jest runs the project's native ES modules (package.json "type": "module"),
// so there is no Babel transform. npm test passes --experimental-vm-modules for that.
export default {
  testEnvironment: 'node',
  transform: {},
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],

  // Env vars for every test file, set before the app is imported
  setupFiles: ['<rootDir>/tests/helpers/env.js'],

  // One in-memory MongoDB replica set for the whole run (replica set = transactions available)
  globalSetup: '<rootDir>/tests/helpers/globalSetup.js',
  globalTeardown: '<rootDir>/tests/helpers/globalTeardown.js',

  testTimeout: 30000,

  // v8 coverage works with native ES modules; lcov is read by SonarQube, html is the evidence report
  coverageProvider: 'v8',
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.js',
    // Process bootstrap only (connect + listen), exercised by the Docker smoke test rather than by Jest
    '!src/server.js',
    '!src/config/db.js'
  ]
};
