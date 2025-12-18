import { getActresses, getFeaturedActresses } from '@/lib/db/queries';
import { createActressesHandler } from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';

export const GET = createActressesHandler({
  getActresses,
  getFeaturedActresses,
});
