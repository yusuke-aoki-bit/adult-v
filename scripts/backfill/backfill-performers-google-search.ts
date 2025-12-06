/**
 * Google Search APIを使用して女優名未取得の商品に女優名を補完
 *
 * 使い方:
 * npx tsx scripts/backfill/backfill-performers-google-search.ts [--limit 100] [--dry-run] [--asp MGS]
 *
 * オプション:
 * --limit N: 処理件数制限（デフォルト: 100）
 * --dry-run: 実際には保存せず結果を表示
 * --asp NAME: 特定のASPのみ処理（MGS, DUGA, DTI, FC2, Japanska, b10f）
 */

import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';
import { searchPerformerByProductCode } from '../../lib/google-apis';
import { isValidPerformerName, normalizePerformerName } from '../../lib/performer-validation';

interface ProductWithoutPerformers {
  productId: number;
  normalizedProductId: string;
  title: string;
  aspName: string;
  originalProductId: string;
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const aspArg = args.find(arg => arg.startsWith('--asp='));
  const dryRun = args.includes('--dry-run');

  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 100;
  const aspFilter = aspArg ? aspArg.split('=')[1] : null;

  console.log('=== Google Search APIによる女優名補完 ===\n');
  console.log(`処理件数: ${limit}`);
  console.log(`ASPフィルタ: ${aspFilter || '全て'}`);
  console.log(`Dry Run: ${dryRun ? 'はい' : 'いいえ'}\n`);

  const db = getDb();

  // 女優名が紐付いていない商品を取得
  const aspCondition = aspFilter ? sql`AND ps.asp_name = ${aspFilter}` : sql``;

  const productsWithoutPerformers = await db.execute(sql`
    SELECT
      p.id as product_id,
      p.normalized_product_id,
      p.title,
      ps.asp_name,
      ps.original_product_id
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    WHERE pp.product_id IS NULL
    ${aspCondition}
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `);

  console.log(`女優名未取得の商品: ${productsWithoutPerformers.rows.length}件\n`);

  if (productsWithoutPerformers.rows.length === 0) {
    console.log('処理対象の商品がありません。');
    process.exit(0);
  }

  const stats = {
    processed: 0,
    found: 0,
    saved: 0,
    errors: 0,
    apiCalls: 0,
  };

  for (const row of productsWithoutPerformers.rows as ProductWithoutPerformers[]) {
    stats.processed++;

    console.log(`[${stats.processed}/${productsWithoutPerformers.rows.length}] ${row.originalProductId}`);
    console.log(`  タイトル: ${row.title.substring(0, 50)}...`);

    try {
      // Google Search APIで検索
      stats.apiCalls++;
      const performers = await searchPerformerByProductCode(row.originalProductId);

      if (performers.length === 0) {
        console.log(`  ❌ 女優名が見つかりませんでした\n`);
        continue;
      }

      console.log(`  ✅ 検出された女優名: ${performers.join(', ')}`);
      stats.found++;

      // バリデーションを通過した名前のみ保存
      const validPerformers: string[] = [];
      for (const name of performers) {
        const normalized = normalizePerformerName(name);
        if (normalized && isValidPerformerName(normalized)) {
          validPerformers.push(normalized);
        }
      }

      if (validPerformers.length === 0) {
        console.log(`  ⚠️ バリデーション後に有効な女優名がありません\n`);
        continue;
      }

      console.log(`  ✓ 有効な女優名: ${validPerformers.join(', ')}`);

      if (!dryRun) {
        // 女優をperformersテーブルに追加（存在しなければ）
        for (const performerName of validPerformers) {
          const performerResult = await db.execute(sql`
            INSERT INTO performers (name)
            VALUES (${performerName})
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
          `);

          const performerId = (performerResult.rows[0] as any).id;

          // product_performersにリレーション作成
          await db.execute(sql`
            INSERT INTO product_performers (product_id, performer_id)
            VALUES (${row.productId}, ${performerId})
            ON CONFLICT DO NOTHING
          `);
        }

        console.log(`  💾 保存完了 (${validPerformers.length}人)`);
        stats.saved += validPerformers.length;
      } else {
        console.log(`  [DRY RUN] 保存スキップ`);
      }

      console.log();

      // レート制限対策: 1秒待機
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      console.error(`  ❌ エラー: ${error.message}\n`);
      stats.errors++;
    }
  }

  console.log('\n=== 処理完了 ===\n');
  console.log('統計情報:');
  console.table(stats);

  // 残りの未取得商品数を確認
  const remainingCount = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM products p
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    WHERE pp.product_id IS NULL
  `);

  console.log(`\n残りの女優名未取得商品: ${(remainingCount.rows[0] as any).count}件`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
