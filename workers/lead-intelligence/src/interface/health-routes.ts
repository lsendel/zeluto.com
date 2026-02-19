import { Hono } from 'hono';
import type { Env } from '../app.js';

export const healthRoutes = new Hono<Env>();
