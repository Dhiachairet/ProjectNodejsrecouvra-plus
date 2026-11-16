import request from 'supertest';
import app from '../../src/app.js';
import { User } from '../../src/models/User.js';

export const TEST_PASSWORD = 'Password123!';

let sequence = 0;

// Creates a user directly in the database, with a unique email on every call.
export function createUser(role = 'agent', overrides = {}) {
  sequence += 1;
  return User.create({
    email: `${role}${sequence}@example.com`,
    password: TEST_PASSWORD,
    firstName: 'Test',
    lastName: `${role} ${sequence}`,
    role,
    ...overrides
  });
}

// Logs in through the real POST /api/auth/login and returns the JWT.
// Throws for a deactivated user: to test one, get the token first, then deactivate the account.
export async function loginAs(user, password = TEST_PASSWORD) {
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${user.email}: ${res.status} ${res.body.error}`);
  }
  return res.body.token;
}

export async function createUserWithToken(role = 'agent', overrides = {}) {
  const user = await createUser(role, overrides);
  return { user, token: await loginAs(user, overrides.password) };
}

// { admin, manager, agent }, each one { user, token }
export async function createUsersForAllRoles() {
  const [admin, manager, agent] = await Promise.all(
    ['admin', 'manager', 'agent'].map(role => createUserWithToken(role))
  );
  return { admin, manager, agent };
}

// For supertest: request(app).get('/api/clients').set(authHeader(token))
export const authHeader = (token) => ({ Authorization: `Bearer ${token}` });
