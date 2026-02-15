import { getActresses, getActressesCount, getFeaturedActresses } from '@/lib/db/queries';
import { createActressesHandler } from '@adult-v/shared/api-handlers';

export const revalidate = 300; // 5分キャッシュ

export const GET = createActressesHandler({
  getActresses,
  getActressesCount,
  getFeaturedActresses,
});
