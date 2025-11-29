/**
 * DUGAのCSVデータを処理して商品を作成するスクリプト
 *
 * raw_csv_dataテーブルに保存されたDUGAのCSVデータを
 * products/product_sourcesテーブルに変換します
 *
 * 使い方:
 * DATABASE_URL="..." npx tsx scripts/process-duga-csv.ts [--limit 1000]
 */

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import { generateDUGALink } from '../lib/affiliate';

const db = getDb();

interface DugaCsvData {
  '商品ID': string;
  'タイトル': string;
  '紹介文'?: string;
  'レーベル名'?: string;
  'メーカー名'?: string;
  'カテゴリ'?: string;
  '価格'?: string;
  'レーベル種別'?: string;
  '出演者'?: string;
  '公開開始日'?: string;
  '商品URL'?: string;
}

interface ProcessStats {
  total: number;
  created: number;
  skipped: number;
  errors: number;
  performersCreated: number;
}

async function processDugaCsv(limit: number) {
  const stats: ProcessStats = {
    total: 0,
    created: 0,
    skipped: 0,
    errors: 0,
    performersCreated: 0,
  };

  console.log('=== DUGA CSV データ処理 ===\n');
  console.log(`設定: limit=${limit}\n`);

  // raw_csv_dataから未処理のDUGAデータを取得
  const rawRecords = await db.execute<{
    id: number;
    product_id: string;
    raw_data: DugaCsvData;
  }>(sql`
    SELECT id, product_id, raw_data
    FROM raw_csv_data
    WHERE source = 'DUGA' AND processed_at IS NULL
    ORDER BY downloaded_at DESC
    LIMIT ${limit}
  `);

  stats.total = rawRecords.rows.length;
  console.log(`未処理レコード: ${stats.total}件\n`);

  if (stats.total === 0) {
    console.log('処理対象のレコードがありません');
    return stats;
  }

  // DUGAサイトタグを取得
  const dugaTagResult = await db.execute<{ id: number }>(sql`
    SELECT id FROM tags WHERE name = 'DUGA' AND category = 'site' LIMIT 1
  `);
  const dugaTagId = dugaTagResult.rows.length > 0 ? dugaTagResult.rows[0].id : null;

  for (const record of rawRecords.rows) {
    const { id, product_id, raw_data } = record;

    try {
      const csvData = raw_data as DugaCsvData;

      const normalizedProductId = csvData['商品ID'] || product_id;
      const title = csvData['タイトル'];
      const description = csvData['紹介文'] || '';
      const price = csvData['価格'] ? parseInt(csvData['価格']) : 0;
      const performerNames = csvData['出演者'] || '';
      const releaseDateStr = csvData['公開開始日'];
      const rawUrl = csvData['商品URL'] || `https://duga.jp/ppv/${normalizedProductId}/`;
      const category = csvData['カテゴリ'];

      // タイトルがない場合はスキップ
      if (!title || title.length < 3) {
        await db.execute(sql`
          UPDATE raw_csv_data SET processed_at = NOW() WHERE id = ${id}
        `);
        stats.skipped++;
        continue;
      }

      // 既存商品チェック
      const existingCheck = await db.execute(sql`
        SELECT p.id FROM products p
        JOIN product_sources ps ON p.id = ps.product_id
        WHERE ps.original_product_id = ${normalizedProductId} AND ps.asp_name = 'DUGA'
        LIMIT 1
      `);

      if (existingCheck.rows.length > 0) {
        await db.execute(sql`
          UPDATE raw_csv_data SET processed_at = NOW() WHERE id = ${id}
        `);
        stats.skipped++;
        continue;
      }

      // 日付パース (format: 2010年01月28日)
      let releaseDate: string | null = null;
      if (releaseDateStr) {
        const match = releaseDateStr.match(/(\d{4})年(\d{2})月(\d{2})日/);
        if (match) {
          releaseDate = `${match[1]}-${match[2]}-${match[3]}`;
        }
      }

      // アフィリエイトURL生成
      const affiliateUrl = generateDUGALink(rawUrl);

      // 商品作成
      const productResult = await db.execute<{ id: number }>(sql`
        INSERT INTO products (normalized_product_id, title, description, release_date)
        VALUES (${normalizedProductId}, ${title}, ${description || null}, ${releaseDate})
        RETURNING id
      `);

      const newProductId = productResult.rows[0].id;

      // product_sources登録
      await db.execute(sql`
        INSERT INTO product_sources (product_id, asp_name, original_product_id, affiliate_url, price, data_source)
        VALUES (${newProductId}, 'DUGA', ${normalizedProductId}, ${affiliateUrl}, ${price || null}, 'CSV')
        ON CONFLICT (product_id, asp_name) DO NOTHING
      `);

      // 出演者を登録 (カンマ区切り)
      if (performerNames && performerNames.trim() !== '') {
        const names = performerNames.split(',').map(n => n.trim()).filter(n => n.length > 0 && n.length < 200);

        for (const name of names) {
          try {
            const performerResult = await db.execute<{ id: number }>(sql`
              INSERT INTO performers (name)
              VALUES (${name})
              ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `);

            const performerId = performerResult.rows[0].id;

            await db.execute(sql`
              INSERT INTO product_performers (product_id, performer_id)
              VALUES (${newProductId}, ${performerId})
              ON CONFLICT DO NOTHING
            `);
            stats.performersCreated++;
          } catch (e) {
            // エラーは無視
          }
        }
      }

      // カテゴリタグを登録
      if (category && category.trim() !== '') {
        try {
          const tagResult = await db.execute<{ id: number }>(sql`
            INSERT INTO tags (name, category)
            VALUES (${category}, 'genre')
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
          `);

          const tagId = tagResult.rows[0].id;

          await db.execute(sql`
            INSERT INTO product_tags (product_id, tag_id)
            VALUES (${newProductId}, ${tagId})
            ON CONFLICT DO NOTHING
          `);
        } catch (e) {
          // エラーは無視
        }
      }

      // DUGAサイトタグを紐付け
      if (dugaTagId) {
        await db.execute(sql`
          INSERT INTO product_tags (product_id, tag_id)
          VALUES (${newProductId}, ${dugaTagId})
          ON CONFLICT DO NOTHING
        `);
      }

      // 処理済みフラグを更新
      await db.execute(sql`
        UPDATE raw_csv_data SET processed_at = NOW() WHERE id = ${id}
      `);

      stats.created++;

      if (stats.created % 500 === 0) {
        console.log(`進捗: ${stats.created}件作成 / ${stats.total}件中`);
      }

    } catch (error) {
      console.error(`  ❌ エラー (${product_id}): ${error}`);
      stats.errors++;
    }
  }

  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  let limit = 5000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
    }
  }

  // 処理前の統計
  const beforeStats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as processed,
      COUNT(CASE WHEN processed_at IS NULL THEN 1 END) as unprocessed
    FROM raw_csv_data
    WHERE source = 'DUGA'
  `);
  console.log('処理前のDUGA CSV統計:');
  console.table(beforeStats.rows);

  const stats = await processDugaCsv(limit);

  console.log('\n=== 処理完了 ===\n');
  console.table(stats);

  // 最終統計
  const afterStats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as processed,
      COUNT(CASE WHEN processed_at IS NULL THEN 1 END) as unprocessed
    FROM raw_csv_data
    WHERE source = 'DUGA'
  `);
  console.log('\n処理後のDUGA CSV統計:');
  console.table(afterStats.rows);

  // product_sourcesの確認
  const productStats = await db.execute(sql`
    SELECT COUNT(DISTINCT product_id) as count FROM product_sources WHERE asp_name = 'DUGA'
  `);
  console.log('\nDUGA商品数:');
  console.table(productStats.rows);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
