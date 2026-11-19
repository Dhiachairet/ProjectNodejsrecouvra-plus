// Reliability scenario: two simultaneous status changes on an action must not both succeed.
// Rule references: BR-19.
import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { useTestDB } from '../helpers/db.js';
import { authHeader, createUserWithToken } from '../helpers/auth.js';
import { createClient, createInvoice, createCollectionAction } from '../helpers/factories.js';

useTestDB();

describe('Reliability: Concurrent collection action status changes (BR-19)', () => {
  it('allows only one simultaneous status change to succeed', async () => {
    const { user: manager, token } = await createUserWithToken('manager');
    const client = await createClient(manager);
    const invoice = await createInvoice(client, manager);
    
    // Create an action in the 'planned' state
    const action = await createCollectionAction(invoice, manager, { status: 'planned' });

    const changeStatus = (status) => request(app)
      .patch(`/api/collections/${action._id}/status`)
      .set(authHeader(token))
      .send({ status, result: 'Handled' }); // result is required for completed/failed

    // Fire two different transitions at the exact same time
    const [res1, res2] = await Promise.all([
      changeStatus('completed'),
      changeStatus('failed')
    ]);

    const statuses = [res1.status, res2.status].sort();
    
    // One succeeds (200), one fails (409 Conflict) because the status already changed
    expect(statuses).toEqual([200, 409]);
  });
});