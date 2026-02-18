import { NextRequest } from 'next/server';
import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { createAdminStatsHandler } from '@adult-v/shared/api-handlers';
import { getDb } from '@/lib/db';
import { getAllASPTotals, mapDBNameToASPName } from '@/lib/asp-totals';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const handler = createAdminStatsHandler(
  {
    getDb,
    getAllASPTotals,
    mapDBNameToASPName,
  },
  {
    includeSeoIndexing: true,
  }
);

export async function GET(request: NextRequest) {
  if (!await verifyCronRequest(request)) {
    return unauthorizedResponse();
  }
  return handler();
}
