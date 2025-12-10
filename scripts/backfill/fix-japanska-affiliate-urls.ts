/**
 * Japanska アフィリエイトURL修正バックフィル
 *
 * 16進数変換された間違ったURLを正しいURLに修正
 * 例: https://wlink.golden-gateway.com/id/9512-1-001-84e9/
 *   -> https://wlink.golden-gateway.com/id/9512-1-001-34009/
 */

import { db } from '../../lib/db';
import { sql } from 'drizzle-orm';

const AFFILIATE_ID = '9512-1-001';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limit = parseInt(args.find((arg, i) => args[i - 1] === '--limit') || '10000');

  console.log('=== Japanska アフィリエイトURL修正 ===');
  console.log(`Dry run: ${dryRun}`);
  console.log(`Limit: ${limit}`);

  // Japanskaの全商品ソースを取得
  const result = await db.execute(sql`
    SELECT
      ps.id,
      ps.product_id,
      ps.original_product_id,
      ps.affiliate_url
    FROM product_sources ps
    WHERE ps.asp_name = 'Japanska'
    ORDER BY ps.id
    LIMIT ${limit}
  `);

  console.log(`\n取得件数: ${result.rows.length}\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of result.rows) {
    const id = row.id as number;
    const originalProductId = row.original_product_id as string;
    const currentUrl = row.affiliate_url as string;

    // 正しいURLを生成
    const correctUrl = `https://wlink.golden-gateway.com/id/${AFFILIATE_ID}-${originalProductId}/`;

    // 既に正しい場合はスキップ
    if (currentUrl === correctUrl) {
      skipped++;
      continue;
    }

    console.log(`[${id}] ${originalProductId}: ${currentUrl} -> ${correctUrl}`);

    if (dryRun) {
      updated++;
      continue;
    }

    try {
      await db.execute(sql`
        UPDATE product_sources
        SET affiliate_url = ${correctUrl}
        WHERE id = ${id}
      `);
      updated++;
    } catch (error) {
      console.error(`  ❌ エラー: ${error}`);
      errors++;
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`更新件数: ${updated}`);
  console.log(`スキップ: ${skipped}`);
  console.log(`エラー: ${errors}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
