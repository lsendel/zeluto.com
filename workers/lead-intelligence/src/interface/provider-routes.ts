import { Hono } from 'hono';
import type { Env } from '../app.js';

export const providerRoutes = new Hono<Env>();
