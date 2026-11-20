// Security audit 3.3 (A): every protected route must refuse a missing, malformed, expired, forged or revoked JWT with 401.
import { describe, expect, it } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { useTestDB } from '../helpers/db.js';
import { createUserWithToken } from '../helpers/auth.js';

useTestDB();

const PROTECTED_ROUTES = [
  ['get', '/api/auth/me'],
  ['get', '/api/users'],
  ['get', '/api/clients'],
  ['get', '/api/invoices'],
  ['get', '/api/collections'],
  ['get', '/api/stats'],
  ['get', '/api/audit']
];

const call = (method, url, authorization) => {
  const req = request(app)[method](url);
  return authorization === undefined ? req : req.set('Authorization', authorization);
};

describe('JWT authentication', () => {
  describe('request without a token', () => {
    it.each(PROTECTED_ROUTES)('%s %s answers 401', async (method, url) => {
      const res = await call(method, url);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('answers 401 when the Authorization header has no token after "Bearer"', async () => {
      const res = await call('get', '/api/auth/me', 'Bearer');

      expect(res.status).toBe(401);
    });

    it('answers 401 for a non-Bearer scheme', async () => {
      const { token } = await createUserWithToken('admin');

      const res = await call('get', '/api/users', `Basic ${token}`);

      expect(res.status).toBe(401);
    });
  });

  describe('malformed token', () => {
    it.each([
      ['random text', 'not-a-jwt'],
      ['two segments only', 'aaaa.bbbb'],
      ['garbage segments', 'aaaa.bbbb.cccc'],
      ['empty signature', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.']
    ])('rejects %s', async (label, token) => {
      const res = await call('get', '/api/auth/me', `Bearer ${token}`);

      expect(res.status).toBe(401);
    });

    it('rejects a token using the "none" algorithm', async () => {
      const { user } = await createUserWithToken('admin');
      const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ id: user.id })}.`;

      const res = await call('get', '/api/users', `Bearer ${unsigned}`);

      expect(res.status).toBe(401);
    });
  });

  describe('expired token', () => {
    it('rejects a token whose expiry date has passed', async () => {
      const { user } = await createUserWithToken('admin');
      const expired = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: -60 });

      const res = await call('get', '/api/users', `Bearer ${expired}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/expired/i);
    });
  });

  describe('token signed with another key', () => {
    it('rejects a token forged with a wrong secret, even for an existing admin', async () => {
      const { user } = await createUserWithToken('admin');
      const forged = jwt.sign({ id: user.id }, 'another-secret-used-only-in-this-test', { expiresIn: '1h' });

      const res = await call('get', '/api/users', `Bearer ${forged}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid token/i);
    });
  });

  describe('account no longer allowed to use its token', () => {
    it('rejects a valid token once the user has been deactivated', async () => {
      const { user, token } = await createUserWithToken('agent');
      expect((await call('get', '/api/auth/me', `Bearer ${token}`)).status).toBe(200);

      await User.updateOne({ _id: user._id }, { active: false });
      const res = await call('get', '/api/clients', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/deactivated/i);
    });

    it('rejects a valid token once the user has been deleted', async () => {
      const { user, token } = await createUserWithToken('agent');

      await User.deleteOne({ _id: user._id });
      const res = await call('get', '/api/auth/me', `Bearer ${token}`);

      expect(res.status).toBe(401);
    });
  });

  it('accepts a valid token (control case)', async () => {
    const { token } = await createUserWithToken('agent');

    const res = await call('get', '/api/auth/me', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});
