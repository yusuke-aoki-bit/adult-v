/**
 * DUGA API クローラー v2 (BaseCrawler使用)
 *
 * 機能:
 * - DUGA APIから商品データを取得
 * - 生レスポンスをGCS優先で保存（フォールバック: DB）
 * - 重複クロール防止: hash比較
 * - 重複分析防止: processedAtチェック
 * - 商品ページからレビュー情報をスクレイピング
 *
 * 使い方:
 * npx tsx packages/crawlers/src/products/crawl-duga-api-v2.ts [--limit 100] [--offset 0] [--skip-reviews] [--no-ai] [--force]
 * npx tsx packages/crawlers/src/products/crawl-duga-api-v2.ts --full-scan --year=2024
 */

import { sql } from 'drizzle-orm';
import {
  BaseCrawler,
  generateDateRanges,
  runCrawler,
  upsertDugaRawDataWithGcs,
  type ParsedProductData,
  type BaseCrawlerOptions,
  type UpsertRawDataResult,
} from '../lib/crawler';
import { getDugaClient, type DugaProduct } from '../lib/providers/duga-client';
import { scrapeDugaProductPage } from '../lib/providers/duga-page-scraper';

/**
 * DUGA クローラー
 */
class DugaCrawler extends BaseCrawler<DugaProduct> {
  private dugaClient = getDugaClient();

  constructor() {
    super({
      name: 'DUGA API',
      aspName: 'DUGA',
      sourceType: 'duga',
    });
  }

  /**
   * DUGA APIからアイテムを取得
   */
  protected async fetchItems(): Promise<DugaProduct[]> {
    const { limit, offset, fullScan, year, month } = this.cliArgs;

    if (fullScan || year) {
      return this.fetchFullScan();
    }

    return this.fetchNewReleases();
  }

  /**
   * 新着作品を取得
   */
  private async fetchNewReleases(): Promise<DugaProduct[]> {
    const { limit, offset } = this.cliArgs;
    const PAGE_SIZE = 100;

    this.log('info', '新着作品を取得中...');

    const allItems: DugaProduct[] = [];
    let currentOffset = offset;
    let totalProcessed = 0;

    // 最初のリクエストで総数を取得
    const firstResponse = await this.dugaClient.getNewReleases(PAGE_SIZE, currentOffset);
    this.log('info', `API総件数: ${firstResponse.count.toLocaleString()}件`);
    this.log('info', `取得目標: ${limit === 99999 ? '全件' : limit + '件'}`);

    // ページネーションループ
    let response = firstResponse;
    while (totalProcessed < limit) {
      if (totalProcessed > 0) {
        await this.waitForRateLimit();
        response = await this.dugaClient.getNewReleases(PAGE_SIZE, currentOffset);
      }

      if (response.items.length === 0) {
        this.log('info', '取得可能な商品がなくなりました');
        break;
      }

      allItems.push(...response.items);
      totalProcessed += response.items.length;
      currentOffset += PAGE_SIZE;

      this.log('success', `ページ取得: ${response.items.length}件 (累計: ${totalProcessed.toLocaleString()}件)`);

      if (totalProcessed >= limit || response.items.length < PAGE_SIZE) {
        break;
      }
    }

    // limitを超えた分をカット
    return allItems.slice(0, limit);
  }

  /**
   * フルスキャン（発売日範囲で全件取得）
   */
  private async fetchFullScan(): Promise<DugaProduct[]> {
    const { limit, year, month } = this.cliArgs;
    const PAGE_SIZE = 100;
    const currentYear = new Date().getFullYear();

    this.log('info', 'フルスキャンモードで取得中...');

    // 日付範囲を生成
    let dateRanges: Array<{ start: string; end: string }>;

    if (year && month) {
      // 特定の年月のみ
      const lastDay = new Date(year, month, 0).getDate();
      dateRanges = [{
        start: `${year}${month.toString().padStart(2, '0')}01`,
        end: `${year}${month.toString().padStart(2, '0')}${lastDay}`,
      }];
    } else if (year) {
      // 特定の年のみ
      dateRanges = generateDateRanges(year, year);
    } else {
      // 2000年から現在まで全期間
      dateRanges = generateDateRanges(2000, currentYear);
    }

    this.log('info', `取得期間: ${dateRanges.length}ヶ月分`);

    const allItems: DugaProduct[] = [];

    for (const range of dateRanges) {
      if (allItems.length >= limit) break;

      this.log('info', `期間: ${range.start} - ${range.end}`);

      let currentOffset = 0;
      const periodItems: DugaProduct[] = [];

      // 最初のリクエストで期間内の総数を取得
      const firstResponse = await this.dugaClient.searchProducts({
        releasestt: range.start,
        releaseend: range.end,
        hits: PAGE_SIZE,
        offset: currentOffset,
        adult: 1,
        sort: 'release',
      });

      if (firstResponse.count === 0) {
        this.log('info', '  この期間には作品がありません');
        continue;
      }

      this.log('info', `  期間内件数: ${firstResponse.count.toLocaleString()}件`);

      // ページネーションループ
      let response = firstResponse;
      while (true) {
        if (periodItems.length > 0) {
          await this.waitForRateLimit();
          response = await this.dugaClient.searchProducts({
            releasestt: range.start,
            releaseend: range.end,
            hits: PAGE_SIZE,
            offset: currentOffset,
            adult: 1,
            sort: 'release',
          });
        }

        if (response.items.length === 0) break;

        periodItems.push(...response.items);
        currentOffset += PAGE_SIZE;

        this.log('success', `  取得: ${response.items.length}件 (期間累計: ${periodItems.length}件)`);

        // この期間の全件取得完了
        if (response.items.length < PAGE_SIZE || periodItems.length >= firstResponse.count) {
          break;
        }

        // 全体のlimitに達したら終了
        if (allItems.length + periodItems.length >= limit) {
          break;
        }
      }

      allItems.push(...periodItems);
      this.log('info', `  期間合計: ${periodItems.length}件 (全体累計: ${allItems.length.toLocaleString()}件)`);

      // レート制限対策: 期間ごとに待機
      await this.waitForRateLimit();
    }

    // limitを超えた分をカット
    return allItems.slice(0, limit);
  }

  /**
   * DugaProductをParsedProductDataに変換
   */
  protected parseItem(item: DugaProduct): ParsedProductData | null {
    if (!item.productId || !item.title) {
      return null;
    }

    return {
      normalizedProductId: `duga-${item.productId}`,
      originalId: item.productId,
      title: item.title,
      description: item.description,
      releaseDate: item.releaseDate,
      duration: item.duration,
      thumbnailUrl: item.thumbnailUrl,
      sampleImages: item.sampleImages,
      packageUrl: item.packageUrl,
      sampleVideos: item.sampleVideos,
      affiliateUrl: item.affiliateUrl,
      price: item.price,
      performers: item.performers?.map(p => p.name),
      categories: item.categories?.map(c => c.name),
      saleInfo: item.saleInfo ? {
        regularPrice: item.saleInfo.regularPrice,
        salePrice: item.saleInfo.salePrice,
        discountPercent: item.saleInfo.discountPercent || 0,
        saleType: item.saleInfo.saleType,
        saleName: item.saleInfo.saleName,
      } : undefined,
    };
  }

  /**
   * 生データを保存（DUGA専用）
   */
  protected async saveRawData(originalId: string, rawData: Record<string, unknown>): Promise<UpsertRawDataResult> {
    return upsertDugaRawDataWithGcs(originalId, rawData);
  }

  /**
   * テーブル名を取得（DUGAはsaveRawDataをオーバーライドしているため呼ばれないが、型の整合性のため実装）
   */
  protected getTableName(): 'duga_raw_responses' {
    return 'duga_raw_responses';
  }

  /**
   * アイテム処理後のフック（レビュー取得）
   */
  protected async processItem(rawItem: DugaProduct, index: number, total: number): Promise<void> {
    // 基本処理
    await super.processItem(rawItem, index, total);

    // レビュー取得（skipReviewsでない場合）
    if (!this.getEffectiveSkipReviews() && rawItem.productId) {
      await this.fetchReviews(rawItem.productId);
    }
  }

  /**
   * レビューを取得してDBに保存
   */
  private async fetchReviews(productId: string): Promise<void> {
    try {
      console.log(`  📝 レビュー情報取得中...`);

      const pageData = await scrapeDugaProductPage(productId);

      // 商品IDを取得（DBから）
      const normalizedId = `duga-${productId}`;
      const productResult = await this.db.execute(sql`
        SELECT id FROM products WHERE normalized_product_id = ${normalizedId}
      `);

      if (!productResult.rows || productResult.rows.length === 0) {
        return;
      }

      const dbProductId = (productResult.rows[0] as { id: number }).id;

      // 集計評価を保存
      if (pageData.aggregateRating) {
        this.stats.reviewsFetched = (this.stats.reviewsFetched || 0) + pageData.aggregateRating.reviewCount;
        await this.saveAggregateRating(dbProductId, {
          averageRating: pageData.aggregateRating.averageRating,
          bestRating: pageData.aggregateRating.bestRating,
          worstRating: pageData.aggregateRating.worstRating,
          reviewCount: pageData.aggregateRating.reviewCount,
        });
      }

      // 個別レビューを保存
      if (pageData.reviews.length > 0) {
        const reviews = pageData.reviews.map(r => ({
          reviewId: r.reviewId,
          reviewerName: r.reviewerName,
          rating: r.rating,
          title: r.title,
          content: r.content,
          date: r.date,
          helpfulYes: r.helpfulYes,
        }));
        await this.saveReviews(dbProductId, reviews);
      } else {
        console.log(`  ℹ️ レビューなし`);
      }

      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(`  ⚠️ レビュー取得失敗: ${error instanceof Error ? error.message : error}`);
    }
  }
}

// メイン実行
const crawler = new DugaCrawler();
crawler.run().then((result) => {
  if (!result.success) {
    process.exit(1);
  }
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
