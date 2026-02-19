import { Hono } from 'hono';
import type { Env } from '../app.js';

export const waterfallRoutes = new Hono<Env>();
