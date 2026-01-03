import { getDb } from '@/lib/db';
import { products, productTags, tags } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createAutoTagsHandler } from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = createAutoTagsHandler({
  async getProductWithTags(normalizedId: string) {
    const db = getDb();

    const productData = await db
      .select({
        id: products.id,
        title: products.title,
        description: products.description,
      })
      .from(products)
      .where(eq(products.normalizedProductId, normalizedId))
      .limit(1);

    if (productData.length === 0) {
      return null;
    }

    const product = productData[0];

    const existingTagsData = await db
      .select({ name: tags.name })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, product.id));

    return {
      id: product.id,
      title: product.title,
      description: product.description,
      existingTags: existingTagsData.map(t => t.name),
    };
  },

  async getAvailableTags() {
    const db = getDb();
    const availableTagsData = await db.execute(sql`
      SELECT name FROM tags ORDER BY name LIMIT 100
    `);
    return (availableTagsData.rows as Array<{ name: string }>).map(t => t.name);
  },
});
