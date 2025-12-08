/**
 * FC2の無効なレコード（トップページにリダイレクトされたもの）を削除するスクリプト
 *
 * 削除対象:
 * - タイトルが「FC2動画アダルト」「FC2コンテンツマーケット」などのトップページタイトル
 * - タイトルが極端に短い（5文字未満）
 * - 説明文がトップページの汎用説明文
 */

import { db } from '../../lib/db/index.js';
import { products, productSources, productImages, productVideos, productPerformers, productTags, rawData } from '../../lib/db/schema.js';
import { eq, and, like, or, sql, inArray, lt, isNull } from 'drizzle-orm';

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '100');

// 無効なタイトルパターン
const INVALID_TITLE_PATTERNS = [
  'FC2動画アダルト',
  'FC2コンテンツマーケット',
  'FC2 コンテンツマーケット',
  'アダルト 有料アダルト動画',
  'FC2動画 - アダルト',
];

// 無効な説明文パターン
const INVALID_DESCRIPTION_PATTERNS = [
  'FC2が運営するアダルト動画の販売サイト',
  'FC2コンテンツマーケットで販売中',
  'お気に入りのFC2動画を',
];

async function findInvalidFC2Records() {
  console.log('🔍 FC2の無効なレコードを検索中...\n');

  // 生SQLでクエリ
  const result = await db.execute(sql`
    SELECT
      p.id as product_id,
      p.title,
      p.description,
      ps.id as source_id,
      ps.original_id,
      ps.asp_name
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'FC2'
    AND (
      p.title LIKE '%FC2動画アダルト%'
      OR p.title LIKE '%FC2コンテンツマーケット%'
      OR p.title LIKE '%FC2 コンテンツマーケット%'
      OR p.title LIKE '%アダルト 有料アダルト動画%'
      OR p.title LIKE '%FC2動画 - アダルト%'
      OR p.description LIKE '%FC2が運営するアダルト動画の販売サイト%'
      OR p.description LIKE '%FC2コンテンツマーケットで販売中%'
      OR LENGTH(p.title) < 5
      OR p.title IS NULL
      OR p.title = ''
    )
    LIMIT ${LIMIT}
  `);

  return result.rows.map((row: any) => ({
    productId: row.product_id,
    title: row.title,
    description: row.description,
    sourceId: row.source_id,
    originalId: row.original_id,
    aspName: row.asp_name,
  }));
}

async function deleteProduct(productId: number) {
  // 関連データを削除（外部キー制約の順番に注意）
  await db.delete(productImages).where(eq(productImages.productId, productId));
  await db.delete(productVideos).where(eq(productVideos.productId, productId));
  await db.delete(productPerformers).where(eq(productPerformers.productId, productId));
  await db.delete(productTags).where(eq(productTags.productId, productId));
  await db.delete(productSources).where(eq(productSources.productId, productId));

  // raw_dataの関連も削除
  await db.execute(sql`
    UPDATE raw_data SET product_id = NULL WHERE product_id = ${productId}
  `);

  // 最後に商品を削除
  await db.delete(products).where(eq(products.id, productId));
}

async function main() {
  console.log('='.repeat(60));
  console.log('FC2 無効レコード クリーンアップスクリプト');
  console.log('='.repeat(60));
  console.log(`モード: ${DRY_RUN ? 'DRY RUN (削除しない)' : '実行'}`);
  console.log(`処理上限: ${LIMIT}件`);
  console.log('');

  const invalidRecords = await findInvalidFC2Records();

  console.log(`\n📊 検出された無効レコード: ${invalidRecords.length}件\n`);

  if (invalidRecords.length === 0) {
    console.log('✅ 無効なレコードは見つかりませんでした');
    return;
  }

  // サンプル表示
  console.log('サンプル（最初の10件）:');
  console.log('-'.repeat(60));
  for (const record of invalidRecords.slice(0, 10)) {
    console.log(`  ID: ${record.productId}`);
    console.log(`  Original ID: ${record.originalId}`);
    console.log(`  タイトル: ${record.title?.substring(0, 50) || '(空)'}`);
    console.log(`  説明: ${record.description?.substring(0, 50) || '(空)'}`);
    console.log('-'.repeat(60));
  }

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUNモードのため、削除は実行されません');
    console.log('実際に削除するには --dry-run オプションを外して実行してください');
    return;
  }

  console.log('\n🗑️  削除を開始します...\n');

  let deleted = 0;
  let errors = 0;

  for (const record of invalidRecords) {
    try {
      await deleteProduct(record.productId);
      deleted++;
      console.log(`  ✅ 削除: ${record.originalId} (${record.title?.substring(0, 30) || '(空)'})`);
    } catch (error) {
      errors++;
      console.error(`  ❌ エラー: ${record.originalId}`, error);
    }

    // 進捗表示
    if ((deleted + errors) % 100 === 0) {
      console.log(`\n  進捗: ${deleted + errors}/${invalidRecords.length} (削除: ${deleted}, エラー: ${errors})\n`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('完了');
  console.log('='.repeat(60));
  console.log(`  削除成功: ${deleted}件`);
  console.log(`  エラー: ${errors}件`);
}

main().catch(console.error).finally(() => process.exit(0));
