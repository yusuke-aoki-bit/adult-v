/**
 * 既存の商品・タグ・出演者の翻訳をバックフィルするスクリプト
 *
 * 使い方:
 *   npx tsx scripts/backfill/backfill-translations.ts [--limit=N] [--type=products|performers|tags]
 */

import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';
import { translateProduct, translateBatch } from '../../lib/google-apis';

const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const typeArg = args.find(arg => arg.startsWith('--type='));

const BATCH_SIZE = parseInt(limitArg?.split('=')[1] || '100');
const TYPE = typeArg?.split('=')[1] || 'all';

// レート制限対策: 翻訳APIは100リクエスト/秒程度
const DELAY_MS = 500;

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
      const translation = await translateProduct(title, description || undefined);

      if (translation) {
        await db.execute(sql`
          UPDATE products
          SET
            title_en = ${translation.en?.title || null},
            title_zh = ${translation.zh?.title || null},
            title_ko = ${translation.ko?.title || null},
            description_en = ${translation.en?.description || null},
            description_zh = ${translation.zh?.description || null},
            description_ko = ${translation.ko?.description || null},
            updated_at = NOW()
          WHERE id = ${id}
        `);
        translated++;

        if (translated % 10 === 0) {
          console.log(`    ✅ ${translated}件完了 (ID: ${id})`);
        }
      } else {
        failed++;
      }

      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));

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
  const names = performers.rows.map((p: { name: string }) => p.name);
  const languages = ['en', 'zh', 'ko'] as const;

  for (const lang of languages) {
    try {
      const translations = await translateBatch(names, lang, 'ja');

      if (translations) {
        for (let i = 0; i < translations.length; i++) {
          const performer = performers.rows[i] as { id: number; name: string };
          const translatedName = translations[i]?.translatedText;

          if (translatedName) {
            const column = `name_${lang}`;
            await db.execute(sql.raw(`
              UPDATE performers
              SET ${column} = $1, updated_at = NOW()
              WHERE id = $2
            `).bind([translatedName, performer.id]));
          }
        }
      }

      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));

    } catch (error: unknown) {
      console.error(`    ❌ ${lang}翻訳エラー: ${error instanceof Error ? error.message : error}`);
    }
  }

  // 結果確認
  const result = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM performers
    WHERE name_en IS NOT NULL
  `);
  translated = Number((result.rows[0] as { count: number }).count);

  console.log(`  📊 結果: ${translated}件の出演者が翻訳済み`);
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
  const names = tags.rows.map((t: { name: string }) => t.name);
  const languages = ['en', 'zh', 'ko'] as const;

  for (const lang of languages) {
    try {
      const translations = await translateBatch(names, lang, 'ja');

      if (translations) {
        for (let i = 0; i < translations.length; i++) {
          const tag = tags.rows[i] as { id: number; name: string };
          const translatedName = translations[i]?.translatedText;

          if (translatedName) {
            const updateQuery = lang === 'en'
              ? sql`UPDATE tags SET name_en = ${translatedName}, updated_at = NOW() WHERE id = ${tag.id}`
              : lang === 'zh'
              ? sql`UPDATE tags SET name_zh = ${translatedName}, updated_at = NOW() WHERE id = ${tag.id}`
              : sql`UPDATE tags SET name_ko = ${translatedName}, updated_at = NOW() WHERE id = ${tag.id}`;

            await db.execute(updateQuery);
          }
        }
      }

      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));

    } catch (error: unknown) {
      console.error(`    ❌ ${lang}翻訳エラー: ${error instanceof Error ? error.message : error}`);
    }
  }

  // 結果確認
  const result = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM tags
    WHERE name_en IS NOT NULL
  `);
  translated = Number((result.rows[0] as { count: number }).count);

  console.log(`  📊 結果: ${translated}件のタグが翻訳済み`);
  return { translated, failed };
}

async function main() {
  console.log('🌐 翻訳バックフィル開始');
  console.log(`  設定: type=${TYPE}, limit=${BATCH_SIZE}`);

  const db = getDb();

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
  process.exit(0);
}

main().catch(e => {
  console.error('❌ エラー:', e);
  process.exit(1);
});
