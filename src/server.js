import 'dotenv/config';

import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 3000;


const startServer = async () => {
  try {

    await connectDB();


    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
    });


    process.on('unhandledRejection', (err) => {
      console.log(`Unhandled Rejection Error: ${err.message}`);
      server.close(() => process.exit(1));
    });


    process.on('uncaughtException', (err) => {
      console.log(`Uncaught Exception Error: ${err.message}`);
      process.exit(1);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
