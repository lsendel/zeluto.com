import { Hono } from 'hono';
import type { Env } from '../app.js';

export const enrichmentRoutes = new Hono<Env>();
