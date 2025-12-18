import { getSaleStats } from '@/lib/db/queries';
import { createStatsSalesHandler } from '@adult-v/shared/api-handlers';

// Cache for 5 minutes
export const revalidate = 300;

export const GET = createStatsSalesHandler({ getSaleStats });
