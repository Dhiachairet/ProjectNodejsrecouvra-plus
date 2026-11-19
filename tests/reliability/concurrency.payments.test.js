// Reliability scenario: concurrent payments must not overpay an invoice.
// This test targets Bug B: addPayment uses read-modify-write, allowing race conditions.
import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { Invoice } from '../../src/models/Invoice.js';
import { useTestDB } from '../helpers/db.js';
import { authHeader, createUserWithToken } from '../helpers/auth.js';
import { createClient, createInvoice } from '../helpers/factories.js';

useTestDB();

describe('Reliability: Concurrent payments on a single invoice (BR-02)', () => {
  it('prevents overpayment when two identical payments are sent simultaneously', async () => {
    const { user: manager, token } = await createUserWithToken('manager');
    const client = await createClient(manager);
    
    // Invoice of 1000. We will send two payments of 600 at the same time.
    const invoice = await createInvoice(client, manager, { amount: 1000 });

    const payRequest = () => request(app)
      .post(`/api/invoices/${invoice._id}/payments`)
      .set(authHeader(token))
      .send({ amount: 600, paymentMethod: 'cash' });

    // Fire both requests at the exact same time
    const [res1, res2] = await Promise.all([payRequest(), payRequest()]);

    // Exactly one must succeed (201) and one must fail (400)
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 400]);

    // Verify the final state in the database
    const finalInvoice = await Invoice.findById(invoice._id);
    expect(finalInvoice.paidAmount).toBe(600); // Only one 600 payment went through
    expect(finalInvoice.payments).toHaveLength(1); 
  });
});