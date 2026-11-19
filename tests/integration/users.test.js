// Integration tests: user management rules.
// Rule references: BR-11.
import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { useTestDB } from '../helpers/db.js';
import { authHeader, createUserWithToken } from '../helpers/auth.js';

useTestDB();

describe('DELETE /api/users/:id (BR-11)', () => {
  it('BR-11: prevents a user from deleting their own account', async () => {
    const { user: admin, token } = await createUserWithToken('admin');

    const res = await request(app)
      .delete(`/api/users/${admin._id}`)
      .set(authHeader(token));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot delete your own account/i);
  });

  it('BR-11: prevents deleting the last admin in the system', async () => {
    const { user: admin1, token } = await createUserWithToken('admin');
    const { user: admin2 } = await createUserWithToken('admin');

    // Delete the second admin (should succeed, there are still two)
    await request(app).delete(`/api/users/${admin2._id}`).set(authHeader(token)).expect(200);

    // Now try to delete the first admin (which is yourself, but let's try to have another admin do it)
    const { user: admin3, token: token3 } = await createUserWithToken('admin');
    // Now there are admin1 and admin3. Delete admin1 using admin3.
    await request(app).delete(`/api/users/${admin1._id}`).set(authHeader(token3)).expect(200);

    await User.deleteMany({});
    const { user: soleAdmin, token: soleToken } = await createUserWithToken('admin');
    
    const res = await request(app).delete(`/api/users/${soleAdmin._id}`).set(authHeader(soleToken));
    

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot delete your own account/i);
  });
});

describe('PUT /api/users/:id (BR-11)', () => {
  it('BR-11: prevents a user from changing their own role', async () => {
    const { user: admin, token } = await createUserWithToken('admin');

    const res = await request(app)
      .put(`/api/users/${admin._id}`)
      .set(authHeader(token))
      .send({ role: 'agent' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot change your own role/i);
  });

  it('BR-11: prevents a user from deactivating themselves', async () => {
    const { user: admin, token } = await createUserWithToken('admin');

    const res = await request(app)
      .put(`/api/users/${admin._id}`)
      .set(authHeader(token))
      .send({ active: false });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot deactivate your own account/i);
  });
});