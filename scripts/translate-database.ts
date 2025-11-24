/**
 * データベース翻訳スクリプト
 *
 * 使用方法:
 * DATABASE_URL="..." npx tsx scripts/translate-database.ts [オプション]
 *
 * オプション:
 * --table <table>       翻訳するテーブル (products, performers, tags, all)
 * --limit <number>      処理する最大レコード数 (デフォルト: 100)
 * --offset <number>     開始位置 (デフォルト: 0)
 * --batch-size <number> バッチサイズ (デフォルト: 10)
 * --dry-run             実際には更新せずに確認のみ
 *
 * 例:
 * npx tsx scripts/translate-database.ts --table products --limit 50
 * npx tsx scripts/translate-database.ts --table performers --dry-run
 * npx tsx scripts/translate-database.ts --table all --limit 1000
 */

import { getDb } from '../lib/db';
import { products, performers, tags } from '../lib/db/schema';
import { translateToAll, delay, chunk } from '../lib/translate';
import { eq, isNull, or, sql } from 'drizzle-orm';

// コマンドライン引数の解析
const args = process.argv.slice(2);
const getArg = (name: string, defaultValue: string | number = ''): string => {
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return String(defaultValue);
};

const tableName = getArg('table', 'all');
const limit = parseInt(getArg('limit', '100'));
const offset = parseInt(getArg('offset', '0'));
const batchSize = parseInt(getArg('batch-size', '10'));
const dryRun = args.includes('--dry-run');

console.log('🌐 データベース翻訳スクリプト');
console.log('============================');
console.log(`テーブル: ${tableName}`);
console.log(`最大レコード数: ${limit}`);
console.log(`開始位置: ${offset}`);
console.log(`バッチサイズ: ${batchSize}`);
console.log(`ドライラン: ${dryRun ? 'はい' : 'いいえ'}`);
console.log('============================\n');

/**
 * Products テーブルの翻訳
 */
async function translateProducts(db: ReturnType<typeof getDb>) {
  console.log('\n📦 Products テーブルを翻訳中...\n');

  // 翻訳が必要なレコードを取得 (title_en, title_zh, title_ko のいずれかがNULL)
  const records = await db
    .select()
    .from(products)
    .where(or(isNull(products.titleEn), isNull(products.titleZh), isNull(products.titleKo)))
    .limit(limit)
    .offset(offset);

  console.log(`翻訳対象: ${records.length} 件のレコード\n`);

  if (records.length === 0) {
    console.log('✅ 翻訳対象のレコードはありません\n');
    return;
  }

  // バッチ処理
  const batches = chunk(records, batchSize);
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const [batchIndex, batch] of batches.entries()) {
    console.log(`\nバッチ ${batchIndex + 1}/${batches.length} (${batch.length} レコード)`);

    for (const record of batch) {
      try {
        processedCount++;
        console.log(`  [${processedCount}/${records.length}] ID: ${record.id} - ${record.title}`);

        // タイトルの翻訳
        const titleTranslations = await translateToAll(record.title);
        console.log(`    ✓ タイトル翻訳完了`);

        // 説明文の翻訳 (存在する場合)
        let descTranslations = { en: null, zh: null, ko: null };
        if (record.description) {
          descTranslations = await translateToAll(record.description);
          console.log(`    ✓ 説明文翻訳完了`);
        }

        // データベース更新
        if (!dryRun) {
          await db
            .update(products)
            .set({
              titleEn: titleTranslations.en,
              titleZh: titleTranslations.zh,
              titleKo: titleTranslations.ko,
              descriptionEn: descTranslations.en || null,
              descriptionZh: descTranslations.zh || null,
              descriptionKo: descTranslations.ko || null,
            })
            .where(eq(products.id, record.id));
          console.log(`    ✓ データベース更新完了`);
        }

        successCount++;
        await delay(100); // レート制限対策
      } catch (error) {
        errorCount++;
        console.error(`    ✗ エラー:`, error instanceof Error ? error.message : error);
      }
    }

    // バッチ間の待機
    if (batchIndex < batches.length - 1) {
      console.log(`  ⏳ 次のバッチまで2秒待機...`);
      await delay(2000);
    }
  }

  console.log(`\n✅ Products 翻訳完了: 成功 ${successCount} / エラー ${errorCount} / 合計 ${processedCount}\n`);
}

/**
 * Performers テーブルの翻訳
 */
async function translatePerformers(db: ReturnType<typeof getDb>) {
  console.log('\n👤 Performers テーブルを翻訳中...\n');

  const records = await db
    .select()
    .from(performers)
    .where(or(isNull(performers.nameEn), isNull(performers.nameZh), isNull(performers.nameKo)))
    .limit(limit)
    .offset(offset);

  console.log(`翻訳対象: ${records.length} 件のレコード\n`);

  if (records.length === 0) {
    console.log('✅ 翻訳対象のレコードはありません\n');
    return;
  }

  const batches = chunk(records, batchSize);
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const [batchIndex, batch] of batches.entries()) {
    console.log(`\nバッチ ${batchIndex + 1}/${batches.length} (${batch.length} レコード)`);

    for (const record of batch) {
      try {
        processedCount++;
        console.log(`  [${processedCount}/${records.length}] ID: ${record.id} - ${record.name}`);

        // 名前の翻訳
        const nameTranslations = await translateToAll(record.name);
        console.log(`    ✓ 名前翻訳完了`);

        // データベース更新
        if (!dryRun) {
          await db
            .update(performers)
            .set({
              nameEn: nameTranslations.en,
              nameZh: nameTranslations.zh,
              nameKo: nameTranslations.ko,
            })
            .where(eq(performers.id, record.id));
          console.log(`    ✓ データベース更新完了`);
        }

        successCount++;
        await delay(100);
      } catch (error) {
        errorCount++;
        console.error(`    ✗ エラー:`, error instanceof Error ? error.message : error);
      }
    }

    if (batchIndex < batches.length - 1) {
      console.log(`  ⏳ 次のバッチまで2秒待機...`);
      await delay(2000);
    }
  }

  console.log(`\n✅ Performers 翻訳完了: 成功 ${successCount} / エラー ${errorCount} / 合計 ${processedCount}\n`);
}

/**
 * Tags テーブルの翻訳
 */
async function translateTags(db: ReturnType<typeof getDb>) {
  console.log('\n🏷️  Tags テーブルを翻訳中...\n');

  const records = await db
    .select()
    .from(tags)
    .where(or(isNull(tags.nameEn), isNull(tags.nameZh), isNull(tags.nameKo)))
    .limit(limit)
    .offset(offset);

  console.log(`翻訳対象: ${records.length} 件のレコード\n`);

  if (records.length === 0) {
    console.log('✅ 翻訳対象のレコードはありません\n');
    return;
  }

  const batches = chunk(records, batchSize);
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const [batchIndex, batch] of batches.entries()) {
    console.log(`\nバッチ ${batchIndex + 1}/${batches.length} (${batch.length} レコード)`);

    for (const record of batch) {
      try {
        processedCount++;
        console.log(`  [${processedCount}/${records.length}] ID: ${record.id} - ${record.name}`);

        // タグ名の翻訳
        const nameTranslations = await translateToAll(record.name);
        console.log(`    ✓ タグ名翻訳完了`);

        // データベース更新
        if (!dryRun) {
          await db
            .update(tags)
            .set({
              nameEn: nameTranslations.en,
              nameZh: nameTranslations.zh,
              nameKo: nameTranslations.ko,
            })
            .where(eq(tags.id, record.id));
          console.log(`    ✓ データベース更新完了`);
        }

        successCount++;
        await delay(100);
      } catch (error) {
        errorCount++;
        console.error(`    ✗ エラー:`, error instanceof Error ? error.message : error);
      }
    }

    if (batchIndex < batches.length - 1) {
      console.log(`  ⏳ 次のバッチまで2秒待機...`);
      await delay(2000);
    }
  }

  console.log(`\n✅ Tags 翻訳完了: 成功 ${successCount} / エラー ${errorCount} / 合計 ${processedCount}\n`);
}

/**
 * メイン処理
 */
async function main() {
  try {
    const db = getDb();

    switch (tableName.toLowerCase()) {
      case 'products':
        await translateProducts(db);
        break;
      case 'performers':
        await translatePerformers(db);
        break;
      case 'tags':
        await translateTags(db);
        break;
      case 'all':
        await translateProducts(db);
        await translatePerformers(db);
        await translateTags(db);
        break;
      default:
        console.error(`❌ 不明なテーブル名: ${tableName}`);
        console.error('使用可能なテーブル: products, performers, tags, all');
        process.exit(1);
    }

    console.log('\n🎉 翻訳処理が完了しました!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

main();
