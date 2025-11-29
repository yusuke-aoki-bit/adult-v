import { getDb } from '../lib/db';
import { productSources, products } from '../lib/db/schema';
import { sql, eq } from 'drizzle-orm';

async function checkMgsSamples() {
  const db = getDb();

  // MGS商品の最初の10件を確認
  const samples = await db
    .select({
      productId: productSources.productId,
      originalProductId: productSources.originalProductId,
      title: products.title,
      thumbnailUrl: products.defaultThumbnailUrl,
    })
    .from(productSources)
    .leftJoin(products, eq(productSources.productId, products.id))
    .where(eq(productSources.aspName, 'MGS'))
    .limit(10);

  console.log('MGS product samples:');
  console.log(JSON.stringify(samples, null, 2));

  // 画像がない商品の数を確認
  const noImageCount = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM product_sources ps
    LEFT JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS'
    AND (p.default_thumbnail_url IS NULL OR p.default_thumbnail_url = '')
  `);

  console.log('\n\nMGS products without images:', noImageCount.rows);
}

checkMgsSamples()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
