import { getDugaClient } from '../lib/providers/duga-client';
import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import { validateProductData } from '../lib/crawler-utils';
import { scrapeDugaProductPage, DugaPageData } from '../lib/providers/duga-page-scraper';
import { getAIHelper } from '../lib/crawler';
import { saveSaleInfo } from '../lib/sale-helper';
import {
  getFirstRow,
  IdRow,
  upsertDugaRawDataWithGcs,
  linkProductToRawData,
  markRawDataAsProcessed,
  crawlerLog,
} from '../lib/crawler';

/**
 * DUGA API クローラー（GCS対応 + 重複防止）
 *
 * 機能:
 * - DUGA APIから商品データを取得
 * - 生レスポンスをGCS優先で保存（フォールバック: DB）
 * - 重複クロール防止: hash比較
 * - 重複分析防止: processedAtチェック
 * - 商品ページからレビュー情報をスクレイピング
 *
 * 使い方:
 * npx tsx scripts/crawlers/crawl-duga-api.ts [--limit 100] [--offset 0] [--skip-reviews] [--no-ai] [--force]
 */

interface CrawlStats {
  totalFetched: number;
  newProducts: number;
  updatedProducts: number;
  skippedUnchanged: number;
  skippedInvalid: number;
  errors: number;
  rawDataSaved: number;
  reviewsFetched: number;
  reviewsSaved: number;
  aiGenerated: number;
  salesSaved: number;
}

/**
 * 年月範囲を生成（発売日ベースで全件取得用）
 */
function generateDateRanges(startYear: number, endYear: number): Array<{ start: string; end: string }> {
  const ranges: Array<{ start: string; end: string }> = [];

  for (let year = endYear; year >= startYear; year--) {
    for (let month = 12; month >= 1; month--) {
      const start = `${year}${month.toString().padStart(2, '0')}01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${year}${month.toString().padStart(2, '0')}${lastDay}`;
      ranges.push({ start, end });
    }
  }

  return ranges;
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const offsetArg = args.find(arg => arg.startsWith('--offset='));
  const skipReviews = args.includes('--skip-reviews');
  const enableAI = !args.includes('--no-ai');
  const forceReprocess = args.includes('--force');
  const fullScan = args.includes('--full-scan');
  const yearArg = args.find(arg => arg.startsWith('--year='));
  const monthArg = args.find(arg => arg.startsWith('--month='));

  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 100;
  const offset = offsetArg ? parseInt(offsetArg.split('=')[1]) : 0;
  const targetYear = yearArg ? parseInt(yearArg.split('=')[1]) : null;
  const targetMonth = monthArg ? parseInt(monthArg.split('=')[1]) : null;

  console.log('========================================');
  console.log('=== DUGA APIクローラー (GCS対応) ===');
  console.log('========================================');
  console.log(`取得範囲: offset=${offset}, limit=${limit}`);
  console.log(`レビュー取得: ${skipReviews ? '無効' : '有効'}`);
  console.log(`AI機能: ${enableAI ? '有効' : '無効'}`);
  console.log(`強制再処理: ${forceReprocess ? '有効' : '無効'}`);
  console.log(`フルスキャン: ${fullScan ? '有効' : '無効'}`);
  if (targetYear) console.log(`指定年: ${targetYear}`);
  if (targetMonth) console.log(`指定月: ${targetMonth}`);
  console.log('========================================\n');

  const dugaClient = getDugaClient();
  const db = getDb();

  const stats: CrawlStats = {
    totalFetched: 0,
    newProducts: 0,
    updatedProducts: 0,
    skippedUnchanged: 0,
    skippedInvalid: 0,
    errors: 0,
    rawDataSaved: 0,
    reviewsFetched: 0,
    reviewsSaved: 0,
    aiGenerated: 0,
    salesSaved: 0,
  };

  try {
    let allItems: any[] = [];

    if (fullScan || targetYear) {
      // フルスキャンモード: 発売日範囲で全件取得
      console.log('🔄 DUGA APIからフルスキャンで作品を取得中...\n');

      const currentYear = new Date().getFullYear();
      let dateRanges: Array<{ start: string; end: string }>;

      if (targetYear && targetMonth) {
        // 特定の年月のみ
        const lastDay = new Date(targetYear, targetMonth, 0).getDate();
        dateRanges = [{
          start: `${targetYear}${targetMonth.toString().padStart(2, '0')}01`,
          end: `${targetYear}${targetMonth.toString().padStart(2, '0')}${lastDay}`,
        }];
      } else if (targetYear) {
        // 特定の年のみ
        dateRanges = generateDateRanges(targetYear, targetYear);
      } else {
        // 2000年から現在まで全期間
        dateRanges = generateDateRanges(2000, currentYear);
      }

      console.log(`📅 取得期間: ${dateRanges.length}ヶ月分\n`);

      for (const range of dateRanges) {
        if (allItems.length >= limit) break;

        console.log(`\n📆 期間: ${range.start} - ${range.end}`);

        const PAGE_SIZE = 100;
        let currentOffset = 0;
        let periodItems: any[] = [];

        // 最初のリクエストで期間内の総数を取得
        const firstResponse = await dugaClient.searchProducts({
          releasestt: range.start,
          releaseend: range.end,
          hits: PAGE_SIZE,
          offset: currentOffset,
          adult: 1,
          sort: 'release',
        });

        if (firstResponse.count === 0) {
          console.log(`  ⏭️ この期間には作品がありません`);
          continue;
        }

        console.log(`  📊 期間内件数: ${firstResponse.count.toLocaleString()}件`);

        // ページネーションループ
        let response = firstResponse;
        while (true) {
          if (response.items.length === 0) break;

          periodItems = periodItems.concat(response.items);
          currentOffset += PAGE_SIZE;

          console.log(`  ✅ 取得: ${response.items.length}件 (期間累計: ${periodItems.length}件)`);

          // この期間の全件取得完了
          if (response.items.length < PAGE_SIZE || periodItems.length >= firstResponse.count) {
            break;
          }

          // 全体のlimitに達したら終了
          if (allItems.length + periodItems.length >= limit) {
            break;
          }

          // レートリミット対策
          await new Promise(resolve => setTimeout(resolve, 1100));

          response = await dugaClient.searchProducts({
            releasestt: range.start,
            releaseend: range.end,
            hits: PAGE_SIZE,
            offset: currentOffset,
            adult: 1,
            sort: 'release',
          });
        }

        allItems = allItems.concat(periodItems);
        console.log(`  📦 期間合計: ${periodItems.length}件 (全体累計: ${allItems.length.toLocaleString()}件)`);

        // レートリミット対策: 期間ごとに少し待機
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } else {
      // 通常モード: 新着順で取得
      console.log('🔄 DUGA APIから新着作品を取得中...\n');

      // ページネーション処理: APIは1回最大100件まで
      const PAGE_SIZE = 100;
      let currentOffset = offset;
      let totalProcessed = 0;

      // 最初のリクエストで総数を取得
      const firstResponse = await dugaClient.getNewReleases(PAGE_SIZE, currentOffset);
      const totalCount = firstResponse.count;
      console.log(`📊 API総件数: ${totalCount.toLocaleString()}件`);
      console.log(`🎯 取得目標: ${limit === 99999 ? '全件' : limit + '件'}\n`);

      // ページネーションループ
      while (totalProcessed < limit) {
        const response = totalProcessed === 0
          ? firstResponse
          : await dugaClient.getNewReleases(PAGE_SIZE, currentOffset);

        if (response.items.length === 0) {
          console.log('📭 取得可能な商品がなくなりました');
          break;
        }

        allItems = allItems.concat(response.items);
        totalProcessed += response.items.length;
        currentOffset += PAGE_SIZE;

        console.log(`✅ ページ取得: ${response.items.length}件 (累計: ${totalProcessed.toLocaleString()}件 / offset: ${currentOffset})`);

        // limitに達したら終了
        if (totalProcessed >= limit || response.items.length < PAGE_SIZE) {
          break;
        }

        // レートリミット対策: 100リクエストごとに短い休憩
        if (totalProcessed % 10000 === 0) {
          console.log('⏳ レートリミット対策: 5秒待機...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    // limitを超えた分をカット
    if (allItems.length > limit) {
      allItems = allItems.slice(0, limit);
    }

    console.log(`\n✅ API取得完了: ${allItems.length.toLocaleString()}件\n`);
    stats.totalFetched = allItems.length;

    for (const [index, item] of allItems.entries()) {
      try {
        console.log(`[${index + 1}/${allItems.length}] 処理中: ${item.title}`);

        // 商品データの検証
        const validation = validateProductData({
          title: item.title,
          description: item.description,
          aspName: 'DUGA',
          originalId: item.productId,
        });

        if (!validation.isValid) {
          console.log(`  ⚠️ スキップ(無効): ${validation.reason}`);
          stats.skippedInvalid++;
          continue;
        }

        // 1. 生データの保存（GCS優先 + 重複チェック）
        const rawData = item as unknown as Record<string, unknown>;
        const upsertResult = await upsertDugaRawDataWithGcs(item.productId, rawData);

        // 重複チェック: 変更なし＆処理済みならスキップ
        if (upsertResult.shouldSkip && !forceReprocess) {
          console.log(`  ⏭️ スキップ(処理済み): ${item.productId}`);
          stats.skippedUnchanged++;
          continue;
        }

        const rawDataId = upsertResult.id;
        const gcsUrl = upsertResult.gcsUrl;

        if (upsertResult.isNew) {
          stats.rawDataSaved++;
          console.log(`  ✓ 生データ保存 (raw_id: ${rawDataId})${gcsUrl ? ' [GCS]' : ' [DB]'}`);
        } else if (!upsertResult.shouldSkip) {
          stats.rawDataSaved++;
          console.log(`  🔄 生データ更新 (raw_id: ${rawDataId})${gcsUrl ? ' [GCS]' : ' [DB]'}`);
        }

        // 2. 正規化されたデータを保存
        // normalized_product_id生成: DUGA-{productId}
        const normalizedProductId = `duga-${item.productId}`;

        // productsテーブルにupsert
        const productResult = await db.execute(sql`
          INSERT INTO products (
            normalized_product_id,
            title,
            description,
            release_date,
            duration,
            default_thumbnail_url,
            updated_at
          )
          VALUES (
            ${normalizedProductId},
            ${item.title || ''},
            ${item.description || null},
            ${item.releaseDate || null},
            ${item.duration || null},
            ${item.thumbnailUrl || null},
            NOW()
          )
          ON CONFLICT (normalized_product_id)
          DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            release_date = EXCLUDED.release_date,
            duration = EXCLUDED.duration,
            default_thumbnail_url = EXCLUDED.default_thumbnail_url,
            updated_at = NOW()
          RETURNING id
        `);

        const productRow = getFirstRow<IdRow>(productResult);
        const productId = productRow!.id;
        const isNew = productResult.rowCount === 1;

        if (isNew) {
          stats.newProducts++;
          console.log(`  ✓ 新規商品作成 (product_id: ${productId})`);
        } else {
          stats.updatedProducts++;
          console.log(`  ✓ 商品更新 (product_id: ${productId})`);
        }

        // 3. product_sourcesにupsert
        await db.execute(sql`
          INSERT INTO product_sources (
            product_id,
            asp_name,
            original_product_id,
            affiliate_url,
            price,
            data_source,
            last_updated
          )
          VALUES (
            ${productId},
            'DUGA',
            ${item.productId},
            ${item.affiliateUrl || ''},
            ${item.price || null},
            'API',
            NOW()
          )
          ON CONFLICT (product_id, asp_name)
          DO UPDATE SET
            affiliate_url = EXCLUDED.affiliate_url,
            price = EXCLUDED.price,
            last_updated = NOW()
        `);

        console.log(`  ✓ product_sources 保存完了`);

        // 4. 商品と生データをリンク
        await linkProductToRawData(
          productId,
          'duga',
          rawDataId,
          'duga_raw_responses',
          gcsUrl || `hash:${rawDataId}`
        );
        console.log(`  ✓ リカバリーリンク作成完了`);

        // 5. サンプル画像を保存
        if (item.sampleImages && item.sampleImages.length > 0) {
          console.log(`  📷 サンプル画像保存中 (${item.sampleImages.length}枚)...`);

          // 既存の画像を削除
          await db.execute(sql`
            DELETE FROM product_images
            WHERE product_id = ${productId}
            AND asp_name = 'DUGA'
            AND image_type = 'sample'
          `);

          // 新しい画像を挿入
          for (const [imgIndex, imageUrl] of item.sampleImages.entries()) {
            await db.execute(sql`
              INSERT INTO product_images (
                product_id,
                asp_name,
                image_url,
                image_type,
                display_order
              )
              VALUES (
                ${productId},
                'DUGA',
                ${imageUrl},
                'sample',
                ${imgIndex}
              )
            `);
          }

          console.log(`  ✓ サンプル画像保存完了`);
        }

        // 5.5. サンプル動画を保存
        if (item.sampleVideos && item.sampleVideos.length > 0) {
          console.log(`  🎬 サンプル動画保存中 (${item.sampleVideos.length}件)...`);

          // 既存の動画を削除
          await db.execute(sql`
            DELETE FROM product_videos
            WHERE product_id = ${productId}
            AND asp_name = 'DUGA'
          `);

          // 新しい動画を挿入
          for (const [videoIndex, videoUrl] of item.sampleVideos.entries()) {
            await db.execute(sql`
              INSERT INTO product_videos (
                product_id,
                asp_name,
                video_url,
                video_type,
                display_order
              )
              VALUES (
                ${productId},
                'DUGA',
                ${videoUrl},
                'sample',
                ${videoIndex}
              )
            `);
          }

          console.log(`  ✓ サンプル動画保存完了`);
        }

        // 6. パッケージ画像を保存
        if (item.packageUrl) {
          await db.execute(sql`
            INSERT INTO product_images (
              product_id,
              asp_name,
              image_url,
              image_type,
              display_order
            )
            VALUES (
              ${productId},
              'DUGA',
              ${item.packageUrl},
              'package',
              0
            )
            ON CONFLICT DO NOTHING
          `);

          console.log(`  ✓ パッケージ画像保存完了`);
        }

        // 7. カテゴリ・タグ保存（categoriesがある場合）
        if (item.categories && item.categories.length > 0) {
          console.log(`  🏷️  カテゴリ/タグ保存中 (${item.categories.length}件)...`);

          for (const category of item.categories) {
            // まずcategoriesテーブルにupsert
            const categoryResult = await db.execute(sql`
              INSERT INTO categories (name)
              VALUES (${category.name})
              ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `);

            const categoryRow = getFirstRow<IdRow>(categoryResult);
            const categoryId = categoryRow!.id;

            // product_categoriesにリレーション作成
            await db.execute(sql`
              INSERT INTO product_categories (product_id, category_id)
              VALUES (${productId}, ${categoryId})
              ON CONFLICT DO NOTHING
            `);

            // tagsテーブルにも保存（ジャンルタグとして）
            const tagResult = await db.execute(sql`
              INSERT INTO tags (name, category)
              VALUES (${category.name}, 'genre')
              ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `);

            const tagRow = getFirstRow<IdRow>(tagResult);
            const tagId = tagRow!.id;

            // product_tagsにリレーション作成
            await db.execute(sql`
              INSERT INTO product_tags (product_id, tag_id)
              VALUES (${productId}, ${tagId})
              ON CONFLICT DO NOTHING
            `);
          }

          console.log(`  ✓ カテゴリ/タグ保存完了`);
        }

        // 8. 出演者情報保存（performersがある場合）
        if (item.performers && item.performers.length > 0) {
          console.log(`  👤 出演者保存中 (${item.performers.length}人)...`);

          for (const performer of item.performers) {
            // performersテーブルにupsert
            const performerResult = await db.execute(sql`
              INSERT INTO performers (name)
              VALUES (${performer.name})
              ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `);

            const performerRow = getFirstRow<IdRow>(performerResult);
            const performerId = performerRow!.id;

            // product_performersにリレーション作成
            await db.execute(sql`
              INSERT INTO product_performers (product_id, performer_id)
              VALUES (${productId}, ${performerId})
              ON CONFLICT DO NOTHING
            `);
          }

          console.log(`  ✓ 出演者保存完了`);
        }

        // 8.5. セール情報保存
        if (item.saleInfo) {
          try {
            const saved = await saveSaleInfo('DUGA', item.productId, {
              regularPrice: item.saleInfo.regularPrice,
              salePrice: item.saleInfo.salePrice,
              discountPercent: item.saleInfo.discountPercent,
              saleType: item.saleInfo.saleType,
              saleName: item.saleInfo.saleName,
            });
            if (saved) {
              stats.salesSaved++;
              console.log(`  💰 セール情報保存: ¥${item.saleInfo.regularPrice.toLocaleString()} → ¥${item.saleInfo.salePrice.toLocaleString()} (${item.saleInfo.discountPercent}% OFF)`);
            }
          } catch (saleError: unknown) {
            console.log(`  ⚠️ セール情報保存失敗: ${saleError instanceof Error ? saleError.message : saleError}`);
          }
        }

        // 9. レビュー情報取得（ページスクレイピング）
        if (!skipReviews) {
          try {
            console.log(`  📝 レビュー情報取得中...`);
            const pageData = await scrapeDugaProductPage(item.productId);

            // 集計評価を保存
            if (pageData.aggregateRating) {
              stats.reviewsFetched += pageData.aggregateRating.reviewCount;

              await db.execute(sql`
                INSERT INTO product_rating_summary (
                  product_id,
                  asp_name,
                  average_rating,
                  max_rating,
                  total_reviews,
                  rating_distribution,
                  last_updated
                )
                VALUES (
                  ${productId},
                  'DUGA',
                  ${pageData.aggregateRating.averageRating},
                  ${pageData.aggregateRating.bestRating},
                  ${pageData.aggregateRating.reviewCount},
                  ${JSON.stringify({ worstRating: pageData.aggregateRating.worstRating })}::jsonb,
                  NOW()
                )
                ON CONFLICT (product_id, asp_name)
                DO UPDATE SET
                  average_rating = EXCLUDED.average_rating,
                  total_reviews = EXCLUDED.total_reviews,
                  rating_distribution = EXCLUDED.rating_distribution,
                  last_updated = NOW()
              `);

              console.log(`  ✓ 評価サマリー保存完了 (${pageData.aggregateRating.averageRating}点, ${pageData.aggregateRating.reviewCount}件)`);
            }

            // 個別レビューを保存
            if (pageData.reviews.length > 0) {
              console.log(`  📝 個別レビュー保存中 (${pageData.reviews.length}件)...`);

              for (const review of pageData.reviews) {
                await db.execute(sql`
                  INSERT INTO product_reviews (
                    product_id,
                    asp_name,
                    reviewer_name,
                    rating,
                    max_rating,
                    title,
                    content,
                    review_date,
                    helpful,
                    source_review_id,
                    created_at,
                    updated_at
                  )
                  VALUES (
                    ${productId},
                    'DUGA',
                    ${review.reviewerName || null},
                    ${review.rating},
                    5,
                    ${review.title || null},
                    ${review.content || null},
                    ${review.date ? new Date(review.date) : null},
                    ${review.helpfulYes},
                    ${review.reviewId || null},
                    NOW(),
                    NOW()
                  )
                  ON CONFLICT (product_id, asp_name, source_review_id)
                  DO UPDATE SET
                    reviewer_name = EXCLUDED.reviewer_name,
                    rating = EXCLUDED.rating,
                    title = EXCLUDED.title,
                    content = EXCLUDED.content,
                    helpful = EXCLUDED.helpful,
                    updated_at = NOW()
                `);
                stats.reviewsSaved++;
              }

              console.log(`  ✓ 個別レビュー保存完了`);
            } else {
              console.log(`  ℹ️  レビューなし`);
            }

            // ページスクレイピング後は追加で待機
            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (reviewError: unknown) {
            console.log(`  ⚠️ レビュー取得失敗: ${reviewError instanceof Error ? reviewError.message : reviewError}`);
          }
        }

        // 10. AI機能: 説明文生成、タグ抽出、翻訳（CrawlerAIHelper使用）
        if (enableAI) {
          try {
            console.log(`  🤖 AI機能を実行中...`);

            // 商品情報を収集
            const performerNames = item.performers?.map((p: { name: string }) => p.name) || [];
            const categoryNames = item.categories?.map((c: { name: string }) => c.name) || [];

            // CrawlerAIHelperを使用して全AI処理を並列実行
            const aiHelper = getAIHelper();
            const aiResult = await aiHelper.processProduct(
              {
                title: item.title,
                description: item.description,
                performers: performerNames.length > 0 ? performerNames : undefined,
                genres: categoryNames.length > 0 ? categoryNames : undefined,
              },
              {
                extractTags: true,
                translate: true,
                generateDescription: true,
              }
            );

            // エラーがあれば警告
            if (aiResult.errors.length > 0) {
              console.log(`    ⚠️ AI処理で一部エラー: ${aiResult.errors.join(', ')}`);
            }

            // AI説明文を保存
            if (aiResult.description) {
              console.log(`    ✅ AI説明文生成完了`);
              console.log(`       キャッチコピー: ${aiResult.description.catchphrase}`);

              try {
                await db.execute(sql`
                  UPDATE products
                  SET
                    ai_description = ${JSON.stringify(aiResult.description)}::jsonb,
                    ai_catchphrase = ${aiResult.description.catchphrase},
                    ai_short_description = ${aiResult.description.shortDescription},
                    updated_at = NOW()
                  WHERE id = ${productId}
                `);
                console.log(`    💾 AI生成データを保存しました`);
                stats.aiGenerated++;
              } catch {
                console.log(`    ⚠️ AI生成データの保存をスキップ（カラム未作成の可能性）`);
              }
            }

            // AIタグを保存
            if (aiResult.tags && (aiResult.tags.genres.length > 0 || aiResult.tags.attributes.length > 0)) {
              console.log(`    ✅ AIタグ抽出完了`);
              console.log(`       ジャンル: ${aiResult.tags.genres.join(', ') || 'なし'}`);

              try {
                await db.execute(sql`
                  UPDATE products
                  SET ai_tags = ${JSON.stringify(aiResult.tags)}::jsonb
                  WHERE id = ${productId}
                `);
              } catch {
                // スキップ
              }
            }

            // 翻訳を保存
            if (aiResult.translations) {
              console.log(`  🌐 翻訳処理完了`);
              try {
                await db.execute(sql`
                  UPDATE products
                  SET
                    title_en = ${aiResult.translations.en?.title || null},
                    title_zh = ${aiResult.translations.zh?.title || null},
                    title_ko = ${aiResult.translations.ko?.title || null},
                    description_en = ${aiResult.translations.en?.description || null},
                    description_zh = ${aiResult.translations.zh?.description || null},
                    description_ko = ${aiResult.translations.ko?.description || null},
                    updated_at = NOW()
                  WHERE id = ${productId}
                `);
                console.log(`    ✅ 翻訳保存完了`);
                if (aiResult.translations.en?.title) {
                  console.log(`       EN: ${aiResult.translations.en.title.slice(0, 50)}...`);
                }
              } catch {
                // カラム未作成の場合はスキップ
              }
            }

          } catch (aiError: unknown) {
            console.log(`    ⚠️ AI機能エラー: ${aiError instanceof Error ? aiError.message : aiError}`);
          }
        }

        // 生データを処理済みとしてマーク
        await markRawDataAsProcessed('duga', rawDataId);

        console.log();

        // レート制限対策: 1秒待機
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ エラー: ${errorMessage}\n`);
        stats.errors++;
        continue;
      }
    }

    console.log('\n=== クロール完了 ===\n');
    console.log('統計情報:');
    console.table(stats);

    // データベースの最終状態を確認
    const finalCounts = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM duga_raw_responses) as raw_data_count,
        (SELECT COUNT(*) FROM products WHERE normalized_product_id LIKE 'duga-%') as product_count,
        (SELECT COUNT(*) FROM product_sources WHERE asp_name = 'DUGA') as source_count,
        (SELECT COUNT(*) FROM product_raw_data_links WHERE source_type = 'duga') as link_count,
        (SELECT COUNT(*) FROM product_reviews WHERE asp_name = 'DUGA') as reviews_count,
        (SELECT COUNT(*) FROM product_rating_summary WHERE asp_name = 'DUGA') as rating_summary_count
    `);

    console.log('\nデータベース状態:');
    console.table(finalCounts.rows);

  } catch (error: unknown) {
    console.error('❌ クローラーエラー:', error);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
