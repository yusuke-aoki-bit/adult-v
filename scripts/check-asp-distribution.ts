import { db } from '../lib/db/index.js';
import { productSources } from '../lib/db/schema.js';
import { sql } from 'drizzle-orm';

async function checkASPDistribution() {
  console.log('Checking ASP distribution...\n');

  const aspCounts = await db
    .select({
      aspName: productSources.aspName,
      count: sql<number>`count(*)`,
    })
    .from(productSources)
    .groupBy(productSources.aspName)
    .orderBy(sql`count(*) DESC`);

  console.log('Product counts by ASP:');
  aspCounts.forEach(({ aspName, count }) => {
    console.log(`  ${aspName}: ${count}`);
  });

  console.log('\nTotal ASPs:', aspCounts.length);
}

checkASPDistribution().catch(console.error);
