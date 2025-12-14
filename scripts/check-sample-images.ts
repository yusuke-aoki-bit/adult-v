import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function check() {
  console.log('Checking products...');

  // Product 732848 - 小さいサンプル画像 (Sokmil)
  const p1 = await db.execute(sql`
    SELECT p.id, p.normalized_product_id, p.title, p.default_thumbnail_url
    FROM products p WHERE p.id = 732848
  `);
  console.log('\n=== Product 732848 (Sokmil) ===');
  console.log(JSON.stringify(p1.rows[0], null, 2));

  const img1 = await db.execute(sql`SELECT image_url, image_type, width, height FROM product_images WHERE product_id = 732848`);
  console.log('Images count:', img1.rows.length);
  console.log('All image URLs:');
  img1.rows.forEach((r: any, i: number) => console.log(`  ${i+1}. [${r.image_type}] ${r.width}x${r.height} - ${r.image_url}`));

  // Product 695549 - サンプル画像なし (DUGA)
  const p2 = await db.execute(sql`
    SELECT p.id, p.normalized_product_id, p.title, p.default_thumbnail_url
    FROM products p WHERE p.id = 695549
  `);
  console.log('\n=== Product 695549 (DUGA) ===');
  console.log(JSON.stringify(p2.rows[0], null, 2));

  const img2 = await db.execute(sql`SELECT image_url, image_type, width, height FROM product_images WHERE product_id = 695549`);
  console.log('Images count:', img2.rows.length);
  console.log('All image URLs:');
  img2.rows.forEach((r: any, i: number) => console.log(`  ${i+1}. [${r.image_type}] ${r.width}x${r.height} - ${r.image_url}`));

  await db.$client.end();
}

check().catch(e => { console.error(e); process.exit(1); });
