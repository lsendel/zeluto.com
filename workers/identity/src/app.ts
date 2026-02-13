import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './infrastructure/database.js';
import authRoutes from './interface/auth-routes.js';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => origin, // Allow all origins in development; restrict in production
    credentials: true,
  })
);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'identity' });
});

// Mount auth routes
app.route('/', authRoutes);

export default app;
