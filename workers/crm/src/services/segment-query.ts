import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import {
  DrizzleContactRepository,
  SegmentNotFoundError,
} from '../infrastructure/repositories/drizzle-contact-repository.js';

export type SegmentQueryInput = {
  organizationId: string;
  segmentId: string;
  cursor?: string;
  limit?: number;
};

export type SegmentQueryResult = {
  contacts: Array<{
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    customFields: Record<string, unknown> | null;
  }>;
  total: number;
  nextCursor: string | null;
};

export function encodeCursor(offset: number): string {
  const payload = String(offset);
  if (typeof btoa === 'function') {
    return btoa(payload);
  }
  return Buffer.from(payload, 'utf8').toString('base64');
}

export function decodeCursor(cursor?: string | null): number {
  if (!cursor) return 0;
  try {
    const decoded =
      typeof atob === 'function'
        ? atob(cursor)
        : Buffer.from(cursor, 'base64').toString('utf8');
    const value = Number(decoded);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch (error) {
    console.warn('Invalid segment contacts cursor:', error);
    return 0;
  }
}

export async function querySegmentContacts(
  db: NeonHttpDatabase,
  input: SegmentQueryInput,
): Promise<SegmentQueryResult> {
  const limit = Math.min(Math.max(input.limit ?? 500, 1), 1000);
  const offset = decodeCursor(input.cursor);

  const repo = new DrizzleContactRepository(db);
  const result = await repo.findBySegment(
    input.organizationId,
    input.segmentId,
    {
      offset,
      limit,
    },
  );

  return {
    contacts: result.data.map((contact) => ({
      id: contact.id,
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      customFields: contact.customFields,
    })),
    total: result.total,
    nextCursor:
      result.nextOffset !== null ? encodeCursor(result.nextOffset) : null,
  };
}

export { SegmentNotFoundError };
