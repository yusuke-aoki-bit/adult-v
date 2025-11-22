import { getDb } from '../lib/db/index';
import { productSources, products } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('Checking MGS affiliate data...\n');

  const mgsLinks = await db
    .select({
      id: productSources.id,
      productId: productSources.productId,
      aspName: productSources.aspName,
      originalProductId: productSources.originalProductId,
      affiliateUrl: productSources.affiliateUrl,
      productTitle: products.title,
    })
    .from(productSources)
    .leftJoin(products, eq(productSources.productId, products.id))
    .where(eq(productSources.aspName, 'MGS'))
    .limit(5);

  console.log(`Found ${mgsLinks.length} MGS affiliate link(s):\n`);

  mgsLinks.forEach((link, i) => {
    console.log(`${i + 1}. Product ID: ${link.originalProductId}`);
    console.log(`   Title: ${link.productTitle}`);
    console.log(`   Affiliate Widget:`);
    console.log(`   ${link.affiliateUrl}`);
    console.log('');
  });
}

main().catch(console.error);
