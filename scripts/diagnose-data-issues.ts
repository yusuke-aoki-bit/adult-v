/**
 * Diagnose data quality issues
 * - Products without thumbnails
 * - Products without performers
 * - Performers without normalized names
 * - Products by ASP
 */

import { getDb } from '../lib/db';
import { products, productSources, performers, productPerformers, productImages, uncensoredProducts } from '../lib/db/schema';
import { sql, isNull, eq } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('📊 Data Quality Diagnosis Report\n');
  console.log('='.repeat(80) + '\n');

  // 1. Products overview
  console.log('1️⃣  Products Overview:');
  const totalProducts = await db.select({ count: sql<number>`COUNT(*)` }).from(products);
  const totalUncensored = await db.select({ count: sql<number>`COUNT(*)` }).from(uncensoredProducts);
  console.log(`   Total active products: ${totalProducts[0].count}`);
  console.log(`   Total uncensored products: ${totalUncensored[0].count}`);
  console.log('');

  // 2. Products by ASP
  console.log('2️⃣  Products by ASP (Source):');
  const productsByAsp = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT ps.product_id) as product_count
    FROM product_sources ps
    GROUP BY ps.asp_name
    ORDER BY product_count DESC
  `);

  for (const row of productsByAsp.rows) {
    const aspRow = row as { asp_name: string; product_count: string };
    console.log(`   ${aspRow.asp_name}: ${aspRow.product_count} products`);
  }
  console.log('');

  // 3. Products without thumbnails
  console.log('3️⃣  Products Without Thumbnails:');
  const noThumbnail = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(products)
    .where(isNull(products.defaultThumbnailUrl));
  console.log(`   ${noThumbnail[0].count} products have no thumbnail`);

  // Breakdown by ASP
  const noThumbnailByAsp = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT p.id) as no_thumbnail_count
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    WHERE p.default_thumbnail_url IS NULL
    GROUP BY ps.asp_name
    ORDER BY no_thumbnail_count DESC
  `);

  for (const row of noThumbnailByAsp.rows) {
    const aspRow = row as { asp_name: string; no_thumbnail_count: string };
    console.log(`   - ${aspRow.asp_name}: ${aspRow.no_thumbnail_count} products`);
  }
  console.log('');

  // 4. Products without any images
  console.log('4️⃣  Products Without Any Images (product_images):');
  const noImages = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM products p
    WHERE NOT EXISTS (
      SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
    )
  `);
  console.log(`   ${noImages.rows[0].count} products have no images in product_images table`);
  console.log('');

  // 5. Products without performers
  console.log('5️⃣  Products Without Performers:');
  const noPerformers = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM products p
    WHERE NOT EXISTS (
      SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id
    )
  `);
  console.log(`   ${noPerformers.rows[0].count} products have no performers linked`);
  console.log('');

  // 6. Performers without images
  console.log('6️⃣  Performers Without Images:');
  const performersNoImage = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM performers p
    WHERE p.image_url IS NULL OR p.image_url = ''
  `);
  console.log(`   ${performersNoImage.rows[0].count} performers have no image`);
  console.log('');

  // 7. Raw HTML data available
  console.log('7️⃣  Raw HTML Data Available:');
  const rawHtmlCount = await db.execute(sql`
    SELECT source, COUNT(*) as count
    FROM raw_html_data
    GROUP BY source
    ORDER BY count DESC
  `);

  for (const row of rawHtmlCount.rows) {
    const sourceRow = row as { source: string; count: string };
    console.log(`   ${sourceRow.source}: ${sourceRow.count} raw HTML records`);
  }
  console.log('');

  // 8. Products with raw HTML but no images
  console.log('8️⃣  Products with Raw HTML but No Thumbnail:');
  const htmlButNoThumb = await db.execute(sql`
    SELECT COUNT(DISTINCT p.id) as count
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    INNER JOIN raw_html_data rhd ON rhd.product_id = ps.original_product_id AND rhd.source = ps.asp_name
    WHERE p.default_thumbnail_url IS NULL
  `);
  console.log(`   ${htmlButNoThumb.rows[0].count} products have raw HTML but still no thumbnail`);
  console.log('   (These can be backfilled from raw HTML)');
  console.log('');

  // 9. Sample products needing name normalization
  console.log('9️⃣  Sample Products Needing Investigation:');
  const sampleProducts = await db.execute(sql`
    SELECT
      p.id,
      p.normalized_product_id,
      p.title,
      ps.asp_name,
      CASE WHEN p.default_thumbnail_url IS NULL THEN 'No' ELSE 'Yes' END as has_thumbnail,
      (SELECT COUNT(*) FROM product_performers pp WHERE pp.product_id = p.id) as performer_count
    FROM products p
    LEFT JOIN product_sources ps ON p.id = ps.product_id
    WHERE p.default_thumbnail_url IS NULL
    LIMIT 10
  `);

  console.log('   Top 10 products without thumbnails:');
  for (const row of sampleProducts.rows) {
    const prodRow = row as any;
    console.log(`   - ID ${prodRow.id}: ${prodRow.normalized_product_id} | ${prodRow.title.substring(0, 50)}...`);
    console.log(`     ASP: ${prodRow.asp_name || 'N/A'} | Performers: ${prodRow.performer_count} | Thumbnail: ${prodRow.has_thumbnail}`);
  }
  console.log('');

  console.log('='.repeat(80));
  console.log('\n✅ Diagnosis complete!\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Diagnosis failed:', error);
    process.exit(1);
  });
