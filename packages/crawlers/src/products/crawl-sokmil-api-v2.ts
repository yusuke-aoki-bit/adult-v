/**
 * SOKMIL API クローラー v2 (BaseCrawler使用)
 *
 * 機能:
 * - SOKMIL APIから商品データを取得
 * - 生レスポンスをGCS優先で保存（フォールバック: DB）
 * - 重複クロール防止: hash比較
 * - 重複分析防止: processedAtチェック
 * - パースしたデータを正規化テーブルに保存
 * - 双方向クロール: 新着と古い作品の両方を取得
 *
 * 使い方:
 * npx tsx packages/crawlers/src/products/crawl-sokmil-api-v2.ts [--limit 100] [--offset 0] [--no-ai] [--force] [--no-bidirectional]
 * npx tsx packages/crawlers/src/products/crawl-sokmil-api-v2.ts --full-scan --year=2024
 */

import { sql } from 'drizzle-orm';
import {
  BaseCrawler,
  generateDateRanges,
  upsertSokmilRawDataWithGcs,
  type ParsedProductData,
  type BaseCrawlerOptions,
  type UpsertRawDataResult,
} from '../lib/crawler';
import { getSokmilClient, type SokmilProduct } from '../lib/providers/sokmil-client';

/**
 * SOKMIL クローラー
 */
class SokmilCrawler extends BaseCrawler<SokmilProduct> {
  private sokmilClient = getSokmilClient();

  constructor() {
    super({
      name: 'SOKMIL API',
      aspName: 'SOKMIL',
      sourceType: 'sokmil',
    });
  }

  /**
   * SOKMIL APIからアイテムを取得
   */
  protected async fetchItems(): Promise<SokmilProduct[]> {
    const { fullScan, year } = this.cliArgs;

    if (fullScan || year) {
      return this.fetchFullScan();
    }

    return this.fetchNewReleases();
  }

  /**
   * 新着作品を取得（双方向対応: 新着と古い作品の両方を取得）
   */
  private async fetchNewReleases(): Promise<SokmilProduct[]> {
    const { limit, offset } = this.cliArgs;
    const PAGE_SIZE = 100;
    const bidirectional = !process.argv.includes('--no-bidirectional');

    this.log('info', '新着作品を取得中...');
    this.log('info', `双方向クロール: ${bidirectional ? '有効' : '無効'}`);

    const allItems: SokmilProduct[] = [];
    const seenIds = new Set<string>();
    let currentOffset = offset + 1; // Sokmil APIは1から開始

    // 最初のリクエストで総数を取得
    const firstResponse = await this.sokmilClient.searchItems({
      hits: PAGE_SIZE,
      offset: currentOffset,
      sort: 'date',
    });

    if (firstResponse.status !== 'success') {
      this.log('error', `API エラー: ${firstResponse.error}`);
      return [];
    }

    const totalCount = firstResponse.totalCount;
    this.log('info', `API総件数: ${totalCount.toLocaleString()}件`);
    this.log('info', `取得目標: ${limit === 99999 ? '全件' : limit + '件'}`);

    // ページネーションループ（新着順）
    let response = firstResponse;
    while (allItems.length < limit) {
      if (allItems.length > 0) {
        await this.waitForRateLimit();
        response = await this.sokmilClient.searchItems({
          hits: PAGE_SIZE,
          offset: currentOffset,
          sort: 'date',
        });

        if (response.status !== 'success') {
          this.log('error', `API エラー: ${response.error}`);
          break;
        }
      }

      if (response.data.length === 0) {
        this.log('info', '取得可能な商品がなくなりました');
        break;
      }

      // 重複除外
      for (const item of response.data) {
        if (!seenIds.has(item.itemId)) {
          seenIds.add(item.itemId);
          allItems.push(item);
        }
      }
      currentOffset += PAGE_SIZE;

      this.log('success', `ページ取得: ${response.data.length}件 (累計: ${allItems.length.toLocaleString()}件)`);

      if (allItems.length >= limit || response.data.length < PAGE_SIZE) {
        break;
      }

      // Sokmil APIの offset 上限は 50000
      if (currentOffset > 50000) {
        this.log('warn', 'offset上限(50000)に達しました');
        break;
      }

      // 5000件ごとに少し長めの休憩
      if (allItems.length % 5000 === 0 && allItems.length > 0) {
        this.log('info', 'レートリミット対策: 3秒待機...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // 双方向クロール: 古い作品も取得（末尾からオフセット）
    // SOKMILのAPIは降順固定なので、末尾に近いオフセットから取得
    if (bidirectional && allItems.length < limit && totalCount > allItems.length) {
      this.log('info', '\n=== 古い作品の取得 ===');

      // 末尾からのオフセットを計算（totalCountからさかのぼる）
      // offset上限50000を考慮
      const remainingLimit = Math.min(limit - allItems.length, 50000 - currentOffset);
      const startOffsetFromEnd = Math.min(Math.max(1, totalCount - remainingLimit), 50000);
      let oldOffset = startOffsetFromEnd;

      while (allItems.length < limit && oldOffset < Math.min(totalCount, 50000)) {
        await this.waitForRateLimit();

        const oldResponse = await this.sokmilClient.searchItems({
          hits: PAGE_SIZE,
          offset: oldOffset,
          sort: 'date',
        });

        if (oldResponse.status !== 'success') {
          this.log('error', `API エラー: ${oldResponse.error}`);
          break;
        }

        if (oldResponse.data.length === 0) {
          break;
        }

        let newCount = 0;
        for (const item of oldResponse.data) {
          if (!seenIds.has(item.itemId)) {
            seenIds.add(item.itemId);
            allItems.push(item);
            newCount++;
          }
        }

        oldOffset += PAGE_SIZE;

        this.log('success', `古い作品取得: ${newCount}件新規 (累計: ${allItems.length}件)`);

        if (newCount === 0 || allItems.length >= limit || oldOffset > 50000) {
          break;
        }
      }
    }

    // limitを超えた分をカット
    return allItems.slice(0, limit);
  }

  /**
   * フルスキャン（発売日範囲で全件取得）
   */
  private async fetchFullScan(): Promise<SokmilProduct[]> {
    const { limit, year, month } = this.cliArgs;
    const PAGE_SIZE = 100;
    const currentYear = new Date().getFullYear();

    this.log('info', 'フルスキャンモードで取得中...');

    // 日付範囲を生成（ISO8601形式）
    let dateRanges: Array<{ start: string; end: string }>;

    if (year && month) {
      // 特定の年月のみ
      const lastDay = new Date(year, month, 0).getDate();
      dateRanges = [{
        start: `${year}-${month.toString().padStart(2, '0')}-01T00:00:00`,
        end: `${year}-${month.toString().padStart(2, '0')}-${lastDay}T23:59:59`,
      }];
    } else if (year) {
      // 特定の年のみ（ISO8601形式に変換）
      dateRanges = generateDateRanges(year, year).map(r => ({
        start: `${r.start.slice(0, 4)}-${r.start.slice(4, 6)}-${r.start.slice(6, 8)}T00:00:00`,
        end: `${r.end.slice(0, 4)}-${r.end.slice(4, 6)}-${r.end.slice(6, 8)}T23:59:59`,
      }));
    } else {
      // 2000年から現在まで全期間
      dateRanges = generateDateRanges(2000, currentYear).map(r => ({
        start: `${r.start.slice(0, 4)}-${r.start.slice(4, 6)}-${r.start.slice(6, 8)}T00:00:00`,
        end: `${r.end.slice(0, 4)}-${r.end.slice(4, 6)}-${r.end.slice(6, 8)}T23:59:59`,
      }));
    }

    this.log('info', `取得期間: ${dateRanges.length}ヶ月分`);

    const allItems: SokmilProduct[] = [];

    for (const range of dateRanges) {
      if (allItems.length >= limit) break;

      this.log('info', `期間: ${range.start.split('T')[0]} - ${range.end.split('T')[0]}`);

      let currentOffset = 1;
      const periodItems: SokmilProduct[] = [];

      // 最初のリクエストで期間内の総数を取得
      await this.waitForRateLimit();
      const firstResponse = await this.sokmilClient.searchItems({
        hits: PAGE_SIZE,
        offset: currentOffset,
        sort: 'date',
        gte_date: range.start,
        lte_date: range.end,
      });

      if (firstResponse.status !== 'success') {
        this.log('error', `API エラー: ${firstResponse.error}`);
        continue;
      }

      if (firstResponse.totalCount === 0 || firstResponse.data.length === 0) {
        this.log('info', '  この期間には作品がありません');
        continue;
      }

      this.log('info', `  期間内件数: ${firstResponse.totalCount.toLocaleString()}件`);

      // ページネーションループ
      let response = firstResponse;
      while (true) {
        if (response.data.length === 0) break;

        periodItems.push(...response.data);
        currentOffset += PAGE_SIZE;

        this.log('success', `  取得: ${response.data.length}件 (期間累計: ${periodItems.length}件)`);

        // この期間の全件取得完了
        if (response.data.length < PAGE_SIZE || periodItems.length >= firstResponse.totalCount) {
          break;
        }

        // offset上限チェック
        if (currentOffset > 50000) {
          this.log('warn', '  offset上限(50000)に達しました');
          break;
        }

        // 全体のlimitに達したら終了
        if (allItems.length + periodItems.length >= limit) {
          break;
        }

        await this.waitForRateLimit();
        response = await this.sokmilClient.searchItems({
          hits: PAGE_SIZE,
          offset: currentOffset,
          sort: 'date',
          gte_date: range.start,
          lte_date: range.end,
        });

        if (response.status !== 'success') {
          this.log('error', `API エラー: ${response.error}`);
          break;
        }
      }

      allItems.push(...periodItems);
      this.log('info', `  期間合計: ${periodItems.length}件 (全体累計: ${allItems.length.toLocaleString()}件)`);

      // レート制限対策: 期間ごとに待機
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // limitを超えた分をカット
    return allItems.slice(0, limit);
  }

  /**
   * SokmilProductをParsedProductDataに変換
   */
  protected parseItem(item: SokmilProduct): ParsedProductData | null {
    if (!item.itemId || !item.itemName) {
      return null;
    }

    // packageImageUrl (pe_xxx.jpg) はフルサイズ、thumbnailUrl (pef_xxx_100x142.jpg) は小さい
    const thumbnailUrl = item.packageImageUrl || item.thumbnailUrl;

    return {
      normalizedProductId: `sokmil-${item.itemId}`,
      originalId: item.itemId,
      title: item.itemName,
      description: item.description,
      releaseDate: item.releaseDate,
      duration: item.duration,
      thumbnailUrl,
      sampleImages: item.sampleImages,
      packageUrl: item.packageImageUrl,
      sampleVideos: item.sampleVideoUrl ? [item.sampleVideoUrl] : undefined,
      affiliateUrl: item.affiliateUrl,
      price: item.price,
      performers: item.actors?.map(a => a.name),
      categories: [
        ...(item.genres?.map(g => g.name) || []),
        ...(item.maker ? [item.maker.name] : []),
      ],
    };
  }

  /**
   * 生データを保存（SOKMIL専用）
   */
  protected async saveRawData(originalId: string, rawData: Record<string, unknown>): Promise<UpsertRawDataResult> {
    return upsertSokmilRawDataWithGcs(originalId, 'item', rawData);
  }

  /**
   * テーブル名を取得
   */
  protected getTableName(): 'sokmil_raw_responses' {
    return 'sokmil_raw_responses';
  }

  /**
   * 関連データを保存（メーカー/レーベルをカテゴリとして保存）
   */
  protected async saveRelatedData(productId: number, parsed: ParsedProductData): Promise<void> {
    // 親クラスの処理（画像、動画、出演者、タグ）
    await super.saveRelatedData(productId, parsed);

    // 元のアイテムを取得して追加のカテゴリ保存
    // parsed には元のSokmilProductがないため、categoriesでメーカー名を渡している
  }
}

// メイン実行
const crawler = new SokmilCrawler();
crawler.run().then((result) => {
  if (!result.success) {
    process.exit(1);
  }
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
