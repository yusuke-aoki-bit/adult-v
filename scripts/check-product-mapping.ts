import { getDb } from '../lib/db/index';
import { products, productSources } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // Get product data
  const product = await db
    .select()
    .from(products)
    .where(eq(products.id, 'gogos-2139'))
    .limit(1);

  console.log('Product Data:');
  console.log(JSON.stringify(product, null, 2));

  // Get source data
  const sources = await db
    .select()
    .from(productSources)
    .where(eq(productSources.productId, 'gogos-2139'));

  console.log('\nProduct Sources:');
  console.log(JSON.stringify(sources, null, 2));

  process.exit(0);
}

main().catch(console.error);
