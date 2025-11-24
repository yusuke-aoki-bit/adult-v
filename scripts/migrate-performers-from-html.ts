/**
 * raw_html_dataテーブルのHTMLから女優名を抽出して performers と product_performers を作成
 */

import { getDb } from '../lib/db';
import { performers, productPerformers, products, rawHtmlData } from '../lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import * as cheerio from 'cheerio';

const db = getDb();

// サイト別のHTMLパース関数(クローラーと同じロジック)
function parsePerformers(source: string, htmlContent: string): string[] {
  try {
    let actors: string[] = [];

    // Pattern 1: JavaScript variable ec_item_brand (カリビアンコム系)
    const brandMatch = htmlContent.match(/var\s+ec_item_brand\s*=\s*['"]([^'"]+)['"]/);
    if (brandMatch && brandMatch[1]) {
      actors = [brandMatch[1]];
    }

    // Pattern 2: Title format "女優名 【ふりがな】 タイトル" (HEYZO系)
    if (actors.length === 0) {
      const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/i);
      if (titleMatch) {
        const titleActorMatch = titleMatch[1].match(/^([^\s【]+)\s*【[^】]+】/);
        if (titleActorMatch) {
          actors = [titleActorMatch[1]];
        }
      }
    }

    // Pattern 3: HTML content with 出演者 label
    if (actors.length === 0) {
      const actorMatches = htmlContent.match(/出演者?[:：]?\s*([^<\n]+)/i);
      if (actorMatches) {
        actors = actorMatches[1].split(/[、,]/).map(a => a.trim()).filter(a => a);
      }
    }

    return actors;
  } catch (error) {
    console.error(`パースエラー (${source}):`, error);
    return [];
  }
}

async function migratePerformersFromHtml() {
  console.log('=== raw_html_dataから女優情報を移行 ===\n');

  // 一本道のデータのみを取得
  console.log('1. 一本道のHTMLレコードを取得中...');
  const htmlRecords = await db.execute(sql`
    SELECT id, source, product_id, html_content
    FROM raw_html_data
    WHERE source = '一本道'
    LIMIT 1000
  `);

  console.log(`取得: ${htmlRecords.rows.length}件\n`);

  let newPerformers = 0;
  let newRelations = 0;
  let skipped = 0;
  let notFound = 0;

  for (const record of htmlRecords.rows as any[]) {
    try {
      // HTMLから女優名を抽出
      const performerNames = parsePerformers(record.source, record.html_content);

      if (performerNames.length === 0) {
        skipped++;
        continue;
      }

      // 対応するproductsレコードを検索（normalized_product_idでマッチング）
      const product = await db.query.products.findFirst({
        where: sql`${products.normalizedProductId} LIKE '%' || ${record.product_id} || '%'`,
      });

      if (!product) {
        notFound++;
        if (notFound <= 10) {
          console.log(`製品が見つかりません: ${record.source} - ${record.product_id}`);
        }
        continue;
      }

      // 各女優について処理
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
                nameKana: null,
              })
              .returning();
            performer = newPerformer;
            newPerformers++;
            console.log(`新規女優作成: ${performerName} (ID: ${performer.id})`);
          }

          // product_performersにリレーションが存在するか確認
          const existingRelation = await db.query.productPerformers.findFirst({
            where: sql`${productPerformers.productId} = ${product.id} AND ${productPerformers.performerId} = ${performer.id}`,
          });

          if (!existingRelation) {
            // リレーションを作成
            await db.insert(productPerformers).values({
              productId: product.id,
              performerId: performer.id,
            });
            newRelations++;

            if (newRelations % 50 === 0) {
              console.log(`処理済み: ${newRelations}件のリレーション作成`);
            }
          }
        } catch (error) {
          console.error(`エラー (${performerName}):`, error);
        }
      }
    } catch (error) {
      console.error(`レコード処理エラー:`, error);
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`新規女優: ${newPerformers}件`);
  console.log(`新規リレーション: ${newRelations}件`);
  console.log(`スキップ (女優名なし): ${skipped}件`);
  console.log(`製品が見つからない: ${notFound}件`);
}

migratePerformersFromHtml().catch(console.error).finally(() => process.exit(0));
