import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from '@jest/globals';

// Each test file gets its own database on the shared in-memory server,
// so files running in parallel never see each other's data.
export async function connectTestDB() {
  await mongoose.connect(process.env.MONGO_TEST_URI, { dbName: `test-${randomUUID()}` });
  // Wait until every model's indexes exist, otherwise unique constraints are not enforced yet
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
}

export async function clearTestDB() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map(collection => collection.deleteMany({})));
}

export async function disconnectTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

// Call once at the top of a test file: fresh database per file, emptied after every test.
export function useTestDB() {
  beforeAll(connectTestDB);
  afterEach(clearTestDB);
  afterAll(disconnectTestDB);
}
