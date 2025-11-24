/**
 * product_cacheテーブルの女優名から performers と product_performers を作成
 */

import { getDb } from '../lib/db';
import { performers, productPerformers, products, productCache } from '../lib/db/schema';
import { sql, eq, inArray } from 'drizzle-orm';

const db = getDb();

async function migratePerformers() {
  console.log('=== product_cacheから女優情報を移行 ===\n');

  // 1. product_cacheから女優名を取得
  console.log('1. product_cacheからperformer_nameを取得中...');
  const cacheRecords = await db
    .select({
      id: productCache.id,
      productId: productCache.productId,
      performerName: productCache.performerName,
      aspName: productCache.aspName,
    })
    .from(productCache)
    .where(sql`${productCache.performerName} IS NOT NULL AND ${productCache.performerName} != ''`);

  console.log(`取得: ${cacheRecords.length}件\n`);

  let newPerformers = 0;
  let newRelations = 0;
  let skipped = 0;

  for (const record of cacheRecords) {
    if (!record.performerName || !record.productId) {
      skipped++;
      continue;
    }

    // 女優名をカンマで分割（複数女優対応）
    const performerNames = record.performerName
      .split(/[,、]/)
      .map(name => name.trim())
      .filter(name => name.length > 0);

    for (const performerName of performerNames) {
      try {
        // 女優が存在するか確認
        let performer = await db.query.performers.findFirst({
          where: eq(performers.name, performerName),
        });

        // 存在しない場合は作成
        if (!performer) {
          const [newPerformer] = await db
            .insert(performers)
            .values({
              name: performerName,
              slug: performerName.toLowerCase().replace(/\s+/g, '-'),
            })
            .returning();
          performer = newPerformer;
          newPerformers++;
          console.log(`新規女優作成: ${performerName} (ID: ${performer.id})`);
        }

        // product_performersにリレーションが存在するか確認
        const existingRelation = await db.query.productPerformers.findFirst({
          where: sql`${productPerformers.productId} = ${record.productId} AND ${productPerformers.performerId} = ${performer.id}`,
        });

        if (!existingRelation) {
          // リレーションを作成
          await db.insert(productPerformers).values({
            productId: record.productId,
            performerId: performer.id,
          });
          newRelations++;

          if (newRelations % 100 === 0) {
            console.log(`処理済み: ${newRelations}件のリレーション作成`);
          }
        }
      } catch (error) {
        console.error(`エラー (${performerName}):`, error);
      }
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`新規女優: ${newPerformers}件`);
  console.log(`新規リレーション: ${newRelations}件`);
  console.log(`スキップ: ${skipped}件`);
}

migratePerformers().catch(console.error).finally(() => process.exit(0));
