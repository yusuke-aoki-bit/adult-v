/**
 * 既存の商品・タグ・出演者の翻訳をバックフィルするスクリプト
 * DeepL APIを使用
 *
 * 使い方:
 *   npx tsx scripts/backfill/backfill-translations.ts [--limit=N] [--type=products|performers|tags]
 *
 * 環境変数:
 *   DEEPL_API_KEY - DeepL APIキー
 */

import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '../crawlers/lib/db/index.js';
import { translateBatch, translateToAll, delay } from '../shared/lib/translate.js';

const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const typeArg = args.find(arg => arg.startsWith('--type='));

const BATCH_SIZE = parseInt(limitArg?.split('=')[1] || '100');
const TYPE = typeArg?.split('=')[1] || 'all';

// DeepLのレート制限対策（Free版は文字数制限があるため余裕を持つ）
const DELAY_MS = 300;

async function translateProducts(db: ReturnType<typeof getDb>, limit: number) {
  console.log(`\n📦 商品の翻訳を開始 (最大${limit}件)`);

  // 翻訳されていない商品を取得
  const products = await db.execute(sql`
    SELECT id, title, description
    FROM products
    WHERE title_en IS NULL AND title IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  console.log(`  → ${products.rows.length}件の未翻訳商品を発見`);

  let translated = 0;
  let failed = 0;

  for (const product of products.rows) {
    const { id, title, description } = product as { id: number; title: string; description?: string };

    try {
      // タイトルを3言語に翻訳
      const titleTranslations = await translateToAll(title);

      // 説明文があれば翻訳
      let descTranslations = { en: '', zh: '', ko: '' };
      if (description) {
        await delay(DELAY_MS);
        descTranslations = await translateToAll(description);
      }

      await db.execute(sql`
        UPDATE products
        SET
          title_en = ${titleTranslations.en || null},
          title_zh = ${titleTranslations.zh || null},
          title_ko = ${titleTranslations.ko || null},
          description_en = ${descTranslations.en || null},
          description_zh = ${descTranslations.zh || null},
          description_ko = ${descTranslations.ko || null},
          updated_at = NOW()
        WHERE id = ${id}
      `);
      translated++;

      if (translated % 10 === 0) {
        console.log(`    ✅ ${translated}件完了 (ID: ${id})`);
      }

      // レート制限対策
      await delay(DELAY_MS);

    } catch (error: unknown) {
      console.error(`    ❌ ID ${id}: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  console.log(`  📊 結果: ${translated}件成功, ${failed}件失敗`);
  return { translated, failed };
}

async function translatePerformers(db: ReturnType<typeof getDb>, limit: number) {
  console.log(`\n👤 出演者の翻訳を開始 (最大${limit}件)`);

  // 翻訳されていない出演者を取得
  const performers = await db.execute(sql`
    SELECT id, name
    FROM performers
    WHERE name_en IS NULL AND name IS NOT NULL
    ORDER BY product_count DESC NULLS LAST
    LIMIT ${limit}
  `);

  console.log(`  → ${performers.rows.length}件の未翻訳出演者を発見`);

  let translated = 0;
  let failed = 0;

  // バッチ処理で効率化
  const names = performers.rows.map((p: unknown) => (p as { name: string }).name);
  const languages = ['en', 'zh', 'ko'] as const;

  for (const lang of languages) {
    try {
      console.log(`    🔄 ${lang}翻訳中...`);
      const translations = await translateBatch(names, lang, 'ja');

      for (let i = 0; i < translations.length; i++) {
        const performer = performers.rows[i] as { id: number; name: string };
        const translatedName = translations[i];

        if (translatedName) {
          const updateQuery = lang === 'en'
            ? sql`UPDATE performers SET name_en = ${translatedName}, updated_at = NOW() WHERE id = ${performer.id}`
            : lang === 'zh'
            ? sql`UPDATE performers SET name_zh = ${translatedName}, updated_at = NOW() WHERE id = ${performer.id}`
            : sql`UPDATE performers SET name_ko = ${translatedName}, updated_at = NOW() WHERE id = ${performer.id}`;

          await db.execute(updateQuery);
          translated++;
        }
      }

      // レート制限対策
      await delay(DELAY_MS * 2);

    } catch (error: unknown) {
      console.error(`    ❌ ${lang}翻訳エラー: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  console.log(`  📊 結果: ${translated}件の翻訳を適用`);
  return { translated, failed };
}

async function translateTags(db: ReturnType<typeof getDb>, limit: number) {
  console.log(`\n🏷️ タグの翻訳を開始 (最大${limit}件)`);

  // 翻訳されていないタグを取得
  const tags = await db.execute(sql`
    SELECT id, name
    FROM tags
    WHERE name_en IS NULL AND name IS NOT NULL
    ORDER BY id
    LIMIT ${limit}
  `);

  console.log(`  → ${tags.rows.length}件の未翻訳タグを発見`);

  let translated = 0;
  let failed = 0;

  // バッチ処理で効率化
  const names = tags.rows.map((t: unknown) => (t as { name: string }).name);
  const languages = ['en', 'zh', 'ko'] as const;

  for (const lang of languages) {
    try {
      console.log(`    🔄 ${lang}翻訳中...`);
      const translations = await translateBatch(names, lang, 'ja');

      for (let i = 0; i < translations.length; i++) {
        const tag = tags.rows[i] as { id: number; name: string };
        const translatedName = translations[i];

        if (translatedName) {
          const updateQuery = lang === 'en'
            ? sql`UPDATE tags SET name_en = ${translatedName}, updated_at = NOW() WHERE id = ${tag.id}`
            : lang === 'zh'
            ? sql`UPDATE tags SET name_zh = ${translatedName}, updated_at = NOW() WHERE id = ${tag.id}`
            : sql`UPDATE tags SET name_ko = ${translatedName}, updated_at = NOW() WHERE id = ${tag.id}`;

          await db.execute(updateQuery);
          translated++;
        }
      }

      // レート制限対策
      await delay(DELAY_MS * 2);

    } catch (error: unknown) {
      console.error(`    ❌ ${lang}翻訳エラー: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  console.log(`  📊 結果: ${translated}件の翻訳を適用`);
  return { translated, failed };
}

async function main() {
  // 環境変数チェック
  if (!process.env.DEEPL_API_KEY) {
    console.error('❌ DEEPL_API_KEY環境変数が設定されていません');
    process.exit(1);
  }

  console.log('🌐 翻訳バックフィル開始 (DeepL API)');
  console.log(`  設定: type=${TYPE}, limit=${BATCH_SIZE}`);

  const db = getDb();

  try {
    // 現在の翻訳状況を確認
    const stats = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM products WHERE title_en IS NOT NULL) as products_translated,
        (SELECT COUNT(*) FROM products) as products_total,
        (SELECT COUNT(*) FROM performers WHERE name_en IS NOT NULL) as performers_translated,
        (SELECT COUNT(*) FROM performers) as performers_total,
        (SELECT COUNT(*) FROM tags WHERE name_en IS NOT NULL) as tags_translated,
        (SELECT COUNT(*) FROM tags) as tags_total
    `);
    console.log('\n📊 現在の翻訳状況:');
    console.table(stats.rows);

    const results = {
      products: { translated: 0, failed: 0 },
      performers: { translated: 0, failed: 0 },
      tags: { translated: 0, failed: 0 },
    };

    if (TYPE === 'all' || TYPE === 'products') {
      results.products = await translateProducts(db, BATCH_SIZE);
    }

    if (TYPE === 'all' || TYPE === 'performers') {
      results.performers = await translatePerformers(db, BATCH_SIZE);
    }

    if (TYPE === 'all' || TYPE === 'tags') {
      results.tags = await translateTags(db, BATCH_SIZE);
    }

    // 最終状況を確認
    const finalStats = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM products WHERE title_en IS NOT NULL) as products_translated,
        (SELECT COUNT(*) FROM products) as products_total,
        (SELECT COUNT(*) FROM performers WHERE name_en IS NOT NULL) as performers_translated,
        (SELECT COUNT(*) FROM performers) as performers_total,
        (SELECT COUNT(*) FROM tags WHERE name_en IS NOT NULL) as tags_translated,
        (SELECT COUNT(*) FROM tags) as tags_total
    `);
    console.log('\n📊 翻訳後の状況:');
    console.table(finalStats.rows);

    console.log('\n✅ 翻訳バックフィル完了');
  } finally {
    await closeDb();
  }
}

main().catch(e => {
  console.error('❌ エラー:', e);
  process.exit(1);
});
