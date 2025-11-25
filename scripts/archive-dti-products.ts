/**
 * Archive DTI products to comply with DMM affiliate terms
 *
 * This script:
 * 1. Identifies all products with asp_name = 'DTI'
 * 2. Copies them to archived_products and archived_product_sources
 * 3. Deletes them from products and product_sources (cascades to related tables)
 */
import { getDb } from '../lib/db';
import { products, productSources, productPerformers, uncensoredProducts, uncensoredProductSources, uncensoredProductPerformers } from '../lib/db/schema';
import { sql, eq, inArray } from 'drizzle-orm';

async function main() {
  const db = getDb();
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const testLimit = args.includes('--test') ? 10 : undefined;

  console.log('📦 DTI Products Archival Script');
  console.log('=' .repeat(60));
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '⚠️  LIVE RUN (will modify database)'}`);
  if (testLimit) console.log(`Test mode: Processing only ${testLimit} products`);
  console.log('='.repeat(60) + '\n');

  // Step 1: Find all DTI products
  console.log('Step 1: Identifying DTI products...');

  const dtiProductIds = await db
    .selectDistinct({ productId: productSources.productId })
    .from(productSources)
    .where(sql`${productSources.aspName} = 'DTI'`);

  console.log(`Found ${dtiProductIds.length} products with DTI sources\n`);

  if (dtiProductIds.length === 0) {
    console.log('✅ No DTI products to archive');
    return;
  }

  const productIdsToArchive = testLimit
    ? dtiProductIds.slice(0, testLimit).map(r => r.productId)
    : dtiProductIds.map(r => r.productId);

  console.log(`Will process: ${productIdsToArchive.length} products\n`);

  // Step 2: Fetch product details
  console.log('Step 2: Fetching product details...');

  const productsToArchive = await db
    .select()
    .from(products)
    .where(inArray(products.id, productIdsToArchive));

  const sourcesToArchive = await db
    .select()
    .from(productSources)
    .where(inArray(productSources.productId, productIdsToArchive));

  const performersToArchive = await db
    .select()
    .from(productPerformers)
    .where(inArray(productPerformers.productId, productIdsToArchive));

  console.log(`Products: ${productsToArchive.length}`);
  console.log(`Sources: ${sourcesToArchive.length}`);
  console.log(`Performer relations: ${performersToArchive.length}\n`);

  if (dryRun) {
    console.log('\n🔍 DRY RUN - Would archive:');
    console.log(`  ${productsToArchive.length} products`);
    console.log(`  ${sourcesToArchive.length} product sources`);
    console.log(`  ${performersToArchive.length} performer relations`);
    console.log('\nSample products:');
    productsToArchive.slice(0, 5).forEach(p => {
      console.log(`  - ID: ${p.id}, Title: ${p.title.substring(0, 50)}...`);
    });
    console.log('\n✅ Dry run completed. Run without --dry-run to execute.');
    return;
  }

  // Step 3: Archive products
  console.log('Step 3: Archiving products...');

  let archivedCount = 0;
  let sourceCount = 0;
  let performerRelationCount = 0;

  for (const product of productsToArchive) {
    try {
      // Insert into uncensored_products
      const [uncensoredProduct] = await db.insert(uncensoredProducts).values({
        originalProductId: product.id,
        normalizedProductId: product.normalizedProductId,
        title: product.title,
        releaseDate: product.releaseDate,
        description: product.description,
        duration: product.duration,
        defaultThumbnailUrl: product.defaultThumbnailUrl,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      }).returning();

      // Insert sources
      const productSourcesData = sourcesToArchive.filter(s => s.productId === product.id);

      for (const source of productSourcesData) {
        await db.insert(uncensoredProductSources).values({
          uncensoredProductId: uncensoredProduct.id,
          originalSourceId: source.id,
          aspName: source.aspName,
          originalProductId: source.originalProductId,
          affiliateUrl: source.affiliateUrl,
          price: source.price,
          dataSource: source.dataSource,
          lastUpdated: source.lastUpdated,
        });
        sourceCount++;
      }

      // Insert performer relations
      const productPerformersData = performersToArchive.filter(pp => pp.productId === product.id);

      for (const pp of productPerformersData) {
        await db.insert(uncensoredProductPerformers).values({
          uncensoredProductId: uncensoredProduct.id,
          performerId: pp.performerId,
        });
        performerRelationCount++;
      }

      archivedCount++;

      if (archivedCount % 100 === 0) {
        console.log(`  Archived: ${archivedCount}/${productsToArchive.length} products`);
      }
    } catch (error) {
      console.error(`❌ Error archiving product ${product.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Archived ${archivedCount} products and ${sourceCount} sources\n`);

  // Step 4: Delete from original tables (CASCADE will delete related data)
  console.log('Step 4: Deleting products from original tables...');
  console.log('⚠️  This will CASCADE delete:');
  console.log('  - product_sources');
  console.log('  - product_performers');
  console.log('  - product_tags');
  console.log('  - product_images');
  console.log('  - product_videos');
  console.log('');

  const deleted = await db
    .delete(products)
    .where(inArray(products.id, productIdsToArchive));

  console.log(`✅ Deleted ${productIdsToArchive.length} products and related data\n`);

  // Step 5: Verification
  console.log('Step 5: Verifying archival...');

  const remainingDti = await db
    .selectDistinct({ productId: productSources.productId })
    .from(productSources)
    .where(sql`${productSources.aspName} = 'DTI'`);

  const uncensoredTotal = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(uncensoredProducts);

  console.log(`Remaining DTI products: ${remainingDti.length}`);
  console.log(`Total uncensored products: ${uncensoredTotal[0].count}`);

  if (remainingDti.length === 0) {
    console.log('\n✅ All DTI products successfully archived!');
  } else {
    console.warn(`\n⚠️  Warning: ${remainingDti.length} DTI products still remain`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`  Archived: ${archivedCount} products`);
  console.log(`  Sources archived: ${sourceCount}`);
  console.log(`  Performer relations archived: ${performerRelationCount}`);
  console.log(`  Deleted: ${productIdsToArchive.length} products (+ cascaded data)`);
  console.log('='.repeat(60));
}

main()
  .then(() => {
    console.log('\n✅ Archival process completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Archival process failed:', error);
    process.exit(1);
  });
