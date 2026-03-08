import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/server.js';
import { User } from '../src/models/User.js';
import { Client } from '../src/models/Client.js';
import { Invoice } from '../src/models/Invoice.js';

let mongoServer;
let token;
let userId;
let clientId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Client.deleteMany({});
  await Invoice.deleteMany({});

  // Create user
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      role: 'admin'
    });
  
  token = registerRes.body.token;
  userId = registerRes.body.user._id;

  // Create client
  const clientRes = await request(app)
    .post('/api/clients')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Test Client',
      email: 'client@example.com',
      phone: '0123456789'
    });
  
  clientId = clientRes.body.client._id;
});

describe('Invoice Endpoints', () => {
  describe('POST /api/invoices', () => {
    it('should create a new invoice', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({
          invoiceNumber: 'INV-2024-001',
          client: clientId,
          amount: 1000,
          dueDate: dueDate.toISOString(),
          description: 'Test invoice',
          items: [
            {
              description: 'Service',
              quantity: 1,
              unitPrice: 1000,
              amount: 1000
            }
          ]
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.invoice.invoiceNumber).toBe('INV-2024-001');
      expect(res.body.invoice.status).toBe('unpaid');
    });

    it('should return 400 if invoice number already exists', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      // Create first invoice
      await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({
          invoiceNumber: 'INV-2024-001',
          client: clientId,
          amount: 1000,
          dueDate: dueDate.toISOString()
        });

      // Try to create duplicate
      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({
          invoiceNumber: 'INV-2024-001',
          client: clientId,
          amount: 1000,
          dueDate: dueDate.toISOString()
        });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Invoice number already exists');
    });
  });

  describe('POST /api/invoices/:id/payments', () => {
    let invoiceId;

    beforeEach(async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const invoiceRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({
          invoiceNumber: 'INV-2024-001',
          client: clientId,
          amount: 1000,
          dueDate: dueDate.toISOString()
        });
      
      invoiceId = invoiceRes.body.invoice._id;
    });

    it('should add a payment to an invoice', async () => {
      const res = await request(app)
        .post(`/api/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 500,
          paymentMethod: 'bank_transfer',
          reference: 'TR123456'
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.invoice.paidAmount).toBe(500);
      expect(res.body.invoice.status).toBe('partially_paid');
    });

    it('should complete payment when full amount is paid', async () => {
      const res = await request(app)
        .post(`/api/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 1000,
          paymentMethod: 'bank_transfer'
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.invoice.paidAmount).toBe(1000);
      expect(res.body.invoice.status).toBe('paid');
    });

    it('should return 400 if payment exceeds remaining amount', async () => {
      const res = await request(app)
        .post(`/api/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 1500,
          paymentMethod: 'bank_transfer'
        });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('exceeds remaining balance');
    });
  });
});