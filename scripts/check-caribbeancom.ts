import { db } from '../lib/db/index.js';
import { productSources, tags, productTags } from '../lib/db/schema.js';
import { eq, like, or, and } from 'drizzle-orm';

async function checkCaribbeancom() {
  console.log('Checking カリビアンコム data...\n');

  // 1. product_sourcesでカリビアンコムを検索
  const sources = await db
    .select()
    .from(productSources)
    .where(
      or(
        like(productSources.originalProductId, '%caribbeancom%'),
        like(productSources.affiliateUrl, '%caribbeancom.com%')
      )
    )
    .limit(10);

  console.log('product_sources containing "caribbeancom":');
  sources.forEach(s => {
    console.log(`  Product ID: ${s.productId}, ASP: ${s.aspName}, Original: ${s.originalProductId}`);
  });

  // 2. DTIの中でカリビアンコムを探す
  const dtiSources = await db
    .select()
    .from(productSources)
    .where(
      and(
        eq(productSources.aspName, 'DTI'),
        or(
          like(productSources.originalProductId, '%caribbean%'),
          like(productSources.affiliateUrl, '%caribbeancom%')
        )
      )
    )
    .limit(10);

  console.log('\nDTI sources containing "caribbean":');
  dtiSources.forEach(s => {
    console.log(`  Product ID: ${s.productId}, Original: ${s.originalProductId}`);
    console.log(`  URL: ${s.affiliateUrl?.substring(0, 100)}`);
  });

  // 3. タグ情報を確認
  const caribTag = await db
    .select()
    .from(tags)
    .where(eq(tags.name, 'カリビアンコム'))
    .limit(1);

  if (caribTag.length > 0) {
    console.log(`\nカリビアンコム tag ID: ${caribTag[0].id}`);

    const linkedProducts = await db
      .select()
      .from(productTags)
      .where(eq(productTags.tagId, caribTag[0].id));

    console.log(`Linked products: ${linkedProducts.length}`);
  }
}

checkCaribbeancom().catch(console.error);
