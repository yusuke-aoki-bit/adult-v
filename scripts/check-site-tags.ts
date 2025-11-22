import { db } from '../lib/db/index.js';
import { tags, productTags } from '../lib/db/schema.js';
import { eq, sql } from 'drizzle-orm';

async function checkSiteTags() {
  console.log('Checking site tags...\n');

  const siteTags = await db
    .select({
      id: tags.id,
      name: tags.name,
      category: tags.category,
      count: sql<number>`count(${productTags.productId})`,
    })
    .from(tags)
    .leftJoin(productTags, eq(tags.id, productTags.tagId))
    .where(eq(tags.category, 'site'))
    .groupBy(tags.id, tags.name, tags.category)
    .orderBy(sql`count(${productTags.productId}) DESC`);

  console.log('Site tags (category=site):');
  siteTags.forEach(({ name, count }) => {
    console.log(`  ${name}: ${count} products`);
  });

  console.log('\nTotal site tags:', siteTags.length);
}

checkSiteTags().catch(console.error);
