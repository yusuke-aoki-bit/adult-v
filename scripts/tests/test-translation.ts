/**
 * 翻訳テストスクリプト（3件のみ）
 *
 * Google Translate APIを使用して、実際に3件のレコードを翻訳してデータベースに保存します。
 */

import { getDb } from '../lib/db';
import { products } from '../lib/db/schema';
import { translateToAll } from '../lib/translate';
import { eq } from 'drizzle-orm';

async function testTranslation() {
  console.log('🧪 翻訳テスト開始（3件のみ）\n');

  const db = getDb();

  // 最初の3件を取得
  const records = await db.select().from(products).limit(3);

  console.log(`テスト対象: ${records.length} 件のレコード\n`);

  for (const [index, record] of records.entries()) {
    console.log(`\n=== レコード ${index + 1}/3 ===`);
    console.log(`ID: ${record.id}`);
    console.log(`元のタイトル: ${record.title}`);

    try {
      // タイトルを翻訳
      console.log('  翻訳中...');
      const translations = await translateToAll(record.title);

      console.log(`  ✓ 英語: ${translations.en}`);
      console.log(`  ✓ 中国語: ${translations.zh}`);
      console.log(`  ✓ 韓国語: ${translations.ko}`);

      // データベースを更新
      await db
        .update(products)
        .set({
          titleEn: translations.en,
          titleZh: translations.zh,
          titleKo: translations.ko,
        })
        .where(eq(products.id, record.id));

      console.log('  ✓ データベース更新完了');

      // レート制限対策
      if (index < records.length - 1) {
        console.log('  ⏳ 1秒待機...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`  ✗ エラー:`, error instanceof Error ? error.message : error);
    }
  }

  console.log('\n\n✅ テスト完了!');
  console.log('\n翻訳後のデータを確認:');

  const updated = await db.select().from(products).limit(3);
  updated.forEach((p, i) => {
    console.log(`\n${i + 1}. ID: ${p.id}`);
    console.log(`   JA: ${p.title}`);
    console.log(`   EN: ${p.titleEn}`);
    console.log(`   ZH: ${p.titleZh}`);
    console.log(`   KO: ${p.titleKo}`);
  });

  process.exit(0);
}

testTranslation();
