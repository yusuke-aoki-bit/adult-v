import { createAdminStatsHandler } from '@adult-v/shared/api-handlers';
import { getDb } from '@/lib/db';
import { getAllASPTotals, mapDBNameToASPName } from '@/lib/asp-totals';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = createAdminStatsHandler(
  {
    getDb,
    getAllASPTotals,
    mapDBNameToASPName,
  },
  {
    includeSeoIndexing: true,
  }
);
