// Security audit A07: brute-force protection on POST /api/auth/login (10 attempts / 15 minutes).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { loginLimiter } from '../../src/middleware/rateLimit.js';
import { createUser, TEST_PASSWORD } from '../helpers/auth.js';
import { useTestDB } from '../helpers/db.js';

useTestDB();

const original = { disabled: process.env.RATE_LIMIT_DISABLED, nodeEnv: process.env.NODE_ENV };
const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

// The limiter keeps its counters in memory, shared by the whole file: forget the supertest client IP between tests.
beforeEach(async () => {
  await Promise.all(['::ffff:127.0.0.1', '127.0.0.1', '::1'].map(ip => loginLimiter.resetKey(ip)));
});

beforeAll(() => {
  delete process.env.RATE_LIMIT_DISABLED;
});

afterAll(() => {
  process.env.RATE_LIMIT_DISABLED = original.disabled;
  process.env.NODE_ENV = original.nodeEnv;
});

describe('login rate limiting', () => {
  it('answers 429 on the 11th attempt, even with the right password', async () => {
    const user = await createUser('agent');

    for (let i = 0; i < 10; i += 1) {
      expect((await login(user.email, 'wrong-password')).status).toBe(401);
    }
    const blocked = await login(user.email, TEST_PASSWORD);

    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
    expect(blocked.headers['ratelimit-limit']).toBe('10');
  });

  it('does not limit routes other than login', async () => {

    for (let i = 0; i < 12; i += 1) {
      expect((await request(app).get('/health')).status).toBe(200);
    }
  });

  it('stays active in production even if RATE_LIMIT_DISABLED=true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RATE_LIMIT_DISABLED = 'true';

    let last;
    for (let i = 0; i < 11; i += 1) last = await login('nobody@example.com', 'wrong-password');

    expect(last.status).toBe(429);
    process.env.NODE_ENV = original.nodeEnv;
    delete process.env.RATE_LIMIT_DISABLED;
  });

  it('can be disabled only in the test environment (k6 load tests)', async () => {
    process.env.NODE_ENV = 'test';
    process.env.RATE_LIMIT_DISABLED = 'true';

    let last;
    for (let i = 0; i < 12; i += 1) last = await login('nobody@example.com', 'wrong-password');

    expect(last.status).toBe(401);
    delete process.env.RATE_LIMIT_DISABLED;
  });
});
