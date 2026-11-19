// Reliability scenario: overdue status must be accurate based on time, without needing a re-save.
// Target: Bug C.
import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { Invoice } from '../../src/models/Invoice.js';
import { useTestDB } from '../helpers/db.js';
import { authHeader, createUserWithToken } from '../helpers/auth.js';
import { createClient, createInvoice } from '../helpers/factories.js';

useTestDB();

describe('Reliability: Overdue status computed at read time (BR-07)', () => {
  it('lists an invoice as overdue if its due date passed, without saving it again', async () => {
    const { user: manager, token } = await createUserWithToken('manager');
    const client = await createClient(manager);
    
    // Create an invoice due in the future (so it bypasses Joi validation)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    const invoice = await createInvoice(client, manager, { dueDate: futureDate, status: 'unpaid' });

    // Now, "simulate" time passing by updating the dueDate directly in the DB to yesterday.
    // We use updateOne (not save) specifically to bypass the pre-save hook,
    // simulating an invoice that has just been sitting in the database.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await Invoice.updateOne({ _id: invoice._id }, { dueDate: yesterday, status: 'unpaid' });

    // Fetch the list via the API
    const res = await request(app)
      .get('/api/invoices')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    const listedInvoice = res.body.invoices.find(i => i._id === invoice._id.toString());
    
    // BUG C: The API will return "unpaid" because the database still says "unpaid".
    // It SHOULD dynamically return "overdue" based on the past dueDate.
    expect(listedInvoice.status).toBe('overdue'); 
  });
});