/**
 * DUGAサンプル画像バックフィル
 *
 * duga_raw_responsesから画像URLを抽出し、product_imagesテーブルを更新
 * /scap/ → /sample/ に変換して拡大画像URLを生成
 */

import { db } from '../../lib/db';
import { sql } from 'drizzle-orm';

const BATCH_SIZE = 100;

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find((arg, i) => args[i - 1] === '--limit') || '1000');
  const dryRun = args.includes('--dry-run');

  console.log('=== DUGA サンプル画像バックフィル ===');
  console.log(`Limit: ${limit}`);
  console.log(`Dry run: ${dryRun}`);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  // DUGAのraw_dataからthumbnailを持つレコードを取得
  const result = await db.execute(sql`
    SELECT
      r.product_id,
      r.raw_data->'thumbnail' as thumbnail,
      p.id as internal_product_id
    FROM duga_raw_responses r
    JOIN product_sources ps ON ps.external_id = r.product_id AND ps.asp_name = 'DUGA'
    JOIN products p ON p.id = ps.product_id
    WHERE r.raw_data->'thumbnail' IS NOT NULL
      AND jsonb_array_length(r.raw_data->'thumbnail') > 0
    ORDER BY r.updated_at DESC
    LIMIT ${limit}
  `);

  console.log(`\n取得レコード数: ${result.rows.length}\n`);

  for (const row of result.rows) {
    processed++;
    const productId = row.internal_product_id as string;
    const dugaProductId = row.product_id as string;
    const thumbnails = row.thumbnail as any[];

    if (!thumbnails || thumbnails.length === 0) {
      skipped++;
      continue;
    }

    // サンプル画像URLを生成 (/scap/ → /sample/)
    const sampleImages: string[] = [];
    for (const thumb of thumbnails) {
      const imageUrl = thumb.large || thumb.midium || thumb.image;
      if (imageUrl) {
        const fullSizeUrl = imageUrl.replace(/\/scap\//, '/sample/');
        sampleImages.push(fullSizeUrl);
      }
    }

    if (sampleImages.length === 0) {
      skipped++;
      continue;
    }

    console.log(`[${processed}/${result.rows.length}] ${dugaProductId}: ${sampleImages.length}枚の画像`);

    if (dryRun) {
      console.log(`  (dry-run) 画像URL例: ${sampleImages[0]}`);
      updated++;
      continue;
    }

    try {
      // 既存の画像を削除
      await db.execute(sql`
        DELETE FROM product_images
        WHERE product_id = ${productId}
        AND asp_name = 'DUGA'
        AND image_type = 'sample'
      `);

      // 新しい画像を挿入
      for (const [imgIndex, imageUrl] of sampleImages.entries()) {
        await db.execute(sql`
          INSERT INTO product_images (
            product_id,
            asp_name,
            image_url,
            image_type,
            display_order
          )
          VALUES (
            ${productId},
            'DUGA',
            ${imageUrl},
            'sample',
            ${imgIndex}
          )
        `);
      }

      updated++;
    } catch (error) {
      console.error(`  ❌ エラー: ${error}`);
      errors++;
    }

    // バッチごとに進捗を表示
    if (processed % BATCH_SIZE === 0) {
      console.log(`\n--- 進捗: ${processed}/${result.rows.length} (更新: ${updated}, スキップ: ${skipped}, エラー: ${errors}) ---\n`);
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`処理件数: ${processed}`);
  console.log(`更新件数: ${updated}`);
  console.log(`スキップ: ${skipped}`);
  console.log(`エラー: ${errors}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
