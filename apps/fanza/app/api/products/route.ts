import { getProducts } from '@/lib/db/queries';
import { createProductsHandler } from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';

export const GET = createProductsHandler(
  { getProducts },
  { adjustLimitOffsetForIds: false }
);
