import { getDb } from '../lib/db';
import { products, productSources, productPerformers, productTags, performers, tags } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkProduct() {
  try {
    const db = getDb();
    const productId = '155930';

    console.log('=== Checking Product ID:', productId, '===\n');

    // Check if product exists
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      console.log('❌ Product not found');
      return;
    }

    console.log('✅ Product exists:');
    console.log('  - ID:', product.id);
    console.log('  - Title:', product.title);
    console.log('  - Release Date:', product.releaseDate);
    console.log('  - Thumbnail:', product.defaultThumbnailUrl);
    console.log('  - Duration:', product.duration);
    console.log('  - Description:', product.description?.substring(0, 100) + '...');
    console.log();

    // Check product sources (used by ProductDetailInfo)
    const sources = await db
      .select()
      .from(productSources)
      .where(eq(productSources.productId, product.id));

    console.log('📦 Product Sources:', sources.length);
    sources.forEach((source, idx) => {
      console.log(`  ${idx + 1}. ${source.aspName || 'N/A'}`);
      console.log('     - Original ID:', source.originalProductId);
      console.log('     - Price:', source.price);
      console.log('     - Affiliate URL:', source.affiliateUrl?.substring(0, 60) + '...');
    });
    console.log();

    // Check performers
    const performerData = await db
      .select({
        performerId: productPerformers.performerId,
        performerName: performers.name,
      })
      .from(productPerformers)
      .leftJoin(performers, eq(productPerformers.performerId, performers.id))
      .where(eq(productPerformers.productId, product.id));

    console.log('👤 Performers:', performerData.length);
    performerData.forEach((p, idx) => {
      console.log(`  ${idx + 1}. ${p.performerName || 'Unknown'} (ID: ${p.performerId})`);
    });
    console.log();

    // Check tags
    const tagData = await db
      .select({
        tagId: productTags.tagId,
        tagName: tags.name,
        tagCategory: tags.category,
      })
      .from(productTags)
      .leftJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, product.id));

    console.log('🏷️  Tags:', tagData.length);
    tagData.forEach((t, idx) => {
      console.log(`  ${idx + 1}. ${t.tagName || 'Unknown'} (${t.tagCategory || 'N/A'})`);
    });
    console.log();

    // Check for potential issues
    console.log('🔍 Potential Issues:');
    const issues: string[] = [];

    if (!product.title) issues.push('  ⚠️ Missing title');
    if (!product.releaseDate) issues.push('  ⚠️ Missing release date');
    if (!product.defaultThumbnailUrl) issues.push('  ⚠️ Missing thumbnail');
    if (sources.length === 0) issues.push('  ⚠️ No product sources (ProductDetailInfo might have issues)');
    if (performerData.length === 0) issues.push('  ⚠️ No performers');
    if (tagData.length === 0) issues.push('  ⚠️ No tags');

    // Check for null values in sources that might cause rendering issues
    sources.forEach((source, idx) => {
      if (!source.aspName) issues.push(`  ⚠️ Source ${idx + 1}: Missing aspName`);
      if (!source.originalProductId) issues.push(`  ⚠️ Source ${idx + 1}: Missing originalProductId`);
      if (!source.affiliateUrl) issues.push(`  ⚠️ Source ${idx + 1}: Missing affiliateUrl`);
    });

    if (issues.length === 0) {
      console.log('  ✅ No obvious data issues found');
    } else {
      issues.forEach(issue => console.log(issue));
    }

  } catch (error) {
    console.error('❌ Error occurred:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  } finally {
    process.exit(0);
  }
}

checkProduct();
