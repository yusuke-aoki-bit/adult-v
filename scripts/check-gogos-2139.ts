import { getDb } from '../lib/db/index';
import { products, productSources } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // normalized_product_id で検索
  const productByNormalized = await db
    .select()
    .from(products)
    .where(eq(products.normalizedProductId, 'gogos-2139'))
    .limit(1);

  console.log('=== Product by normalized_product_id ===');
  console.log(JSON.stringify(productByNormalized, null, 2));

  if (productByNormalized.length > 0) {
    const productId = productByNormalized[0].id;

    // このproductに紐づくsourcesを取得
    const sources = await db
      .select()
      .from(productSources)
      .where(eq(productSources.productId, productId));

    console.log('\n=== Product Sources ===');
    console.log(JSON.stringify(sources, null, 2));
  }

  process.exit(0);
}

main().catch(console.error);
