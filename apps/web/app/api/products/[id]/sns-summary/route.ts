import { getDb } from '@/lib/db';
import { products, productTags, tags, productPerformers, performers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createSNSSummaryHandler } from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = createSNSSummaryHandler({
  async getProductWithDetails(normalizedId: string) {
    const db = getDb();

    const productData = await db
      .select({
        id: products.id,
        title: products.title,
        description: products.description,
        releaseDate: products.releaseDate,
      })
      .from(products)
      .where(eq(products.normalizedProductId, normalizedId))
      .limit(1);

    if (productData.length === 0) {
      return null;
    }

    const product = productData[0];

    const performersData = await db
      .select({ name: performers.name })
      .from(productPerformers)
      .innerJoin(performers, eq(productPerformers.performerId, performers.id))
      .where(eq(productPerformers.productId, product.id));

    const tagsData = await db
      .select({ name: tags.name })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, product.id));

    return {
      id: product.id,
      title: product.title,
      description: product.description,
      releaseDate: product.releaseDate,
      performers: performersData.map(p => p.name),
      tags: tagsData.map(t => t.name),
    };
  },
});
