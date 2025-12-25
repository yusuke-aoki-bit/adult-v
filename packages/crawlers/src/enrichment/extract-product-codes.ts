/**
 * 品番抽出バッチクローラー
 *
 * 既存商品データから品番（メーカー品番）を抽出し、productsテーブルのmaker_product_codeを更新
 *
 * 対象ASP:
 * - FANZA: cidから変換 (ssis00865 → SSIS-865)
 * - MGS: originalProductIdがそのまま品番
 * - DUGA: 商品ページからスクレイピング
 *
 * 使い方:
 *   npx tsx packages/crawlers/src/enrichment/extract-product-codes.ts [--asp=fanza|mgs|duga|all] [--limit=1000] [--dry-run]
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import { normalizeProductCode, extractProductCodeFromFanzaCid } from '../lib/product-code-utils';
import { scrapeDugaProductPage } from '../lib/providers/duga-page-scraper';

interface ExtractStats {
  total: number;
  extracted: number;
  updated: number;
  skipped: number;
  errors: number;
}

const ASP_PROCESSORS: Record<string, (db: ReturnType<typeof getDb>, limit: number, dryRun: boolean) => Promise<ExtractStats>> = {
  fanza: extractFanzaCodes,
  mgs: extractMgsCodes,
  duga: extractDugaCodes,
};

async function main() {
  const args = process.argv.slice(2);
  const aspArg = args.find(arg => arg.startsWith('--asp='));
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const dryRun = args.includes('--dry-run');

  const targetAsp = aspArg ? aspArg.split('=')[1].toLowerCase() : 'all';
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 1000;

  console.log('========================================');
  console.log('=== 品番抽出バッチクローラー ===');
  console.log('========================================');
  console.log(`対象ASP: ${targetAsp}`);
  console.log(`処理上限: ${limit}`);
  console.log(`ドライラン: ${dryRun ? 'はい' : 'いいえ'}`);
  console.log('========================================\n');

  const db = getDb();

  // マイグレーション: maker_product_codeカラムがなければ追加
  try {
    await db.execute(sql`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS maker_product_code VARCHAR(50)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_products_maker_code ON products(maker_product_code)
    `);
    console.log('✅ DBスキーマ確認完了\n');
  } catch (error) {
    console.log('✅ DBスキーマ既存\n');
  }

  const results: Record<string, ExtractStats> = {};

  if (targetAsp === 'all') {
    for (const [asp, processor] of Object.entries(ASP_PROCESSORS)) {
      console.log(`\n--- ${asp.toUpperCase()} ---`);
      results[asp] = await processor(db, limit, dryRun);
    }
  } else if (ASP_PROCESSORS[targetAsp]) {
    results[targetAsp] = await ASP_PROCESSORS[targetAsp](db, limit, dryRun);
  } else {
    console.error(`未知のASP: ${targetAsp}`);
    console.error('利用可能: fanza, mgs, duga, all');
    process.exit(1);
  }

  // サマリー出力
  console.log('\n========================================');
  console.log('=== 処理結果サマリー ===');
  console.log('========================================');
  for (const [asp, stats] of Object.entries(results)) {
    console.log(`\n${asp.toUpperCase()}:`);
    console.log(`  処理対象: ${stats.total}件`);
    console.log(`  品番抽出: ${stats.extracted}件`);
    console.log(`  DB更新: ${stats.updated}件`);
    console.log(`  スキップ: ${stats.skipped}件`);
    console.log(`  エラー: ${stats.errors}件`);
  }

  console.log('\n✨ 品番抽出完了');
}

/**
 * FANZAの品番抽出
 * cidから品番を変換
 */
async function extractFanzaCodes(
  db: ReturnType<typeof getDb>,
  limit: number,
  dryRun: boolean
): Promise<ExtractStats> {
  const stats: ExtractStats = { total: 0, extracted: 0, updated: 0, skipped: 0, errors: 0 };

  // FANZAのproduct_sourcesからmaker_product_codeがnullの商品を取得
  const rows = await db.execute<{
    product_id: number;
    original_product_id: string;
    current_code: string | null;
  }>(sql`
    SELECT
      ps.product_id,
      ps.original_product_id,
      p.maker_product_code as current_code
    FROM product_sources ps
    JOIN products p ON p.id = ps.product_id
    WHERE ps.asp_name = 'FANZA'
      AND p.maker_product_code IS NULL
    LIMIT ${limit}
  `);

  stats.total = rows.rows.length;
  console.log(`📦 FANZA商品 ${stats.total}件を処理...`);

  for (const row of rows.rows) {
    try {
      const cid = row.original_product_id;
      const productCode = extractProductCodeFromFanzaCid(cid);

      if (productCode) {
        stats.extracted++;

        if (!dryRun) {
          await db.execute(sql`
            UPDATE products
            SET maker_product_code = ${productCode},
                updated_at = NOW()
            WHERE id = ${row.product_id}
          `);
          stats.updated++;
        }

        if (stats.extracted <= 10) {
          console.log(`  ${cid} → ${productCode}`);
        }
      } else {
        stats.skipped++;
      }
    } catch (error) {
      stats.errors++;
      console.error(`  エラー (product_id=${row.product_id}):`, error);
    }
  }

  return stats;
}

/**
 * MGSの品番抽出
 * originalProductIdがそのまま品番
 */
async function extractMgsCodes(
  db: ReturnType<typeof getDb>,
  limit: number,
  dryRun: boolean
): Promise<ExtractStats> {
  const stats: ExtractStats = { total: 0, extracted: 0, updated: 0, skipped: 0, errors: 0 };

  const rows = await db.execute<{
    product_id: number;
    original_product_id: string;
    current_code: string | null;
  }>(sql`
    SELECT
      ps.product_id,
      ps.original_product_id,
      p.maker_product_code as current_code
    FROM product_sources ps
    JOIN products p ON p.id = ps.product_id
    WHERE ps.asp_name = 'MGS'
      AND p.maker_product_code IS NULL
    LIMIT ${limit}
  `);

  stats.total = rows.rows.length;
  console.log(`📦 MGS商品 ${stats.total}件を処理...`);

  for (const row of rows.rows) {
    try {
      const originalId = row.original_product_id;
      const productCode = normalizeProductCode(originalId);

      if (productCode) {
        stats.extracted++;

        if (!dryRun) {
          await db.execute(sql`
            UPDATE products
            SET maker_product_code = ${productCode},
                updated_at = NOW()
            WHERE id = ${row.product_id}
          `);
          stats.updated++;
        }

        if (stats.extracted <= 10) {
          console.log(`  ${originalId} → ${productCode}`);
        }
      } else {
        stats.skipped++;
      }
    } catch (error) {
      stats.errors++;
      console.error(`  エラー (product_id=${row.product_id}):`, error);
    }
  }

  return stats;
}

/**
 * DUGAの品番抽出
 * 商品ページからスクレイピング
 */
async function extractDugaCodes(
  db: ReturnType<typeof getDb>,
  limit: number,
  dryRun: boolean
): Promise<ExtractStats> {
  const stats: ExtractStats = { total: 0, extracted: 0, updated: 0, skipped: 0, errors: 0 };

  const rows = await db.execute<{
    product_id: number;
    original_product_id: string;
    current_code: string | null;
  }>(sql`
    SELECT
      ps.product_id,
      ps.original_product_id,
      p.maker_product_code as current_code
    FROM product_sources ps
    JOIN products p ON p.id = ps.product_id
    WHERE ps.asp_name = 'DUGA'
      AND p.maker_product_code IS NULL
    LIMIT ${limit}
  `);

  stats.total = rows.rows.length;
  console.log(`📦 DUGA商品 ${stats.total}件を処理...`);

  for (const row of rows.rows) {
    try {
      const dugaProductId = row.original_product_id;

      // 商品ページをスクレイピング
      const pageData = await scrapeDugaProductPage(dugaProductId);

      if (pageData.makerProductCode) {
        const productCode = normalizeProductCode(pageData.makerProductCode);

        if (productCode) {
          stats.extracted++;

          if (!dryRun) {
            await db.execute(sql`
              UPDATE products
              SET maker_product_code = ${productCode},
                  updated_at = NOW()
              WHERE id = ${row.product_id}
            `);
            stats.updated++;
          }

          if (stats.extracted <= 10) {
            console.log(`  ${dugaProductId} → ${productCode}`);
          }
        } else {
          stats.skipped++;
        }
      } else {
        stats.skipped++;
      }

      // レート制限: 1秒待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      stats.errors++;
      if (stats.errors <= 5) {
        console.error(`  エラー (product_id=${row.product_id}):`, error);
      }
    }
  }

  return stats;
}

main().catch(console.error);
