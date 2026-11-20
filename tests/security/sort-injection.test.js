// Security audit A03: ?sortBy= must be whitelisted before reaching MongoDB.
import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { useTestDB } from '../helpers/db.js';
import { authHeader } from '../helpers/auth.js';
import { createPortfolio } from '../helpers/portfolios.js';

useTestDB();

const LISTS = ['/api/clients', '/api/invoices', '/api/collections'];

describe('sortBy / order whitelist', () => {
  describe.each(LISTS)('GET %s', (url) => {
    it.each(['$where', '__proto__', 'constructor', 'password', 'unknownField', '$natural'])('rejects sortBy=%s with a 400', async (value) => {
      const { token } = await createPortfolio();

      const res = await request(app).get(url).query({ sortBy: value }).set(authHeader(token));

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid sortBy/);
      expect(JSON.stringify(res.body)).not.toMatch(/stack|MongoServerError/i);
    });

    it('rejects an operator object passed as sortBy[$ne]=x', async () => {
      const { token } = await createPortfolio();

      const res = await request(app).get(`${url}?sortBy[$ne]=x`).set(authHeader(token));

      expect(res.status).toBe(400);
    });

    it('rejects a repeated sortBy parameter', async () => {
      const { token } = await createPortfolio();

      const res = await request(app).get(`${url}?sortBy=createdAt&sortBy=$where`).set(authHeader(token));

      expect(res.status).toBe(400);
    });

    it('rejects an invalid order', async () => {
      const { token } = await createPortfolio();

      const res = await request(app).get(url).query({ order: 'sideways' }).set(authHeader(token));

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid order/);
    });

    it('works without any sort parameter', async () => {
      const { token } = await createPortfolio();

      const res = await request(app).get(url).set(authHeader(token));

      expect(res.status).toBe(200);
    });

    it.each(['asc', 'desc'])('accepts order=%s', async (order) => {
      const { token } = await createPortfolio();

      const res = await request(app).get(url).query({ order }).set(authHeader(token));

      expect(res.status).toBe(200);
    });
  });

  it.each([['name'], ['createdAt']])('GET /api/clients accepts sortBy=%s', async (sortBy) => {
    const { token } = await createPortfolio();

    const res = await request(app).get('/api/clients').query({ sortBy, order: 'desc' }).set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.clients).toHaveLength(1);
  });

  it('GET /api/invoices accepts sortBy=amount and GET /api/collections sortBy=actionDate', async () => {
    const { token } = await createPortfolio();

    const invoices = await request(app).get('/api/invoices').query({ sortBy: 'amount' }).set(authHeader(token));
    const actions = await request(app).get('/api/collections').query({ sortBy: 'actionDate' }).set(authHeader(token));

    expect(invoices.status).toBe(200);
    expect(actions.status).toBe(200);
  });
});
