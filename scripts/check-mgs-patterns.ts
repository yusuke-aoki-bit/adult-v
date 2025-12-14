import { getDb } from "../packages/crawlers/src/lib/db";
import { products, productSources } from "../packages/crawlers/src/lib/db/schema";
import { eq, sql, and } from 'drizzle-orm';

const db = getDb();

async function check() {
  // MGSの商品コードパターンを調査 - affiliateUrlから判別
  const samples = await db.select({
    originalProductId: productSources.originalProductId,
    affiliateUrl: productSources.affiliateUrl,
  }).from(productSources)
    .where(eq(productSources.aspName, 'MGS'))
    .limit(30);

  console.log('MGS samples (original_product_id | affiliate_url):');
  samples.forEach(s => console.log(`  ${s.originalProductId} | ${s.affiliateUrl}`));

  // affiliateUrlからパターン確認
  // CH: https://www.mgstage.com/product/product_detail/XXXX/
  // DVD: URLに/dvd/や異なるパスが含まれる可能性

  // 全MGS件数
  const [totalCount] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(productSources)
    .where(eq(productSources.aspName, 'MGS'));
  console.log(`\nTotal MGS count: ${totalCount?.count}`);

  // normalizedProductIdのパターンを確認
  const normalizedSamples = await db.select({
    normalizedProductId: products.normalizedProductId
  }).from(products)
    .innerJoin(productSources, eq(products.id, productSources.productId))
    .where(eq(productSources.aspName, 'MGS'))
    .limit(30);

  console.log('\nNormalized product IDs:');
  normalizedSamples.forEach(s => console.log(`  ${s.normalizedProductId}`));

  process.exit(0);
}
check().catch(console.error);
