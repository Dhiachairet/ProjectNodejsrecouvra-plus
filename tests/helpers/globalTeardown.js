// Runs once after all test files: stops the in-memory replica set started in globalSetup.
export default async function globalTeardown() {
  await globalThis.__MONGO_REPLSET__?.stop();
}
