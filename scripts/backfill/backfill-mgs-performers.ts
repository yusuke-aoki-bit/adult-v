/**
 * MGS商品に出演者を紐付けるバックフィルスクリプト
 *
 * raw_html_dataからHTMLを取得し、出演者情報をパースして紐付けを行う
 * メモリ効率を考慮してバッチ処理で取得
 */

import { getDb } from '../lib/db';
import { performers, productPerformers } from '../lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import * as cheerio from 'cheerio';

const db = getDb();

// 無効な女優名のパターン
const INVALID_PATTERNS = [
  /^[0-9]+$/,
  /^[a-zA-Z0-9_-]+$/,
  /^素人/,
  /企画/,
  /^他$/,
  /^→/,
  /一覧/,
  /^[ぁ-ん]$/,
  /^[ァ-ヶ]$/,
  /^[一-龯]$/,
];

function isValidPerformerName(name: string): boolean {
  if (!name || name.length < 2) return false;
  if (name.length > 50) return false;

  for (const pattern of INVALID_PATTERNS) {
    if (pattern.test(name)) return false;
  }

  return true;
}

function parsePerformersFromMgsHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const performers: string[] = [];

  // パターン1: 出演者リンク
  $('a[href*="/search/cSearch.php?actress_id="]').each((_, el) => {
    const name = $(el).text().trim();
    if (isValidPerformerName(name)) {
      performers.push(name);
    }
  });

  // パターン2: actress検索リンク
  if (performers.length === 0) {
    $('a[href*="actress="]').each((_, el) => {
      const name = $(el).text().trim();
      if (isValidPerformerName(name)) {
        performers.push(name);
      }
    });
  }

  // パターン3: 出演者テーブルセル
  if (performers.length === 0) {
    $('th:contains("出演"), th:contains("女優")').each((_, th) => {
      $(th).nextAll('td').first().find('a').each((_, el) => {
        const name = $(el).text().trim();
        if (isValidPerformerName(name)) {
          performers.push(name);
        }
      });
    });
  }

  return [...new Set(performers)]; // 重複除去
}

async function findOrCreatePerformer(name: string): Promise<number | null> {
  try {
    let performer = await db.query.performers.findFirst({
      where: eq(performers.name, name),
    });

    if (performer) {
      return performer.id;
    }

    const [newPerformer] = await db
      .insert(performers)
      .values({
        name: name,
        nameKana: null,
      })
      .returning();

    return newPerformer.id;
  } catch (error) {
    const existingPerformer = await db.query.performers.findFirst({
      where: eq(performers.name, name),
    });
    return existingPerformer?.id || null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const totalLimit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '5000');
  const batchSize = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '100');

  console.log('=== MGS 出演者紐付けバックフィル ===\n');
  console.log(`設定: limit=${totalLimit}, batch=${batchSize}\n`);

  let totalProcessed = 0;
  let totalNewRelations = 0;
  let totalNoPerformerInHtml = 0;
  let totalErrors = 0;
  let offset = 0;

  // バッチ処理ループ
  while (totalProcessed < totalLimit) {
    const currentBatchSize = Math.min(batchSize, totalLimit - totalProcessed);

    // 1. 未紐付きMGS商品のIDリストを取得（HTMLなし）
    const unlinkedProductIds = await db.execute(sql`
      SELECT ps.product_id, ps.original_product_id
      FROM product_sources ps
      LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
      WHERE ps.asp_name = 'MGS'
      AND pp.product_id IS NULL
      LIMIT ${currentBatchSize}
      OFFSET ${offset}
    `);

    if (unlinkedProductIds.rows.length === 0) {
      console.log('処理対象の商品がなくなりました。');
      break;
    }

    console.log(`バッチ ${Math.floor(offset / batchSize) + 1}: ${unlinkedProductIds.rows.length}件の商品を処理中...`);

    // 各商品を個別に処理
    for (const row of unlinkedProductIds.rows as any[]) {
      try {
        // HTMLを個別に取得
        const htmlResult = await db.execute(sql`
          SELECT html_content
          FROM raw_html_data
          WHERE product_id = ${row.original_product_id}
          AND source = 'MGS'
          LIMIT 1
        `);

        if (htmlResult.rows.length === 0 || !(htmlResult.rows[0] as any).html_content) {
          totalNoPerformerInHtml++;
          continue;
        }

        const htmlContent = (htmlResult.rows[0] as any).html_content;
        const names = parsePerformersFromMgsHtml(htmlContent);

        if (names.length === 0) {
          totalNoPerformerInHtml++;
          continue;
        }

        for (const name of names) {
          const performerId = await findOrCreatePerformer(name);

          if (!performerId) {
            totalErrors++;
            continue;
          }

          await db
            .insert(productPerformers)
            .values({
              productId: row.product_id,
              performerId: performerId,
            })
            .onConflictDoNothing();

          totalNewRelations++;
        }

        totalProcessed++;

        if (totalProcessed % 100 === 0) {
          console.log(`進捗: ${totalProcessed}/${totalLimit} (紐付け: ${totalNewRelations}件)`);
        }
      } catch (error) {
        totalErrors++;
        console.error(`エラー (product_id: ${row.product_id}):`, error);
      }
    }

    offset += currentBatchSize;

    // メモリを解放
    if (global.gc) {
      global.gc();
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`処理済み: ${totalProcessed}件`);
  console.log(`新規紐付け: ${totalNewRelations}件`);
  console.log(`HTMLなし/出演者なし: ${totalNoPerformerInHtml}件`);
  console.log(`エラー: ${totalErrors}件`);

  // 最終統計
  const stats = await db.execute(sql`
    SELECT
      COUNT(DISTINCT ps.product_id) as total,
      COUNT(DISTINCT CASE WHEN pp.product_id IS NOT NULL THEN ps.product_id END) as with_performer
    FROM product_sources ps
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    WHERE ps.asp_name = 'MGS'
  `);

  console.log('\n=== MGS紐付け状況 ===');
  console.table(stats.rows);

  process.exit(0);
}

main().catch(console.error);
