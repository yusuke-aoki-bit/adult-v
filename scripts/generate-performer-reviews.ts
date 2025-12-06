/**
 * 演者AIレビュー生成スクリプト
 * Gemini APIを使用して演者のレビューを生成・更新
 */

import { db } from '../lib/db/index.js';
import { performers, productPerformers, products, productTags, tags } from '../lib/db/schema.js';
import { eq, sql, isNull, and, desc, lt } from 'drizzle-orm';
import { generatePerformerReview, GeneratedPerformerReview } from '../lib/google-apis.js';

const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES = 2000; // 2秒

interface PerformerWithProducts {
  id: number;
  name: string;
  aliases: string[] | null;
  aiReview: string | null;
  productCount: number;
  productTitles: string[];
  genres: string[];
}

async function getPerformersNeedingReview(limit: number = 100): Promise<PerformerWithProducts[]> {
  // AIレビューが未生成または30日以上更新されていない演者を取得
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const performerList = await db
    .select({
      id: performers.id,
      name: performers.name,
      aliases: performers.aliases,
      aiReview: performers.aiReview,
    })
    .from(performers)
    .where(
      sql`${performers.aiReview} IS NULL OR ${performers.aiReviewUpdatedAt} < ${thirtyDaysAgo.toISOString()}`
    )
    .orderBy(desc(performers.id))
    .limit(limit);

  // 各演者の出演作品情報を取得
  const result: PerformerWithProducts[] = [];

  for (const performer of performerList) {
    // 出演作品を取得
    const performerProducts = await db
      .select({
        title: products.title,
        productId: products.id,
      })
      .from(productPerformers)
      .innerJoin(products, eq(productPerformers.productId, products.id))
      .where(eq(productPerformers.performerId, performer.id))
      .orderBy(desc(products.releaseDate))
      .limit(20);

    // タグ（ジャンル）を取得
    const productIds = performerProducts.map(p => p.productId);
    let genres: string[] = [];

    if (productIds.length > 0) {
      const tagResults = await db
        .select({ name: tags.name })
        .from(productTags)
        .innerJoin(tags, eq(productTags.tagId, tags.id))
        .where(sql`${productTags.productId} IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`)
        .groupBy(tags.name)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(10);

      genres = tagResults.map(t => t.name);
    }

    result.push({
      id: performer.id,
      name: performer.name,
      aliases: performer.aliases,
      aiReview: performer.aiReview,
      productCount: performerProducts.length,
      productTitles: performerProducts.map(p => p.title),
      genres,
    });
  }

  return result;
}

async function updatePerformerReview(
  performerId: number,
  review: GeneratedPerformerReview
): Promise<void> {
  // レビューをJSON形式で保存
  const reviewJson = JSON.stringify(review);

  await db
    .update(performers)
    .set({
      aiReview: reviewJson,
      aiReviewUpdatedAt: new Date(),
    })
    .where(eq(performers.id, performerId));
}

async function main() {
  console.log('=== 演者AIレビュー生成 ===\n');

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100;

  if (dryRun) {
    console.log('ドライランモード: 実際の更新は行いません\n');
  }

  // レビュー生成が必要な演者を取得
  console.log(`対象演者を取得中 (最大${limit}件)...`);
  const performersToProcess = await getPerformersNeedingReview(limit);

  console.log(`${performersToProcess.length}件の演者が見つかりました\n`);

  if (performersToProcess.length === 0) {
    console.log('レビュー生成が必要な演者はありません');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < performersToProcess.length; i += BATCH_SIZE) {
    const batch = performersToProcess.slice(i, i + BATCH_SIZE);

    console.log(`\n--- バッチ ${Math.floor(i / BATCH_SIZE) + 1} (${i + 1}〜${Math.min(i + BATCH_SIZE, performersToProcess.length)}/${performersToProcess.length}) ---`);

    for (const performer of batch) {
      console.log(`\n[${performer.id}] ${performer.name} (${performer.productCount}作品)`);

      if (performer.productCount === 0) {
        console.log('  → 出演作品がないためスキップ');
        continue;
      }

      try {
        // Gemini APIでレビュー生成
        const review = await generatePerformerReview({
          performerName: performer.name,
          aliases: performer.aliases || undefined,
          productTitles: performer.productTitles,
          genres: performer.genres,
          productCount: performer.productCount,
          existingReview: performer.aiReview || undefined,
        });

        if (!review) {
          console.log('  → レビュー生成失敗');
          errorCount++;
          continue;
        }

        console.log(`  概要: ${review.overview.substring(0, 50)}...`);
        console.log(`  スタイル: ${review.style.substring(0, 30)}...`);
        console.log(`  キーワード: ${review.keywords.join(', ')}`);

        if (!dryRun) {
          await updatePerformerReview(performer.id, review);
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
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // バッチ間の待機
    if (i + BATCH_SIZE < performersToProcess.length) {
      console.log(`\n${DELAY_BETWEEN_BATCHES / 1000}秒待機中...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`成功: ${successCount}件`);
  console.log(`失敗: ${errorCount}件`);
}

main().catch(console.error);
