import { NextResponse } from 'next/server';
import { performHealthCheck } from '@adult-v/shared/lib/health-check';
import { createModuleLogger } from '@adult-v/shared/lib/logger';

const log = createModuleLogger('health-check');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function checkDatabase() {
  const start = Date.now();
  try {
    const { sql } = await import('drizzle-orm');
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    const latencyMs = Date.now() - start;
    log.debug('Database check passed', { latencyMs });
    return { ok: true, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - start;
    log.error('Database check failed', error, { latencyMs });
    return { ok: false, latencyMs };
  }
}

export async function GET() {
  const result = await performHealthCheck(process.env.SITE_MODE || 'adult-v-1', checkDatabase);

  const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;

  if (result.status !== 'healthy') {
    log.warn('Health check degraded or unhealthy', { status: result.status, statusCode });
  }

  return NextResponse.json(result, { status: statusCode });
}
