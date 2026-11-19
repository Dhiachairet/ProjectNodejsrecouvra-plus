import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import clientRoutes from './routes/client.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import collectionRoutes from './routes/collection.routes.js';
import statsRoutes from './routes/stats.routes.js';
import auditRoutes from './routes/audit.routes.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendDist = path.join(rootDir, 'frontend', 'dist');

// The Express app without a DB connection or a listening port, so tests can import it directly.
const app = express();

// Behind a reverse proxy, set TRUST_PROXY (e.g. 1 = one proxy hop) so rate limiting sees the real client IP.
if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set('trust proxy', Number.isInteger(hops) ? hops : process.env.TRUST_PROXY);
}

app.use(helmet());

// CORS_ORIGIN: comma-separated list of allowed origins. Never '*': it is dropped from the list.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(origin => origin && origin !== '*');

app.use(cors({
  // Requests without an Origin header (same-origin, curl, k6) are not cross-origin browser requests
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));


app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});


app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/audit', auditRoutes);


app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(YAML.load(path.join(rootDir, 'swagger.yaml'))));


// Serves the React build (npm run frontend:build) so the whole app runs on one port.
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^\/(?!api\/|api-docs|health).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}


app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});


app.use(errorHandler);

export default app;
