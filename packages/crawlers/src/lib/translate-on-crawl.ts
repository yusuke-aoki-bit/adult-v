/**
 * クロール時自動翻訳モジュール
 *
 * クローラーが商品を保存した直後に翻訳を実行
 * 多言語SEOのために新規商品は即座に翻訳
 *
 * 対象:
 * - title: タイトル
 * - description: 説明文
 * - ai_review: AIレビュー（生成されている場合）
 *
 * 対象言語:
 * - en: 英語
 * - zh: 中国語（簡体字）
 * - ko: 韓国語
 */

import { sql } from 'drizzle-orm';
import { getDb } from './db';
import { translateBatch, delay } from '@adult-v/shared/lib/translate';

// DB型定義
type DbInstance = ReturnType<typeof getDb>;

// 翻訳が有効かどうか
const TRANSLATION_ENABLED = !!process.env['DEEPL_API_KEY'];

// バッチサイズ（DeepLのレート制限対策）
const BATCH_SIZE = 10;

// 対象言語
const TARGET_LANGUAGES = ['en', 'zh', 'ko'] as const;

interface TranslationStats {
  translated: number;
  failed: number;
  skipped: number;
}

/**
 * 単一商品の翻訳（タイトル・説明文・AIレビュー）
 */
export async function translateProduct(
  db: DbInstance,
  productId: number,
  title: string,
  description?: string | null,
  aiReview?: string | null
): Promise<boolean> {
  if (!TRANSLATION_ENABLED) {
    return false;
  }

  try {
    // 既に翻訳済みかチェック
    const existing = await db.execute(sql`
      SELECT title_en FROM products WHERE id = ${productId} AND title_en IS NOT NULL
    `);

    if (existing.rows.length > 0) {
      return true; // 既に翻訳済み
    }

    // タイトルを3言語同時に翻訳
    const [titlesEn, titlesZh, titlesKo] = await Promise.all([
      translateBatch([title], 'en', 'ja'),
      translateBatch([title], 'zh', 'ja'),
      translateBatch([title], 'ko', 'ja'),
    ]);

    let descEn: string | null = null;
    let descZh: string | null = null;
    let descKo: string | null = null;

    // 説明文がある場合は翻訳
    if (description && description.length > 0) {
      await delay(100); // レート制限対策

      const [descsEn, descsZh, descsKo] = await Promise.all([
        translateBatch([description], 'en', 'ja'),
        translateBatch([description], 'zh', 'ja'),
        translateBatch([description], 'ko', 'ja'),
      ]);

      descEn = descsEn[0] ?? null;
      descZh = descsZh[0] ?? null;
      descKo = descsKo[0] ?? null;
    }

    let aiReviewEn: string | null = null;
    let aiReviewZh: string | null = null;
    let aiReviewKo: string | null = null;

    // AIレビューがある場合は翻訳
    if (aiReview && aiReview.length > 0) {
      await delay(100); // レート制限対策

      const [reviewsEn, reviewsZh, reviewsKo] = await Promise.all([
        translateBatch([aiReview], 'en', 'ja'),
        translateBatch([aiReview], 'zh', 'ja'),
        translateBatch([aiReview], 'ko', 'ja'),
      ]);

      aiReviewEn = reviewsEn[0] ?? null;
      aiReviewZh = reviewsZh[0] ?? null;
      aiReviewKo = reviewsKo[0] ?? null;
    }

    // DB更新
    await db.execute(sql`
      UPDATE products
      SET
        title_en = ${titlesEn[0] ?? null},
        title_zh = ${titlesZh[0] ?? null},
        title_ko = ${titlesKo[0] ?? null},
        description_en = ${descEn},
        description_zh = ${descZh},
        description_ko = ${descKo},
        ai_review_en = ${aiReviewEn},
        ai_review_zh = ${aiReviewZh},
        ai_review_ko = ${aiReviewKo},
        updated_at = NOW()
      WHERE id = ${productId}
    `);

    return true;
  } catch (error) {
    console.error(`[translate] Failed to translate product ${productId}:`, error);
    return false;
  }
}

/**
 * 商品バッチの翻訳（タイトル・説明文・AIレビュー）
 */
export async function translateProductBatch(
  db: DbInstance,
  products: Array<{ id: number; title: string; description?: string | null; aiReview?: string | null }>
): Promise<TranslationStats> {
  const stats: TranslationStats = {
    translated: 0,
    failed: 0,
    skipped: 0,
  };

  if (!TRANSLATION_ENABLED) {
    console.log('[translate] Translation disabled (DEEPL_API_KEY not set)');
    stats.skipped = products.length;
    return stats;
  }

  if (products.length === 0) {
    return stats;
  }

  console.log(`[translate] Translating ${products.length} products...`);

  // バッチに分割して処理
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const titles = batch.map(p => p.title);
    const descriptions = batch.map(p => p.description || '');
    const aiReviews = batch.map(p => p.aiReview || '');

    try {
      // タイトルをバッチ翻訳
      const [titlesEn, titlesZh, titlesKo] = await Promise.all([
        translateBatch(titles, 'en', 'ja'),
        translateBatch(titles, 'zh', 'ja'),
        translateBatch(titles, 'ko', 'ja'),
      ]);

      // 説明文があるものだけ翻訳
      const nonEmptyDescs = descriptions.filter(d => d.length > 0);
      let descsEn: string[] = [];
      let descsZh: string[] = [];
      let descsKo: string[] = [];

      if (nonEmptyDescs.length > 0) {
        await delay(200); // レート制限対策

        [descsEn, descsZh, descsKo] = await Promise.all([
          translateBatch(nonEmptyDescs, 'en', 'ja'),
          translateBatch(nonEmptyDescs, 'zh', 'ja'),
          translateBatch(nonEmptyDescs, 'ko', 'ja'),
        ]);
      }

      // AIレビューがあるものだけ翻訳
      const nonEmptyReviews = aiReviews.filter(r => r.length > 0);
      let reviewsEn: string[] = [];
      let reviewsZh: string[] = [];
      let reviewsKo: string[] = [];

      if (nonEmptyReviews.length > 0) {
        await delay(200); // レート制限対策

        [reviewsEn, reviewsZh, reviewsKo] = await Promise.all([
          translateBatch(nonEmptyReviews, 'en', 'ja'),
          translateBatch(nonEmptyReviews, 'zh', 'ja'),
          translateBatch(nonEmptyReviews, 'ko', 'ja'),
        ]);
      }

      // DB更新
      let descIndex = 0;
      let reviewIndex = 0;
      for (let j = 0; j < batch.length; j++) {
        const product = batch[j]!;
        const hasDesc = product['description'] && product['description'].length > 0;
        const hasReview = product.aiReview && product.aiReview.length > 0;

        try {
          await db.execute(sql`
            UPDATE products
            SET
              title_en = ${titlesEn[j] ?? null},
              title_zh = ${titlesZh[j] ?? null},
              title_ko = ${titlesKo[j] ?? null},
              description_en = ${hasDesc ? (descsEn[descIndex] ?? null) : null},
              description_zh = ${hasDesc ? (descsZh[descIndex] ?? null) : null},
              description_ko = ${hasDesc ? (descsKo[descIndex] ?? null) : null},
              ai_review_en = ${hasReview ? (reviewsEn[reviewIndex] ?? null) : null},
              ai_review_zh = ${hasReview ? (reviewsZh[reviewIndex] ?? null) : null},
              ai_review_ko = ${hasReview ? (reviewsKo[reviewIndex] ?? null) : null},
              updated_at = NOW()
            WHERE id = ${product['id']}
          `);

          if (hasDesc) descIndex++;
          if (hasReview) reviewIndex++;
          stats.translated++;
        } catch {
          stats.failed++;
        }
      }

      // レート制限対策
      if (i + BATCH_SIZE < products.length) {
        await delay(300);
      }
    } catch (error) {
      console.error(`[translate] Batch ${i / BATCH_SIZE + 1} failed:`, error);
      stats.failed += batch.length;
    }
  }

  console.log(`[translate] Done: ${stats.translated} translated, ${stats.failed} failed`);
  return stats;
}

/**
 * クロール後フック - 新規保存された商品を翻訳
 */
export async function translateNewProducts(
  db: DbInstance,
  limit: number = 50
): Promise<TranslationStats> {
  if (!TRANSLATION_ENABLED) {
    return { translated: 0, failed: 0, skipped: 0 };
  }

  // 未翻訳の商品を取得（最新順）- AIレビューも含む
  const result = await db.execute(sql`
    SELECT id, title, description, ai_review
    FROM products
    WHERE title_en IS NULL AND title IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  const products = result.rows as Array<{
    id: number;
    title: string;
    description: string | null;
    ai_review: string | null;
  }>;

  if (products.length === 0) {
    return { translated: 0, failed: 0, skipped: 0 };
  }

  // ai_review -> aiReview にマッピング
  const mappedProducts = products.map(p => ({
    id: p.id,
    title: p.title,
    description: p.description,
    aiReview: p.ai_review,
  }));

  return translateProductBatch(db, mappedProducts);
}

/**
 * AIレビューのみを翻訳（既存商品のAIレビュー翻訳用）
 */
export async function translateAiReviews(
  db: DbInstance,
  limit: number = 50
): Promise<TranslationStats> {
  if (!TRANSLATION_ENABLED) {
    return { translated: 0, failed: 0, skipped: 0 };
  }

  // AIレビューはあるが翻訳されていない商品を取得
  const result = await db.execute(sql`
    SELECT id, ai_review
    FROM products
    WHERE ai_review IS NOT NULL
      AND ai_review_en IS NULL
      AND LENGTH(ai_review) > 0
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  const products = result.rows as Array<{
    id: number;
    ai_review: string;
  }>;

  if (products.length === 0) {
    return { translated: 0, failed: 0, skipped: 0 };
  }

  console.log(`[translate] Translating ${products.length} AI reviews...`);

  const stats: TranslationStats = {
    translated: 0,
    failed: 0,
    skipped: 0,
  };

  // バッチに分割して処理
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const reviews = batch.map(p => p.ai_review);

    try {
      // AIレビューをバッチ翻訳
      const [reviewsEn, reviewsZh, reviewsKo] = await Promise.all([
        translateBatch(reviews, 'en', 'ja'),
        translateBatch(reviews, 'zh', 'ja'),
        translateBatch(reviews, 'ko', 'ja'),
      ]);

      // DB更新
      for (let j = 0; j < batch.length; j++) {
        const product = batch[j]!;
        try {
          await db.execute(sql`
            UPDATE products
            SET
              ai_review_en = ${reviewsEn[j] ?? null},
              ai_review_zh = ${reviewsZh[j] ?? null},
              ai_review_ko = ${reviewsKo[j] ?? null},
              updated_at = NOW()
            WHERE id = ${product['id']}
          `);
          stats.translated++;
        } catch {
          stats.failed++;
        }
      }

      // レート制限対策
      if (i + BATCH_SIZE < products.length) {
        await delay(300);
      }
    } catch (error) {
      console.error(`[translate] AI review batch ${i / BATCH_SIZE + 1} failed:`, error);
      stats.failed += batch.length;
    }
  }

  console.log(`[translate] AI reviews done: ${stats.translated} translated, ${stats.failed} failed`);
  return stats;
}

/**
 * 演者のAIレビュー翻訳
 */
export async function translatePerformerAiReviews(
  db: DbInstance,
  limit: number = 50
): Promise<TranslationStats> {
  if (!TRANSLATION_ENABLED) {
    return { translated: 0, failed: 0, skipped: 0 };
  }

  // AIレビューはあるが翻訳されていない演者を取得
  const result = await db.execute(sql`
    SELECT id, ai_review
    FROM performers
    WHERE ai_review IS NOT NULL
      AND ai_review_en IS NULL
      AND LENGTH(ai_review) > 0
    ORDER BY id DESC
    LIMIT ${limit}
  `);

  const performers = result.rows as Array<{
    id: number;
    ai_review: string;
  }>;

  if (performers.length === 0) {
    return { translated: 0, failed: 0, skipped: 0 };
  }

  console.log(`[translate] Translating ${performers.length} performer AI reviews...`);

  const stats: TranslationStats = {
    translated: 0,
    failed: 0,
    skipped: 0,
  };

  // バッチに分割して処理
  for (let i = 0; i < performers.length; i += BATCH_SIZE) {
    const batch = performers.slice(i, i + BATCH_SIZE);
    const reviews = batch.map(p => p.ai_review);

    try {
      // AIレビューをバッチ翻訳
      const [reviewsEn, reviewsZh, reviewsKo] = await Promise.all([
        translateBatch(reviews, 'en', 'ja'),
        translateBatch(reviews, 'zh', 'ja'),
        translateBatch(reviews, 'ko', 'ja'),
      ]);

      // DB更新
      for (let j = 0; j < batch.length; j++) {
        const performer = batch[j]!;
        try {
          await db.execute(sql`
            UPDATE performers
            SET
              ai_review_en = ${reviewsEn[j] ?? null},
              ai_review_zh = ${reviewsZh[j] ?? null},
              ai_review_ko = ${reviewsKo[j] ?? null},
              updated_at = NOW()
            WHERE id = ${performer['id']}
          `);
          stats.translated++;
        } catch {
          stats.failed++;
        }
      }

      // レート制限対策
      if (i + BATCH_SIZE < performers.length) {
        await delay(300);
      }
    } catch (error) {
      console.error(`[translate] Performer AI review batch ${i / BATCH_SIZE + 1} failed:`, error);
      stats.failed += batch.length;
    }
  }

  console.log(`[translate] Performer AI reviews done: ${stats.translated} translated, ${stats.failed} failed`);
  return stats;
}

/**
 * 翻訳が有効かどうかを確認
 */
export function isTranslationEnabled(): boolean {
  return TRANSLATION_ENABLED;
}
