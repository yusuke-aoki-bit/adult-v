/**
 * 商品AIレビュー生成スクリプト
 * Gemini APIを使用してユーザーレビューからAIレビューを生成
 */

import { db } from '../packages/database/src/client.js';
import {
  products,
  productReviews,
  productPerformers,
  performers,
  productTags,
  tags,
} from '../packages/database/src/schema.js';
import { eq, sql, desc, isNull, and, lt } from 'drizzle-orm';
import { generateProductReview, type GeneratedProductReview } from '../packages/shared/src/lib/google-apis.js';

const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES = 2000; // 2秒
const MIN_REVIEWS_REQUIRED = 3; // 最低レビュー数

interface ProductWithReviews {
  id: number;
  title: string;
  description: string | null;
  aiReview: string | null;
  performers: string[];
  genres: string[];
  reviews: Array<{
    rating: number | null;
    maxRating: number | null;
    content: string;
    reviewerName: string | null;
  }>;
}

async function getProductsNeedingReview(limit: number = 100): Promise<ProductWithReviews[]> {
  // AIレビューが未生成または30日以上更新されていない商品を取得
  // レビューが一定数以上ある商品のみ対象
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // レビューが3件以上ある商品を取得
  const productList = await db
    .select({
      id: products.id,
      title: products.title,
      description: products.description,
      aiReview: products.aiReview,
      reviewCount: sql<number>`COUNT(${productReviews.id})`.as('review_count'),
    })
    .from(products)
    .leftJoin(productReviews, eq(products.id, productReviews.productId))
    .where(sql`(${products.aiReview} IS NULL OR ${products.aiReviewUpdatedAt} < ${thirtyDaysAgo.toISOString()})`)
    .groupBy(products.id)
    .having(sql`COUNT(${productReviews.id}) >= ${MIN_REVIEWS_REQUIRED}`)
    .orderBy(sql`COUNT(${productReviews.id}) DESC`)
    .limit(limit);

  // 各商品の詳細情報を取得
  const result: ProductWithReviews[] = [];

  for (const product of productList) {
    // 出演者を取得
    const performerList = await db
      .select({ name: performers.name })
      .from(productPerformers)
      .innerJoin(performers, eq(productPerformers.performerId, performers.id))
      .where(eq(productPerformers.productId, product.id));

    const performerNames = performerList.map((p) => p.name);

    // ジャンルを取得
    const tagList = await db
      .select({ name: tags.name })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, product.id))
      .limit(10);

    const genres = tagList.map((t) => t.name);

    // レビューを取得
    const reviewList = await db
      .select({
        rating: productReviews.rating,
        maxRating: productReviews.maxRating,
        content: productReviews.content,
        reviewerName: productReviews.reviewerName,
      })
      .from(productReviews)
      .where(eq(productReviews.productId, product.id))
      .orderBy(desc(productReviews.reviewDate))
      .limit(20);

    // レビュー内容がある商品のみ追加
    const validReviews = reviewList.filter((r) => r.content && r.content.trim().length > 10);

    if (validReviews.length >= MIN_REVIEWS_REQUIRED) {
      result.push({
        id: product.id,
        title: product.title,
        description: product.description,
        aiReview: product.aiReview,
        performers: performerNames,
        genres,
        reviews: validReviews.map((r) => ({
          rating: r.rating ? parseFloat(r.rating) : null,
          maxRating: r.maxRating ? parseFloat(r.maxRating) : null,
          content: r.content || '',
          reviewerName: r.reviewerName,
        })),
      });
    }
  }

  return result;
}

async function updateProductReview(productId: number, review: GeneratedProductReview): Promise<void> {
  // レビューをJSON形式で保存
  const reviewJson = JSON.stringify(review);

  await db
    .update(products)
    .set({
      aiReview: reviewJson,
      aiReviewUpdatedAt: new Date(),
    })
    .where(eq(products.id, productId));
}

async function main() {
  console.log('=== 商品AIレビュー生成 ===\n');

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100;

  if (dryRun) {
    console.log('ドライランモード: 実際の更新は行いません\n');
  }

  // レビュー生成が必要な商品を取得
  console.log(`対象商品を取得中 (最大${limit}件, 最低${MIN_REVIEWS_REQUIRED}件のレビューが必要)...`);
  const productsToProcess = await getProductsNeedingReview(limit);

  console.log(`${productsToProcess.length}件の商品が見つかりました\n`);

  if (productsToProcess.length === 0) {
    console.log('レビュー生成が必要な商品はありません');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < productsToProcess.length; i += BATCH_SIZE) {
    const batch = productsToProcess.slice(i, i + BATCH_SIZE);

    console.log(
      `\n--- バッチ ${Math.floor(i / BATCH_SIZE) + 1} (${i + 1}〜${Math.min(i + BATCH_SIZE, productsToProcess.length)}/${productsToProcess.length}) ---`,
    );

    for (const product of batch) {
      console.log(`\n[${product.id}] ${product.title.substring(0, 50)}...`);
      console.log(`  レビュー数: ${product.reviews.length}件, 出演者: ${product.performers.length}名`);

      try {
        // Gemini APIでレビュー生成
        const review = await generateProductReview({
          title: product.title,
          description: product.description || undefined,
          performers: product.performers,
          genres: product.genres,
          reviews: product.reviews.map((r) => ({
            rating: r.rating || undefined,
            maxRating: r.maxRating || undefined,
            content: r.content,
            reviewerName: r.reviewerName || undefined,
          })),
        });

        if (!review) {
          console.log('  → レビュー生成失敗');
          errorCount++;
          continue;
        }

        console.log(`  総評: ${review.summary.substring(0, 50)}...`);
        console.log(`  傾向: ${review.overallSentiment}`);
        console.log(`  ハイライト: ${review.highlights.slice(0, 2).join(', ')}`);

        if (!dryRun) {
          await updateProductReview(product.id, review);
          console.log('  → 保存完了');
        } else {
          console.log('  → [ドライラン] 保存スキップ');
        }

        successCount++;
      } catch (error) {
        console.error(`  → エラー:`, error);
        errorCount++;
      }

      // API制限対策
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // バッチ間の待機
    if (i + BATCH_SIZE < productsToProcess.length) {
      console.log(`\n${DELAY_BETWEEN_BATCHES / 1000}秒待機中...`);
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`成功: ${successCount}件`);
  console.log(`失敗: ${errorCount}件`);
}

main().catch(console.error);
