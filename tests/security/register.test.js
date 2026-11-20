// Security audit 3.3 (D): privilege escalation through POST /api/auth/register.
// Policy: a public sign-up always creates an agent, whatever "role" the body contains. Only an authenticated admin
// may choose another role (the admin "New user" form uses this same endpoint).
import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { useTestDB } from '../helpers/db.js';
import { authHeader, createUserWithToken, TEST_PASSWORD } from '../helpers/auth.js';

useTestDB();

let sequence = 0;
const newAccount = (overrides = {}) => {
  sequence += 1;
  return {
    email: `newcomer${sequence}@example.com`,
    password: TEST_PASSWORD,
    firstName: 'New',
    lastName: 'Comer',
    ...overrides
  };
};

const register = (body, token) => {
  const req = request(app).post('/api/auth/register');
  return token ? req.set(authHeader(token)).send(body) : req.send(body);
};

describe('POST /api/auth/register', () => {
  describe('public sign-up', () => {
    it('creates an agent when no role is given', async () => {
      const body = newAccount();

      const res = await register(body);

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('agent');
      expect(res.body.user.password).toBeUndefined();
      expect((await User.findOne({ email: body.email })).role).toBe('agent');
    });

    it('ignores the admin role and creates an agent', async () => {
      const body = newAccount({ role: 'admin' });

      const res = await register(body);

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('agent');
      expect((await User.findOne({ email: body.email })).role).toBe('agent');
      expect(await User.countDocuments({ role: 'admin' })).toBe(0);
    });

    it('ignores the manager role and creates an agent', async () => {
      const body = newAccount({ role: 'manager' });

      const res = await register(body);

      expect(res.status).toBe(201);
      expect((await User.findOne({ email: body.email })).role).toBe('agent');
    });

    it('accepts an explicit agent role', async () => {
      const res = await register(newAccount({ role: 'agent' }));

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('agent');
    });

    it('rejects an unknown role', async () => {
      const body = newAccount({ role: 'superuser' });

      const res = await register(body);

      expect(res.status).toBe(400);
      expect(await User.findOne({ email: body.email })).toBeNull();
    });

    it('rejects other sensitive properties instead of assigning them', async () => {
      const body = newAccount({ active: false, _id: '64b7f0f0f0f0f0f0f0f0f0f0', isAdmin: true });

      const res = await register(body);

      expect(res.status).toBe(400);
      expect(await User.findOne({ email: body.email })).toBeNull();
    });

    it('gives a token that cannot reach admin-only routes after an escalation attempt', async () => {
      const attempt = await register(newAccount({ role: 'admin' }));
      expect(attempt.status).toBe(201);

      const res = await request(app).get('/api/audit').set(authHeader(attempt.body.token));

      expect(res.status).toBe(403);
    });
  });

  describe('sign-up by a logged-in user', () => {
    it.each(['agent', 'manager'])('does not let a %s create an admin: an agent is created', async (role) => {
      const { token } = await createUserWithToken(role);
      const body = newAccount({ role: 'admin' });

      const res = await register(body, token);

      expect(res.status).toBe(201);
      expect((await User.findOne({ email: body.email })).role).toBe('agent');
    });

    it('does not let an agent create a manager: an agent is created', async () => {
      const { token } = await createUserWithToken('agent');
      const body = newAccount({ role: 'manager' });

      const res = await register(body, token);

      expect(res.status).toBe(201);
      expect((await User.findOne({ email: body.email })).role).toBe('agent');
    });

    it('lets an admin create a user with another role (admin "New user" form)', async () => {
      const { token } = await createUserWithToken('admin');

      const res = await register(newAccount({ role: 'manager' }), token);

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('manager');
    });

    it('rejects an invalid token instead of falling back to a public sign-up', async () => {
      const body = newAccount({ role: 'admin' });

      const res = await register(body, 'not-a-jwt');

      expect(res.status).toBe(401);
      expect(await User.findOne({ email: body.email })).toBeNull();
    });
  });
});
