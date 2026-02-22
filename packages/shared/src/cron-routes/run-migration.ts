/**
 * Pre-wired run-migration handler
 *
 * Has unique pattern: parameter parsing + dynamic handler creation
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest, unauthorizedResponse } from '../lib/cron-auth';
import { getDb as _getDb } from '@adult-v/database';

const getDb = _getDb as any;
import { createRunMigrationHandler } from '../cron-handlers';

export async function cronRunMigration(request: NextRequest) {
  if (!await verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  const migrationName = request.nextUrl.searchParams.get('migration');

  if (!migrationName) {
    return NextResponse.json(
      { error: 'Missing migration parameter. Use ?migration=<name>' },
      { status: 400 }
    );
  }

  const handler = createRunMigrationHandler({ getDb });
  const result = await handler(migrationName);

  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
  });
}
