import { getDb } from '@/lib/db';
import { products, performers, tags, productSources } from '@/lib/db/schema';
import { createSearchAutocompleteHandler } from '@adult-v/shared/api-handlers';

export const revalidate = 300; // 5分キャッシュ
export const runtime = 'nodejs';

export const GET = createSearchAutocompleteHandler({
  getDb: getDb as never,
  products,
  performers,
  tags,
  productSources,
});
