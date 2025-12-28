/**
 * ワンタイムマイグレーション実行 API エンドポイント
 *
 * 使い方:
 *   GET /api/cron/run-migration?migration=ai-review-translations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createRunMigrationHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const migrationName = request.nextUrl.searchParams.get('migration');

  if (!migrationName) {
    return NextResponse.json(
      { error: 'Missing migration parameter. Use ?migration=<name>' },
      { status: 400 }
    );
  }

  const handler = createRunMigrationHandler({
    getDb,
  });

  const result = await handler(migrationName);

  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
  });
}
