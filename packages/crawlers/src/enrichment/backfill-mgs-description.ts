/**
 * MGS description バックフィル
 *
 * 既存のMGS商品のdescriptionが空の場合、
 * 商品ページを再クロールしてdescriptionを取得・更新
 *
 * 使い方:
 *   npx tsx packages/crawlers/src/enrichment/backfill-mgs-description.ts [--limit=1000] [--dry-run]
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import { mgsFetch } from '../lib/proxy-fetch';

interface BackfillStats {
  total: number;
  fetched: number;
  updated: number;
  skipped: number;
  errors: number;
}

const SOURCE_NAME = 'MGS';

/**
 * MGS商品ページからdescriptionを抽出
 */
async function fetchMgsDescription(productId: string): Promise<string | null> {
  const url = `https://www.mgstage.com/product/product_detail/${productId}/`;

  try {
    // Proxy対応のmgsFetchを使用
    const response = await mgsFetch(url);

    if (!response.ok) {
      console.error(`  HTTP ${response['status']} for ${productId}`);
      return null;
    }

    const html = await response['text']();
    const $ = cheerio.load(html);

    // description抽出
    const introText = $('#introduction .introduction').text().trim();
    if (introText && introText.length > 10) {
      return introText;
    }

    return null;
  } catch (error) {
    console.error(`  Fetch error for ${productId}:`, error);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const dryRun = args.includes('--dry-run');

  const limit = limitArg ? parseInt(limitArg.split('=')[1] ?? '1000', 10) : 1000;

  console.log('========================================');
  console.log('=== MGS Description バックフィル ===');
  console.log('========================================');
  console.log(`処理上限: ${limit}`);
  console.log(`ドライラン: ${dryRun ? 'はい' : 'いいえ'}`);
  console.log('========================================\n');

  const db = getDb();
  const stats: BackfillStats = { total: 0, fetched: 0, updated: 0, skipped: 0, errors: 0 };

  // MGSのproduct_sourcesからdescriptionがnullまたは空の商品を取得
  const rows = await db.execute<{
    product_id: number;
    original_product_id: string;
    current_description: string | null;
  }>(sql`
    SELECT
      ps.product_id,
      ps.original_product_id,
      p.description as current_description
    FROM product_sources ps
    JOIN products p ON p.id = ps.product_id
    WHERE ps.asp_name = ${SOURCE_NAME}
      AND (p.description IS NULL OR p.description = '')
    ORDER BY ps.product_id DESC
    LIMIT ${limit}
  `);

  stats.total = rows.rows.length;
  console.log(`📦 MGS商品 ${stats.total}件を処理...\n`);

  for (let i = 0; i < rows.rows.length; i++) {
    const row = rows.rows[i];
    if (!row) continue;

    try {
      const productId = row.original_product_id;

      // レート制限: 1.5秒待機
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // 商品ページからdescriptionを取得
      const description = await fetchMgsDescription(productId);

      if (description) {
        stats.fetched++;

        if (!dryRun) {
          await db.execute(sql`
            UPDATE products
            SET description = ${description},
                updated_at = NOW()
            WHERE id = ${row.product_id}
          `);
          stats.updated++;
        }

        if (stats.fetched <= 10) {
          console.log(`  ✓ ${productId}: ${description.substring(0, 50)}...`);
        } else if (stats.fetched === 11) {
          console.log(`  ... (以降省略)`);
        }
      } else {
        stats.skipped++;
      }

      // 進捗表示
      if ((i + 1) % 100 === 0) {
        console.log(
          `  進捗: ${i + 1}/${stats.total} (取得: ${stats.fetched}, スキップ: ${stats.skipped}, エラー: ${stats.errors})`,
        );
      }
    } catch (error) {
      stats.errors++;
      if (stats.errors <= 5) {
        console.error(`  エラー (product_id=${row.product_id}):`, error);
      }
    }
  }

  // サマリー出力
  console.log('\n========================================');
  console.log('=== 処理結果サマリー ===');
  console.log('========================================');
  console.log(`処理対象: ${stats.total}件`);
  console.log(`取得成功: ${stats.fetched}件`);
  console.log(`DB更新: ${stats.updated}件`);
  console.log(`スキップ: ${stats.skipped}件`);
  console.log(`エラー: ${stats.errors}件`);
  console.log('\n✨ バックフィル完了');
}

main().catch(console.error);
