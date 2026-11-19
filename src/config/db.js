import mongoose from 'mongoose';

export async function connectDB() {
  try {
    // In cluster mode every worker has its own pool. The driver default (100 connections per worker)
    // times one worker per core can exceed what MongoDB accepts (1024 open files in the default Docker
    // image), which made the stress test fail with PoolClearedError at 200 users. 20 per worker is plenty.
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE, 10) || 20
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.log('MongoDB connection error:', err);
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});