import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

import { connectDB } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import clientRoutes from './routes/client.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import collectionRoutes from './routes/collection.routes.js';
import statsRoutes from './routes/stats.routes.js';

// Load env vars
dotenv.config();

const app = express();

// Body parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Enable CORS
app.use(cors());

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true,
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/stats', statsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: `Cannot ${req.method} ${req.originalUrl}` 
  });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Connect to database first, then start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Start server
    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Now try to load Swagger (after server is running)
      try {
        import('swagger-ui-express').then(swaggerUi => {
          import('yamljs').then(YAML => {
            const swaggerDocument = YAML.load('./swagger.yaml');
            app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
            console.log(`📚 Swagger docs: http://localhost:${PORT}/api-docs`);
          }).catch(err => {
            console.log('⚠️ Swagger YAML load failed:', err.message);
          });
        }).catch(err => {
          console.log('⚠️ Swagger UI import failed:', err.message);
        });
      } catch (swaggerError) {
        console.log('⚠️ Swagger setup skipped:', swaggerError.message);
      }
      
      console.log(`✅ Auth routes: /api/auth/*`);
      console.log(`✅ User routes: /api/users/*`);
      console.log(`✅ Client routes: /api/clients/*`);
      console.log(`✅ Invoice routes: /api/invoices/*`);
      console.log(`✅ Collection routes: /api/collections/*`);
      console.log(`✅ Stats routes: /api/stats/*`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err, promise) => {
      console.log(`Unhandled Rejection Error: ${err.message}`);
      server.close(() => process.exit(1));
    });

    // Handle uncaught exceptions
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

export default app;