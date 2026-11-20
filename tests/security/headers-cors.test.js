// Security audit A05: Helmet headers and restricted CORS.
import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';

const ALLOWED = 'http://localhost:5173';

describe('HTTP security headers (Helmet)', () => {
  it.each(['/health', '/api/clients', '/api-docs/'])('are present on %s', async (url) => {
    const res = await request(app).get(url);

    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['referrer-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('keeps Swagger UI reachable', async () => {
    const res = await request(app).get('/api-docs/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});

describe('CORS', () => {
  it('allows the configured origin', async () => {
    const res = await request(app).get('/health').set('Origin', ALLOWED);

    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it.each(['https://evil.example.com', 'null', 'http://localhost:5173.evil.com'])('does not allow the origin %s', async (origin) => {
    const res = await request(app).get('/health').set('Origin', origin);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('never answers with a wildcard origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example.com');

    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('answers the preflight of an authenticated request from the allowed origin', async () => {
    const res = await request(app)
      .options('/api/clients')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
    expect(res.headers['access-control-allow-methods']).toMatch(/POST/);
  });

  it('gives no CORS permission on the preflight of a foreign origin', async () => {
    const res = await request(app)
      .options('/api/clients')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
