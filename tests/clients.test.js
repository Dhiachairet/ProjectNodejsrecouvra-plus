import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/server.js';
import { User } from '../src/models/User.js';
import { Client } from '../src/models/Client.js';

let mongoServer;
let token;
let userId;

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

  // Create a user and get token
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
});

describe('Client Endpoints', () => {
  describe('POST /api/clients', () => {
    it('should create a new client', async () => {
      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Client',
          email: 'client@example.com',
          phone: '0123456789',
          company: 'Test Corp',
          address: {
            street: '123 Test St',
            city: 'Paris',
            postalCode: '75001',
            country: 'France'
          }
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.client.name).toBe('Test Client');
      expect(res.body.client.email).toBe('client@example.com');
      expect(res.body.client.createdBy).toBe(userId);
    });

    it('should return 400 if validation fails', async () => {
      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Client'
          // Missing required fields
        });
      
      expect(res.statusCode).toBe(400);
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/api/clients')
        .send({
          name: 'Test Client',
          email: 'client@example.com',
          phone: '0123456789'
        });
      
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/clients', () => {
    beforeEach(async () => {
      // Create test clients
      await Client.create([
        {
          name: 'Client A',
          email: 'a@example.com',
          phone: '1111111111',
          createdBy: userId
        },
        {
          name: 'Client B',
          email: 'b@example.com',
          phone: '2222222222',
          createdBy: userId
        }
      ]);
    });

    it('should get all clients', async () => {
      const res = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.clients).toHaveLength(2);
    });

    it('should search clients', async () => {
      const res = await request(app)
        .get('/api/clients?search=Client A')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.clients[0].name).toBe('Client A');
    });
  });
});