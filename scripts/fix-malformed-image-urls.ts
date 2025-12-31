/**
 * 不正な画像URLを修正するスクリプト
 *
 * Sentryで検出されたエラー:
 * Invalid src prop (https://www.minnano-av.comp_actress_125_125/009/243194.jpg)
 *
 * 原因: `.com` と `/p_actress` が結合されて `.comp_actress` になっている
 * 正しいURL: https://www.minnano-av.com/p_actress_125_125/...
 *
 * 使い方:
 *   DATABASE_URL="..." npx tsx scripts/fix-malformed-image-urls.ts [--dry-run]
 */

import { Pool } from 'pg';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('=== 不正な画像URL修正スクリプト ===\n');
  console.log(`Dry run: ${dryRun}\n`);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: false,
  });

  try {
    // 1. performer_external_ids テーブルの不正なURLを検索
    console.log('📊 Checking performer_external_ids.external_url...');
    const externalIdsResult = await pool.query(`
      SELECT id, external_url, performer_id
      FROM performer_external_ids
      WHERE external_url LIKE '%minnano-av.comp%'
         OR external_url LIKE '%minnano-av.comactress%'
      LIMIT 100
    `);
    console.log(`  Found ${externalIdsResult.rows.length} malformed URLs`);

    if (externalIdsResult.rows.length > 0) {
      console.log('  Sample malformed URLs:');
      externalIdsResult.rows.slice(0, 5).forEach((row) => {
        console.log(`    ID ${row.id}: ${row.external_url}`);
      });
    }

    // 2. performers テーブルの image_url を検索
    // まずカラムが存在するか確認
    console.log('\n📊 Checking performers table for image columns...');
    const performerColumnsResult = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'performers' AND column_name LIKE '%image%'
    `);
    const performerImageColumns = performerColumnsResult.rows.map(r => r.column_name);
    console.log(`  Image columns found: ${performerImageColumns.join(', ') || 'none'}`);

    let performersResult = { rows: [] as any[] };
    if (performerImageColumns.length > 0) {
      const imageCol = performerImageColumns[0];
      performersResult = await pool.query(`
        SELECT id, name, ${imageCol} as image_url
        FROM performers
        WHERE ${imageCol} LIKE '%minnano-av.comp%'
           OR ${imageCol} LIKE '%minnano-av.comactress%'
        LIMIT 100
      `);
      console.log(`  Found ${performersResult.rows.length} malformed URLs in performers.${imageCol}`);
    }

    // 3. products テーブルの default_thumbnail_url を検索
    console.log('\n📊 Checking products.default_thumbnail_url...');
    const productsResult = await pool.query(`
      SELECT id, title, default_thumbnail_url
      FROM products
      WHERE default_thumbnail_url LIKE '%minnano-av.comp%'
         OR default_thumbnail_url LIKE '%minnano-av.comactress%'
      LIMIT 100
    `);
    console.log(`  Found ${productsResult.rows.length} malformed URLs`);

    // 4. product_sources テーブルの image_url を検索
    console.log('\n📊 Checking product_sources table for image columns...');
    const sourceColumnsResult = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'product_sources' AND column_name LIKE '%image%'
    `);
    const sourceImageColumns = sourceColumnsResult.rows.map(r => r.column_name);
    console.log(`  Image columns found: ${sourceImageColumns.join(', ') || 'none'}`);

    let sourcesResult = { rows: [] as any[] };
    if (sourceImageColumns.length > 0) {
      const imageCol = sourceImageColumns[0];
      sourcesResult = await pool.query(`
        SELECT id, ${imageCol} as image_url
        FROM product_sources
        WHERE ${imageCol} LIKE '%minnano-av.comp%'
           OR ${imageCol} LIKE '%minnano-av.comactress%'
        LIMIT 100
      `);
      console.log(`  Found ${sourcesResult.rows.length} malformed URLs in product_sources.${imageCol}`);
    }

    // 合計
    const totalMalformed =
      externalIdsResult.rows.length +
      performersResult.rows.length +
      productsResult.rows.length +
      sourcesResult.rows.length;

    console.log(`\n📈 Total malformed URLs found: ${totalMalformed}`);

    if (totalMalformed === 0) {
      console.log('\n✅ No malformed URLs found. Nothing to fix.');
      return;
    }

    if (dryRun) {
      console.log('\n🔍 Dry run mode - no changes will be made.');
      console.log('Run without --dry-run to apply fixes.');
      return;
    }

    // 修正を実行
    console.log('\n🔧 Applying fixes...');

    // performer_external_ids
    if (externalIdsResult.rows.length > 0) {
      const updateExternalIds = await pool.query(`
        UPDATE performer_external_ids
        SET external_url = REPLACE(REPLACE(external_url,
          'minnano-av.comp_actress', 'minnano-av.com/p_actress'),
          'minnano-av.comactress', 'minnano-av.com/actress')
        WHERE external_url LIKE '%minnano-av.comp%'
           OR external_url LIKE '%minnano-av.comactress%'
      `);
      console.log(`  Updated ${updateExternalIds.rowCount} rows in performer_external_ids`);
    }

    // performers (if image column exists)
    if (performerImageColumns.length > 0 && performersResult.rows.length > 0) {
      const imageCol = performerImageColumns[0];
      const updatePerformers = await pool.query(`
        UPDATE performers
        SET ${imageCol} = REPLACE(REPLACE(${imageCol},
          'minnano-av.comp_actress', 'minnano-av.com/p_actress'),
          'minnano-av.comactress', 'minnano-av.com/actress')
        WHERE ${imageCol} LIKE '%minnano-av.comp%'
           OR ${imageCol} LIKE '%minnano-av.comactress%'
      `);
      console.log(`  Updated ${updatePerformers.rowCount} rows in performers`);
    }

    // products
    if (productsResult.rows.length > 0) {
      const updateProducts = await pool.query(`
        UPDATE products
        SET default_thumbnail_url = REPLACE(REPLACE(default_thumbnail_url,
          'minnano-av.comp_actress', 'minnano-av.com/p_actress'),
          'minnano-av.comactress', 'minnano-av.com/actress')
        WHERE default_thumbnail_url LIKE '%minnano-av.comp%'
           OR default_thumbnail_url LIKE '%minnano-av.comactress%'
      `);
      console.log(`  Updated ${updateProducts.rowCount} rows in products`);
    }

    // product_sources (if image column exists)
    if (sourceImageColumns.length > 0 && sourcesResult.rows.length > 0) {
      const imageCol = sourceImageColumns[0];
      const updateSources = await pool.query(`
        UPDATE product_sources
        SET ${imageCol} = REPLACE(REPLACE(${imageCol},
          'minnano-av.comp_actress', 'minnano-av.com/p_actress'),
          'minnano-av.comactress', 'minnano-av.com/actress')
        WHERE ${imageCol} LIKE '%minnano-av.comp%'
           OR ${imageCol} LIKE '%minnano-av.comactress%'
      `);
      console.log(`  Updated ${updateSources.rowCount} rows in product_sources`);
    }

    console.log('\n✅ Fixes applied successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
