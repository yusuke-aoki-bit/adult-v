import { db } from '../lib/db/index.js';
import { tags, productTags, productSources } from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';

async function addMGSTag() {
  console.log('Adding MGS tag...\n');

  // 1. MGSタグを追加（既に存在する場合はスキップ）
  const existingTag = await db
    .select()
    .from(tags)
    .where(eq(tags.name, 'MGS'))
    .limit(1);

  let mgsTagId: number;

  if (existingTag.length > 0) {
    mgsTagId = existingTag[0].id;
    console.log(`MGS tag already exists with ID: ${mgsTagId}`);
  } else {
    const [newTag] = await db
      .insert(tags)
      .values({
        name: 'MGS',
        category: 'site',
      })
      .returning({ id: tags.id });

    mgsTagId = newTag.id;
    console.log(`Created MGS tag with ID: ${mgsTagId}`);
  }

  // 2. MGSの商品を取得
  const mgsProducts = await db
    .select({ productId: productSources.productId })
    .from(productSources)
    .where(eq(productSources.aspName, 'MGS'));

  console.log(`\nFound ${mgsProducts.length} MGS products`);

  // 3. 既存の紐付けをチェック
  const existingLinks = await db
    .select()
    .from(productTags)
    .where(eq(productTags.tagId, mgsTagId));

  console.log(`Already linked: ${existingLinks.length} products`);

  // 4. まだ紐付けられていない商品を紐付け
  const linkedProductIds = new Set(existingLinks.map(l => l.productId));
  const toLink = mgsProducts.filter(p => p.productId && !linkedProductIds.has(p.productId));

  if (toLink.length > 0) {
    console.log(`\nLinking ${toLink.length} products to MGS tag...`);

    for (const { productId } of toLink) {
      if (productId) {
        await db.insert(productTags).values({
          productId,
          tagId: mgsTagId,
        }).onConflictDoNothing();
      }
    }

    console.log('✓ Done linking products');
  } else {
    console.log('\nAll MGS products are already linked');
  }

  // 5. 最終結果を表示
  const finalCount = await db
    .select()
    .from(productTags)
    .where(eq(productTags.tagId, mgsTagId));

  console.log(`\nFinal count: MGS tag is linked to ${finalCount.length} products`);
}

addMGSTag().catch(console.error);
