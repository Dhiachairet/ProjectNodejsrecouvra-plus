// Security audit A07: password policy (min 10 characters, uppercase, digit, special character).
import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { useTestDB } from '../helpers/db.js';

useTestDB();

let sequence = 0;
const signUp = (password) => {
  sequence += 1;
  return request(app).post('/api/auth/register').send({
    email: `pwd${sequence}@example.com`,
    password,
    firstName: 'Pass',
    lastName: 'Word'
  });
};

describe('password policy on POST /api/auth/register', () => {
  it.each([
    ['too short (6 characters)', 'Ab1!xy', /at least 10 characters/],
    ['9 characters', 'Abcdef1!x', /at least 10 characters/],
    ['no uppercase letter', 'abcdefgh1!', /uppercase/],
    ['no digit', 'Abcdefghi!', /digit/],
    ['no special character', 'Abcdefghi1', /special/],
    ['too long', `Aa1!${'x'.repeat(130)}`, /at most 128/]
  ])('rejects a password that is %s', async (_label, password, message) => {
    const res = await signUp(password);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
    expect(JSON.stringify(res.body)).not.toContain(password);
    expect(await User.countDocuments()).toBe(0);
  });

  it('rejects a missing password', async () => {
    const res = await signUp(undefined);

    expect(res.status).toBe(400);
  });

  it.each(['Abcdefgh1!', 'Password123!', 'Str0ng_Passw0rd#2024'])('accepts the strong password %s', async (password) => {
    const res = await signUp(password);

    expect(res.status).toBe(201);
    const stored = await User.findOne({ email: res.body.user.email }).select('+password');
    expect(stored.password).not.toBe(password);
    expect(await stored.comparePassword(password)).toBe(true);
  });
});
