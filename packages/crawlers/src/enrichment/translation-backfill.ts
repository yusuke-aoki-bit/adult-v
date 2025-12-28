/**
 * 既存の商品・タグ・出演者・レビュー・AIレビューの翻訳をバックフィルするスクリプト
 * DeepL APIを使用
 *
 * 使い方:
 *   npx tsx packages/crawlers/src/enrichment/translation-backfill.ts [--limit=N] [--type=TYPE]
 *
 * TYPE:
 *   - all: 全て翻訳
 *   - products: 商品タイトル・説明文
 *   - performers: 演者名
 *   - tags: タグ名
 *   - reviews: ユーザーレビュー
 *   - ai-reviews: 商品AIレビュー
 *   - performer-ai-reviews: 演者AIレビュー
 *
 * 環境変数:
 *   DEEPL_API_KEY - DeepL APIキー
 */

import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '../lib/db';
import { translateBatch, translateToAll, delay } from '@adult-v/shared/lib/translate';

const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const typeArg = args.find(arg => arg.startsWith('--type='));

const BATCH_SIZE = parseInt(limitArg?.split('=')[1] || '100');
const TYPE = typeArg?.split('=')[1] || 'all';

// DeepLのレート制限対策（Free版は文字数制限があるため余裕を持つ）
const DELAY_MS = 300;
// 並列処理のバッチサイズ（DeepL Pro APIのレート制限に合わせて調整）
const PARALLEL_BATCH_SIZE = 10;

async function translateProducts(db: ReturnType<typeof getDb>, limit: number) {
  console.log(`\n📦 商品の翻訳を開始 (最大${limit}件、並列バッチサイズ: ${PARALLEL_BATCH_SIZE})`);

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

  // バッチに分割して並列処理
  const productList = products.rows as { id: number; title: string; description?: string }[];

  for (let i = 0; i < productList.length; i += PARALLEL_BATCH_SIZE) {
    const batch = productList.slice(i, i + PARALLEL_BATCH_SIZE);
    console.log(`    🔄 バッチ ${Math.floor(i / PARALLEL_BATCH_SIZE) + 1}/${Math.ceil(productList.length / PARALLEL_BATCH_SIZE)} 処理中...`);

    // バッチ内で並列に翻訳
    const titles = batch.map(p => p.title);
    const descriptions = batch.map(p => p.description || '');

    try {
      // タイトルをバッチで翻訳（3言語同時）
      const [titlesEn, titlesZh, titlesKo] = await Promise.all([
        translateBatch(titles, 'en', 'ja'),
        translateBatch(titles, 'zh', 'ja'),
        translateBatch(titles, 'ko', 'ja'),
      ]);

      // 説明文があるものだけバッチで翻訳
      const descriptionsWithContent = descriptions.filter(d => d.length > 0);
      let descsEn: string[] = [];
      let descsZh: string[] = [];
      let descsKo: string[] = [];

      if (descriptionsWithContent.length > 0) {
        await delay(DELAY_MS);
        [descsEn, descsZh, descsKo] = await Promise.all([
          translateBatch(descriptionsWithContent, 'en', 'ja'),
          translateBatch(descriptionsWithContent, 'zh', 'ja'),
          translateBatch(descriptionsWithContent, 'ko', 'ja'),
        ]);
      }

      // DB更新（並列）
      let descIndex = 0;
      await Promise.all(batch.map(async (product, idx) => {
        const hasDesc = product.description && product.description.length > 0;
        const descEn = hasDesc ? descsEn[descIndex] : null;
        const descZh = hasDesc ? descsZh[descIndex] : null;
        const descKo = hasDesc ? descsKo[descIndex] : null;
        if (hasDesc) descIndex++;

        await db.execute(sql`
          UPDATE products
          SET
            title_en = ${titlesEn[idx] || null},
            title_zh = ${titlesZh[idx] || null},
            title_ko = ${titlesKo[idx] || null},
            description_en = ${descEn || null},
            description_zh = ${descZh || null},
            description_ko = ${descKo || null},
            updated_at = NOW()
          WHERE id = ${product.id}
        `);
      }));

      translated += batch.length;
      console.log(`    ✅ ${translated}件完了`);

      // レート制限対策（バッチ間のディレイ）
      await delay(DELAY_MS * 2);

    } catch (error: unknown) {
      console.error(`    ❌ バッチ処理エラー: ${error instanceof Error ? error.message : error}`);
      failed += batch.length;
    }
  }

  console.log(`  📊 結果: ${translated}件成功, ${failed}件失敗`);
  return { translated, failed };
}

async function translatePerformers(db: ReturnType<typeof getDb>, limit: number) {
  console.log(`\n👤 出演者の翻訳を開始 (最大${limit}件)`);

  // 翻訳されていない出演者を取得（作品数が多い順）
  const performers = await db.execute(sql`
    SELECT p.id, p.name, COUNT(pp.product_id) as product_count
    FROM performers p
    LEFT JOIN product_performers pp ON p.id = pp.performer_id
    WHERE p.name_en IS NULL AND p.name IS NOT NULL
    GROUP BY p.id, p.name
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

async function translateReviews(db: ReturnType<typeof getDb>, limit: number) {
  console.log(`\n📝 レビューの翻訳を開始 (最大${limit}件、並列バッチサイズ: ${PARALLEL_BATCH_SIZE})`);

  // 翻訳されていないレビューを取得（コンテンツがあるもののみ）
  const reviews = await db.execute(sql`
    SELECT id, title, content
    FROM product_reviews
    WHERE content_en IS NULL AND content IS NOT NULL AND LENGTH(content) > 0
    ORDER BY id DESC
    LIMIT ${limit}
  `);

  console.log(`  → ${reviews.rows.length}件の未翻訳レビューを発見`);

  let translated = 0;
  let failed = 0;

  // バッチに分割して並列処理
  const reviewList = reviews.rows as { id: number; title?: string; content: string }[];

  for (let i = 0; i < reviewList.length; i += PARALLEL_BATCH_SIZE) {
    const batch = reviewList.slice(i, i + PARALLEL_BATCH_SIZE);
    console.log(`    🔄 バッチ ${Math.floor(i / PARALLEL_BATCH_SIZE) + 1}/${Math.ceil(reviewList.length / PARALLEL_BATCH_SIZE)} 処理中...`);

    const contents = batch.map(r => r.content);
    const titles = batch.map(r => r.title || '');

    try {
      // コンテンツをバッチで翻訳（3言語同時）
      const [contentsEn, contentsZh, contentsKo] = await Promise.all([
        translateBatch(contents, 'en', 'ja'),
        translateBatch(contents, 'zh', 'ja'),
        translateBatch(contents, 'ko', 'ja'),
      ]);

      // タイトルがあるものだけバッチで翻訳
      const titlesWithContent = titles.filter(t => t.length > 0);
      let titlesEn: string[] = [];
      let titlesZh: string[] = [];
      let titlesKo: string[] = [];

      if (titlesWithContent.length > 0) {
        await delay(DELAY_MS);
        [titlesEn, titlesZh, titlesKo] = await Promise.all([
          translateBatch(titlesWithContent, 'en', 'ja'),
          translateBatch(titlesWithContent, 'zh', 'ja'),
          translateBatch(titlesWithContent, 'ko', 'ja'),
        ]);
      }

      // DB更新（並列）
      let titleIndex = 0;
      await Promise.all(batch.map(async (review, idx) => {
        const hasTitle = review.title && review.title.length > 0;
        const titleEn = hasTitle ? titlesEn[titleIndex] : null;
        const titleZh = hasTitle ? titlesZh[titleIndex] : null;
        const titleKo = hasTitle ? titlesKo[titleIndex] : null;
        if (hasTitle) titleIndex++;

        await db.execute(sql`
          UPDATE product_reviews
          SET
            title_en = ${titleEn || null},
            title_zh = ${titleZh || null},
            title_ko = ${titleKo || null},
            content_en = ${contentsEn[idx] || null},
            content_zh = ${contentsZh[idx] || null},
            content_ko = ${contentsKo[idx] || null},
            updated_at = NOW()
          WHERE id = ${review.id}
        `);
      }));

      translated += batch.length;
      console.log(`    ✅ ${translated}件完了`);

      // レート制限対策（バッチ間のディレイ）
      await delay(DELAY_MS * 2);

    } catch (error: unknown) {
      console.error(`    ❌ バッチ処理エラー: ${error instanceof Error ? error.message : error}`);
      failed += batch.length;
    }
  }

  console.log(`  📊 結果: ${translated}件成功, ${failed}件失敗`);
  return { translated, failed };
}

async function translateAiReviews(db: ReturnType<typeof getDb>, limit: number) {
  console.log(`\n🤖 AIレビューの翻訳を開始 (最大${limit}件、並列バッチサイズ: ${PARALLEL_BATCH_SIZE})`);

  // AIレビューはあるが翻訳されていない商品を取得
  const products = await db.execute(sql`
    SELECT id, ai_review
    FROM products
    WHERE ai_review IS NOT NULL
      AND ai_review_en IS NULL
      AND LENGTH(ai_review) > 0
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  console.log(`  → ${products.rows.length}件の未翻訳AIレビューを発見`);

  let translated = 0;
  let failed = 0;

  // バッチに分割して並列処理
  const productList = products.rows as { id: number; ai_review: string }[];

  for (let i = 0; i < productList.length; i += PARALLEL_BATCH_SIZE) {
    const batch = productList.slice(i, i + PARALLEL_BATCH_SIZE);
    console.log(`    🔄 バッチ ${Math.floor(i / PARALLEL_BATCH_SIZE) + 1}/${Math.ceil(productList.length / PARALLEL_BATCH_SIZE)} 処理中...`);

    const aiReviews = batch.map(p => p.ai_review);

    try {
      // AIレビューをバッチで翻訳（3言語同時）
      const [reviewsEn, reviewsZh, reviewsKo] = await Promise.all([
        translateBatch(aiReviews, 'en', 'ja'),
        translateBatch(aiReviews, 'zh', 'ja'),
        translateBatch(aiReviews, 'ko', 'ja'),
      ]);

      // DB更新（並列）
      await Promise.all(batch.map(async (product, idx) => {
        await db.execute(sql`
          UPDATE products
          SET
            ai_review_en = ${reviewsEn[idx] || null},
            ai_review_zh = ${reviewsZh[idx] || null},
            ai_review_ko = ${reviewsKo[idx] || null},
            updated_at = NOW()
          WHERE id = ${product.id}
        `);
      }));

      translated += batch.length;
      console.log(`    ✅ ${translated}件完了`);

      // レート制限対策（バッチ間のディレイ）
      await delay(DELAY_MS * 2);

    } catch (error: unknown) {
      console.error(`    ❌ バッチ処理エラー: ${error instanceof Error ? error.message : error}`);
      failed += batch.length;
    }
  }

  console.log(`  📊 結果: ${translated}件成功, ${failed}件失敗`);
  return { translated, failed };
}

async function translatePerformerAiReviews(db: ReturnType<typeof getDb>, limit: number) {
  console.log(`\n🎭 演者AIレビューの翻訳を開始 (最大${limit}件、並列バッチサイズ: ${PARALLEL_BATCH_SIZE})`);

  // AIレビューはあるが翻訳されていない演者を取得
  const performers = await db.execute(sql`
    SELECT id, ai_review
    FROM performers
    WHERE ai_review IS NOT NULL
      AND ai_review_en IS NULL
      AND LENGTH(ai_review) > 0
    ORDER BY id DESC
    LIMIT ${limit}
  `);

  console.log(`  → ${performers.rows.length}件の未翻訳演者AIレビューを発見`);

  let translated = 0;
  let failed = 0;

  // バッチに分割して並列処理
  const performerList = performers.rows as { id: number; ai_review: string }[];

  for (let i = 0; i < performerList.length; i += PARALLEL_BATCH_SIZE) {
    const batch = performerList.slice(i, i + PARALLEL_BATCH_SIZE);
    console.log(`    🔄 バッチ ${Math.floor(i / PARALLEL_BATCH_SIZE) + 1}/${Math.ceil(performerList.length / PARALLEL_BATCH_SIZE)} 処理中...`);

    const aiReviews = batch.map(p => p.ai_review);

    try {
      // AIレビューをバッチで翻訳（3言語同時）
      const [reviewsEn, reviewsZh, reviewsKo] = await Promise.all([
        translateBatch(aiReviews, 'en', 'ja'),
        translateBatch(aiReviews, 'zh', 'ja'),
        translateBatch(aiReviews, 'ko', 'ja'),
      ]);

      // DB更新（並列）
      await Promise.all(batch.map(async (performer, idx) => {
        await db.execute(sql`
          UPDATE performers
          SET
            ai_review_en = ${reviewsEn[idx] || null},
            ai_review_zh = ${reviewsZh[idx] || null},
            ai_review_ko = ${reviewsKo[idx] || null},
            updated_at = NOW()
          WHERE id = ${performer.id}
        `);
      }));

      translated += batch.length;
      console.log(`    ✅ ${translated}件完了`);

      // レート制限対策（バッチ間のディレイ）
      await delay(DELAY_MS * 2);

    } catch (error: unknown) {
      console.error(`    ❌ バッチ処理エラー: ${error instanceof Error ? error.message : error}`);
      failed += batch.length;
    }
  }

  console.log(`  📊 結果: ${translated}件成功, ${failed}件失敗`);
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
    // シンプルな接続テスト
    console.log('  接続テスト中...');
    const testResult = await db.execute(sql`SELECT 1 as test`);
    console.log('  ✅ DB接続成功');

    const results = {
      products: { translated: 0, failed: 0 },
      performers: { translated: 0, failed: 0 },
      tags: { translated: 0, failed: 0 },
      reviews: { translated: 0, failed: 0 },
      aiReviews: { translated: 0, failed: 0 },
      performerAiReviews: { translated: 0, failed: 0 },
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

    if (TYPE === 'all' || TYPE === 'reviews') {
      results.reviews = await translateReviews(db, BATCH_SIZE);
    }

    if (TYPE === 'all' || TYPE === 'ai-reviews') {
      results.aiReviews = await translateAiReviews(db, BATCH_SIZE);
    }

    if (TYPE === 'all' || TYPE === 'performer-ai-reviews') {
      results.performerAiReviews = await translatePerformerAiReviews(db, BATCH_SIZE);
    }

    console.log('\n📊 翻訳結果:');
    console.table(results);

    console.log('\n✅ 翻訳バックフィル完了');
  } finally {
    await closeDb();
  }
}

main().catch(e => {
  console.error('❌ エラー:', e);
  process.exit(1);
});
