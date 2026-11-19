// Loaded by Jest (setupFiles) in every test file, before any test code imports the app.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-never-used-outside-jest';
process.env.JWT_EXPIRE = '1h';
// Minimum bcrypt cost: hashing passwords is the slowest part of creating test users
process.env.BCRYPT_ROUNDS = '4';
// Many tests log in through the API; the login rate limiter is exercised explicitly in tests/security/rate-limit.test.js
process.env.RATE_LIMIT_DISABLED = 'true';
