import { getProducts } from '@/lib/db/queries';
import { createProductsHandler } from '@adult-v/shared/api-handlers';

export const revalidate = 300; // 5分キャッシュ

export const GET = createProductsHandler(
  { getProducts },
  { adjustLimitOffsetForIds: true }
);
