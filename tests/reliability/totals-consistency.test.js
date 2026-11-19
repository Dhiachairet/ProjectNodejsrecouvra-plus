// Reliability scenario: client totals must stay consistent after cancellation.
// This test targets Bug A: updateInvoice uses findByIdAndUpdate, bypassing post('save').
import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { Client } from '../../src/models/Client.js';
import { useTestDB } from '../helpers/db.js';
import { authHeader, createUserWithToken } from '../helpers/auth.js';
import { createClient, createInvoice } from '../helpers/factories.js';

useTestDB();

describe('Reliability: Client totals on invoice cancellation (BR-07 side effect)', () => {
  it('reduces Client.totalUnpaid when an invoice is cancelled via the API', async () => {
    const { user: manager, token } = await createUserWithToken('manager');
    const client = await createClient(manager);
    
    // Create a 1000 unpaid invoice (via factory, which triggers post-save)
    const invoice = await createInvoice(client, manager, { amount: 1000 });
    
    // Verify initial client state
    const before = await Client.findById(client._id);
    expect(before.totalUnpaid).toBe(1000);
    expect(before.totalInvoices).toBe(1);

    // Cancel the invoice via the real API
    const res = await request(app)
      .put(`/api/invoices/${invoice._id}`)
      .set(authHeader(token))
      .send({ status: 'cancelled', cancelledReason: 'Issued by mistake' });

    expect(res.status).toBe(200);
    expect(res.body.invoice.status).toBe('cancelled');

    // BUG A: The client totals should be recomputed (cancelled invoice shouldn't count as unpaid)
    const after = await Client.findById(client._id);
    
    // This will fail because updateInvoice bypasses the post('save') hook.
    expect(after.totalUnpaid).toBe(0); 
  });
});