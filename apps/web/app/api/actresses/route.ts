import { getActresses, getActressesCount, getFeaturedActresses } from '@/lib/db/queries';
import { createActressesHandler } from '@adult-v/shared/api-handlers';

export const revalidate = 60;

export const GET = createActressesHandler({
  getActresses,
  getActressesCount,
  getFeaturedActresses,
});
