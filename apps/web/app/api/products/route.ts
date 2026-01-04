import { getProducts } from '@/lib/db/queries';
import { createProductsHandler } from '@adult-v/shared/api-handlers';

export const revalidate = 60;

export const GET = createProductsHandler(
  { getProducts },
  { adjustLimitOffsetForIds: true }
);
