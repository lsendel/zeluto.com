import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createTransport, type Transporter } from 'nodemailer';
import pino from 'pino';
import { DnsVerifier } from './dns-verifier.js';
import { IpManager } from './ip-manager.js';

const logger = pino({ name: 'mail-api' });

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const POSTFIX_HOST = process.env.POSTFIX_HOST ?? 'localhost';
const POSTFIX_PORT = parseInt(process.env.POSTFIX_PORT ?? '587', 10);
const PORT = parseInt(process.env.PORT ?? '8090', 10);

// ---------------------------------------------------------------------------
// In-memory domain store (per-org)
// In production this would be backed by a database
// ---------------------------------------------------------------------------

interface SendingDomain {
  id: string;
  organizationId: string;
  domain: string;
  verified: boolean;
  mxVerified: boolean;
  spfVerified: boolean;
  dkimVerified: boolean;
  dmarcVerified: boolean;
  createdAt: string;
}

const domains: Map<string, SendingDomain> = new Map();

// ---------------------------------------------------------------------------
// Nodemailer transport (connection to local Postfix)
// ---------------------------------------------------------------------------

let transporter: Transporter;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = createTransport({
      host: POSTFIX_HOST,
      port: POSTFIX_PORT,
      secure: false,
      tls: { rejectUnauthorized: false },
    });
  }
  return transporter;
}

// ---------------------------------------------------------------------------
// DNS verifier and IP manager
// ---------------------------------------------------------------------------

const dnsVerifier = new DnsVerifier();
const ipManager = new IpManager();

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseUrl(req: IncomingMessage): { pathname: string; query: URLSearchParams } {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  return { pathname: url.pathname, query: url.searchParams };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleSend(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = JSON.parse(await readBody(req)) as {
      to: string;
      from: string;
      subject: string;
      html: string;
      text?: string;
      replyTo?: string;
      headers?: Record<string, string>;
      sourceIp?: string;
    };

    if (!body.to || !body.from || !body.subject) {
      json(res, 400, { error: 'Missing required fields: to, from, subject' });
      return;
    }

    // Select source IP if IP pool management is active
    const sourceIp = body.sourceIp ?? ipManager.getNextIp();

    const transport = getTransporter();
    const info = await transport.sendMail({
      from: body.from,
      to: body.to,
      subject: body.subject,
      html: body.html,
      text: body.text,
      replyTo: body.replyTo,
      headers: body.headers,
    });

    // Record send for IP warmup tracking
    if (sourceIp) {
      ipManager.recordSend(sourceIp, true);
    }

    logger.info({ messageId: info.messageId, to: body.to }, 'Email sent via Postfix');
    json(res, 200, { success: true, messageId: info.messageId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ error: message }, 'Failed to send email');

    // Record failure for IP management
    const sourceIp = ipManager.getNextIp();
    if (sourceIp) {
      ipManager.recordSend(sourceIp, false);
    }

    json(res, 500, { success: false, error: message });
  }
}

function handleGetDomains(req: IncomingMessage, res: ServerResponse): void {
  const { query } = parseUrl(req);
  const orgId = query.get('organizationId');

  const result = Array.from(domains.values()).filter(
    (d) => !orgId || d.organizationId === orgId,
  );

  json(res, 200, { domains: result });
}

async function handleVerifyDomain(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = JSON.parse(await readBody(req)) as {
      domain: string;
      organizationId: string;
    };

    if (!body.domain || !body.organizationId) {
      json(res, 400, { error: 'Missing required fields: domain, organizationId' });
      return;
    }

    logger.info({ domain: body.domain, orgId: body.organizationId }, 'Starting domain verification');

    const verification = await dnsVerifier.verifyAll(body.domain);

    // Upsert domain record
    const existingKey = `${body.organizationId}:${body.domain}`;
    const existing = domains.get(existingKey);

    const domainRecord: SendingDomain = {
      id: existing?.id ?? crypto.randomUUID(),
      organizationId: body.organizationId,
      domain: body.domain,
      verified: verification.mx && verification.spf && verification.dkim && verification.dmarc,
      mxVerified: verification.mx,
      spfVerified: verification.spf,
      dkimVerified: verification.dkim,
      dmarcVerified: verification.dmarc,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    domains.set(existingKey, domainRecord);

    json(res, 200, {
      domain: domainRecord,
      verification,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ error: message }, 'Domain verification failed');
    json(res, 500, { error: message });
  }
}

function handleGetIps(_req: IncomingMessage, res: ServerResponse): void {
  const ips = ipManager.listIps();
  json(res, 200, { ips });
}

function handleHealth(_req: IncomingMessage, res: ServerResponse): void {
  json(res, 200, {
    status: 'healthy',
    postfix: { host: POSTFIX_HOST, port: POSTFIX_PORT },
    uptime: process.uptime(),
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { pathname } = parseUrl(req);
  const method = req.method ?? 'GET';

  logger.debug({ method, pathname }, 'Incoming request');

  if (method === 'POST' && pathname === '/api/send') {
    return handleSend(req, res);
  }
  if (method === 'GET' && pathname === '/api/domains') {
    return handleGetDomains(req, res);
  }
  if (method === 'POST' && pathname === '/api/domains/verify') {
    return handleVerifyDomain(req, res);
  }
  if (method === 'GET' && pathname === '/api/ips') {
    return handleGetIps(req, res);
  }
  if (method === 'GET' && pathname === '/api/health') {
    return handleHealth(req, res);
  }

  json(res, 404, { error: 'Not found' });
}

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

const server = createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    logger.error({ error: err }, 'Unhandled request error');
    json(res, 500, { error: 'Internal server error' });
  });
});

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'Mail API sidecar started');
});

// Graceful shutdown
const shutdown = () => {
  logger.info('Shutting down mail-api...');
  server.close(() => {
    logger.info('Mail API shut down');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
