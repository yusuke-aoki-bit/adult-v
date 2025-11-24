import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

/**
 * Quick fix for DUGA and MGS thumbnails using URL patterns
 * (No web scraping required - much faster)
 */

async function fixThumbnails() {
  const db = getDb();

  console.log('=== Quick Fix: DUGA & MGS Thumbnails ===\n');

  // Fix ALL remaining DUGA thumbnails
  console.log('📸 Fixing DUGA thumbnails...\n');

  const dugaProducts = await db.execute(sql`
    SELECT
      pc.id,
      pc.affiliate_url,
      ps.original_product_id
    FROM product_cache pc
    JOIN product_sources ps ON pc.product_id = ps.product_id AND pc.asp_name = ps.asp_name
    WHERE pc.asp_name = 'DUGA'
    AND (pc.thumbnail_url IS NULL OR pc.thumbnail_url = '')
    AND pc.affiliate_url IS NOT NULL
  `);

  console.log(`Found ${dugaProducts.rows.length} DUGA products needing thumbnails`);

  let dugaFixed = 0;
  for (const product of dugaProducts.rows as any[]) {
    const affiliateUrl = product.affiliate_url;
    const match = affiliateUrl.match(/duga\.jp\/ppv\/([^\/]+)\//);

    if (match) {
      const productCode = match[1];
      const [series, id] = productCode.split('-');

      if (series && id) {
        const thumbnailUrl = `https://pic.duga.jp/unsecure/${series}/${id}/noauth/jacket_240.jpg`;

        await db.execute(sql`
          UPDATE product_cache
          SET thumbnail_url = ${thumbnailUrl}
          WHERE id = ${product.id}
        `);

        dugaFixed++;
        if (dugaFixed % 1000 === 0) {
          console.log(`  Fixed ${dugaFixed} DUGA thumbnails...`);
        }
      }
    }
  }

  console.log(`✅ Fixed ${dugaFixed} DUGA thumbnail URLs\n`);

  // Fix ALL MGS thumbnails using product ID pattern
  console.log('📸 Fixing MGS thumbnails...\n');

  const mgsProducts = await db.execute(sql`
    SELECT
      pc.id,
      ps.original_product_id
    FROM product_cache pc
    JOIN product_sources ps ON pc.product_id = ps.product_id AND pc.asp_name = ps.asp_name
    WHERE pc.asp_name = 'MGS'
    AND (pc.thumbnail_url IS NULL OR pc.thumbnail_url = '')
    AND ps.original_product_id IS NOT NULL
  `);

  console.log(`Found ${mgsProducts.rows.length} MGS products needing thumbnails`);

  let mgsFixed = 0;
  for (const product of mgsProducts.rows as any[]) {
    const productId = product.original_product_id; // e.g., "300MIUM-1135"
    const match = productId.match(/^([A-Z]+)-?(\d+)$/i);

    if (match) {
      const series = match[1].toLowerCase();
      const thumbnailUrl = `https://image.mgstage.com/images/doc/${series}/${productId}/pb_e_${productId}.jpg`;

      await db.execute(sql`
        UPDATE product_cache
        SET thumbnail_url = ${thumbnailUrl}
        WHERE id = ${product.id}
      `);

      mgsFixed++;
      if (mgsFixed % 1000 === 0) {
        console.log(`  Fixed ${mgsFixed} MGS thumbnails...`);
      }
    }
  }

  console.log(`✅ Fixed ${mgsFixed} MGS thumbnail URLs\n`);

  // Final summary
  console.log('=== Summary ===');
  console.log(`DUGA: ${dugaFixed} thumbnails fixed`);
  console.log(`MGS:  ${mgsFixed} thumbnails fixed`);
  console.log(`Total: ${dugaFixed + mgsFixed} thumbnails fixed\n`);

  // Check results
  const results = await db.execute(sql`
    SELECT
      asp_name,
      COUNT(*) as total,
      COUNT(CASE WHEN thumbnail_url IS NULL OR thumbnail_url = '' THEN 1 END) as no_thumbnail,
      COUNT(CASE WHEN thumbnail_url IS NOT NULL AND thumbnail_url != '' THEN 1 END) as has_thumbnail,
      ROUND(100.0 * COUNT(CASE WHEN thumbnail_url IS NOT NULL AND thumbnail_url != '' THEN 1 END) / COUNT(*), 1) as coverage_pct
    FROM product_cache
    WHERE asp_name IN ('DUGA', 'MGS')
    GROUP BY asp_name
    ORDER BY asp_name
  `);

  console.log('📊 Thumbnail Coverage After Fix:');
  console.table(results.rows);

  process.exit(0);
}

fixThumbnails().catch(console.error);
