import { MongoMemoryReplSet } from 'mongodb-memory-server';

// Runs once before all test files. A single-node replica set (not a plain server)
// so tests can use MongoDB transactions. wiredTiger is the engine that supports them.
export default async function globalSetup() {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });

  // Read back in globalTeardown
  globalThis.__MONGO_REPLSET__ = replSet;
  // Test workers start after this and inherit the variable
  process.env.MONGO_TEST_URI = replSet.getUri();
}
