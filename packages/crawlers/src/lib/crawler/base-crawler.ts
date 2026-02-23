/**
 * ベースクローラークラス
 *
 * 全クローラーで共通の機能を提供:
 * - レート制限
 * - 統計追跡
 * - CLI引数パース
 * - ログ出力
 * - DB操作ヘルパー
 * - 商品/出演者/タグの保存処理
 */

import { sql, SQL } from 'drizzle-orm';
import { getDb, type DbContext, type DbInstance } from '../db';
import type { ExtendedCrawlStats, IdRow, CrawlOptions, CrawlResult } from './types';
import { getFirstRow } from './types';
import { RateLimiter, getRateLimiterForSite } from './rate-limiter';
import { robustFetch, crawlerLog } from './index';
import { validateProductData, type ProductValidation } from '../crawler-utils';
import {
  upsertRawHtmlDataWithGcs,
  linkProductToRawData,
  markRawDataAsProcessed,
  type SourceType,
  type RawDataTable,
  type UpsertRawDataResult,
} from './dedup-helper';
import { processProductPerformers, ensureTags, linkProductToTags, saveProductImages } from './batch-helpers';
import { CrawlerAIHelper, getAIHelper } from './ai-helper';
import { saveSaleInfo } from '../sale-helper';
import { processProductIdentity, type ProductForMatching } from '../product-identity';
import { DatabaseError, CrawlerErrorCode, wrapError } from '../errors/crawler-errors';

// ============================================================
// Types
// ============================================================

/**
 * クローラーオプション
 */
export interface BaseCrawlerOptions {
  /** クローラー名（ログ出力用） */
  name: string;
  /** ASP名（DB保存用） */
  aspName: string;
  /** ソースタイプ（生データ保存用） */
  sourceType: SourceType;
  /** AIによる説明文生成を有効にするか */
  enableAI?: boolean;
  /** 強制的に再処理するか */
  forceReprocess?: boolean;
  /** レビュー取得をスキップするか */
  skipReviews?: boolean;
}

/**
 * 拡張統計情報
 */
export interface CrawlerStats extends ExtendedCrawlStats {
  /** スキップした数（変更なし） */
  skippedUnchanged: number;
  /** スキップした数（無効データ） */
  skippedInvalid: number;
  /** 開始時刻 */
  startedAt: Date;
  /** 完了時刻 */
  completedAt?: Date;
  /** 処理時間（ミリ秒） */
  durationMs?: number;
  /** レビュー取得数（必須化） */
  reviewsFetched: number;
  /** レビュー保存数（必須化） */
  reviewsSaved: number;
  /** AI生成数（必須化） */
  aiGenerated: number;
  /** セール保存数（必須化） */
  salesSaved: number;
}

/**
 * パース済み商品データ（各クローラーで実装）
 */
export interface ParsedProductData {
  /** normalized_product_id (asp_name-original_id形式) */
  normalizedProductId: string;
  /** 元のID */
  originalId: string;
  /** タイトル */
  title: string;
  /** 説明文 */
  description?: string;
  /** 発売日 */
  releaseDate?: string;
  /** 再生時間（分） */
  duration?: number;
  /** サムネイルURL */
  thumbnailUrl?: string;
  /** サンプル画像URLs */
  sampleImages?: string[];
  /** パッケージ画像URL */
  packageUrl?: string;
  /** サンプル動画URLs */
  sampleVideos?: string[];
  /** アフィリエイトURL */
  affiliateUrl?: string;
  /** 価格 */
  price?: number;
  /** 出演者名 */
  performers?: string[];
  /** カテゴリ/ジャンル */
  categories?: string[];
  /** セール情報 */
  saleInfo?: {
    regularPrice: number;
    salePrice: number;
    discountPercent: number;
    saleType?: string;
    saleName?: string;
  };
  /** レビュー情報 */
  reviews?: Array<{
    reviewId?: string;
    reviewerName?: string;
    rating: number;
    title?: string;
    content?: string;
    date?: string;
    helpfulYes?: number;
  }>;
  /** 集計評価 */
  aggregateRating?: {
    averageRating: number;
    bestRating: number;
    worstRating: number;
    reviewCount: number;
  };
}

/**
 * CLI引数のパース結果
 */
export interface ParsedCliArgs {
  limit: number;
  offset: number;
  enableAI: boolean;
  forceReprocess: boolean;
  skipReviews: boolean;
  fullScan: boolean;
  year?: number;
  month?: number;
  startId?: string;
  customArgs: Record<string, string | boolean>;
}

// ============================================================
// Base Crawler Class
// ============================================================

/**
 * ベースクローラー抽象クラス
 *
 * 使用例:
 * ```typescript
 * class DugaCrawler extends BaseCrawler {
 *   protected async fetchItems(): Promise<RawItem[]> {
 *     // APIからアイテムを取得
 *   }
 *
 *   protected parseItem(rawItem: RawItem): ParsedProductData {
 *     // 生データをパース
 *   }
 * }
 *
 * const crawler = new DugaCrawler({ name: 'DUGA', aspName: 'DUGA', sourceType: 'duga' });
 * await crawler.run();
 * ```
 */
export abstract class BaseCrawler<TRawItem = unknown> {
  protected db: DbInstance;
  protected rateLimiter: RateLimiter;
  protected stats: CrawlerStats;
  protected options: BaseCrawlerOptions;
  protected cliArgs: ParsedCliArgs;
  protected aiHelper: CrawlerAIHelper;

  constructor(options: BaseCrawlerOptions) {
    this.options = options;
    this.db = getDb();
    this.rateLimiter = getRateLimiterForSite(options.sourceType);
    this.cliArgs = this.parseCliArgs();
    this.stats = this.initStats();
    this.aiHelper = getAIHelper();
  }

  // ============================================================
  // Abstract Methods (Must be implemented by subclasses)
  // ============================================================

  /**
   * アイテムを取得（各クローラーで実装）
   */
  protected abstract fetchItems(): Promise<TRawItem[]>;

  /**
   * 生データをパース（各クローラーで実装）
   */
  protected abstract parseItem(rawItem: TRawItem): ParsedProductData | null;

  /**
   * 生データを保存用のJSONに変換（オプション）
   */
  protected getRawDataJson(rawItem: TRawItem): Record<string, unknown> {
    return rawItem as Record<string, unknown>;
  }

  // ============================================================
  // Public Methods
  // ============================================================

  /**
   * クローラーを実行
   */
  async run(): Promise<CrawlResult> {
    this.printHeader();

    try {
      // 1. アイテムを取得
      this.log('info', 'アイテム取得中...');
      const items = await this.fetchItems();
      this.stats.totalFetched = items.length;
      this.log('success', `${items.length.toLocaleString()}件取得完了`);

      // 2. 各アイテムを処理
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        if (item !== undefined) {
          await this.processItem(item, index, items.length);
        }
      }

      // 3. 完了処理
      this.stats.completedAt = new Date();
      this.stats.durationMs = this.stats.completedAt.getTime() - this.stats.startedAt.getTime();

      this.printSummary();

      return {
        success: true,
        stats: this.stats,
      };
    } catch (error) {
      this.log('error', `クローラーエラー: ${error instanceof Error ? error.message : error}`);
      return {
        success: false,
        stats: this.stats,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  // ============================================================
  // Protected Methods (Available to subclasses)
  // ============================================================

  /**
   * CLI引数をパース
   */
  protected parseCliArgs(): ParsedCliArgs {
    const args = process.argv.slice(2);

    const getArg = (name: string): string | undefined => {
      const arg = args.find((a) => a.startsWith(`--${name}=`));
      return arg ? arg.split('=')[1] : undefined;
    };

    const hasFlag = (name: string): boolean => args.includes(`--${name}`);

    // カスタム引数を収集
    const customArgs: Record<string, string | boolean> = {};
    args.forEach((arg) => {
      if (arg.startsWith('--')) {
        const [key, value] = arg.slice(2).split('=');
        if (
          key &&
          !['limit', 'offset', 'no-ai', 'force', 'skip-reviews', 'full-scan', 'year', 'month', 'start-id'].includes(key)
        ) {
          customArgs[key] = value !== undefined ? value : true;
        }
      }
    });

    const yearArg = getArg('year');
    const monthArg = getArg('month');
    const startIdArg = getArg('start-id');
    return {
      limit: parseInt(getArg('limit') || '100', 10),
      offset: parseInt(getArg('offset') || '0', 10),
      enableAI: !hasFlag('no-ai'),
      forceReprocess: hasFlag('force'),
      skipReviews: hasFlag('skip-reviews'),
      fullScan: hasFlag('full-scan'),
      ...(yearArg !== undefined && { year: parseInt(yearArg, 10) }),
      ...(monthArg !== undefined && { month: parseInt(monthArg, 10) }),
      ...(startIdArg !== undefined && { startId: startIdArg }),
      customArgs,
    };
  }

  /**
   * 統計情報を初期化
   */
  protected initStats(): CrawlerStats {
    return {
      totalFetched: 0,
      newProducts: 0,
      updatedProducts: 0,
      errors: 0,
      rawDataSaved: 0,
      skippedUnchanged: 0,
      skippedInvalid: 0,
      reviewsFetched: 0,
      reviewsSaved: 0,
      aiGenerated: 0,
      salesSaved: 0,
      startedAt: new Date(),
    };
  }

  /**
   * ログ出力
   */
  protected log(level: 'info' | 'warn' | 'error' | 'success', message: string, ...args: unknown[]): void {
    const prefix = `[${this.options['name']}]`;
    switch (level) {
      case 'info':
        console.log(`${prefix} ${message}`, ...args);
        break;
      case 'warn':
        console.warn(`${prefix} ⚠️ ${message}`, ...args);
        break;
      case 'error':
        console.error(`${prefix} ❌ ${message}`, ...args);
        break;
      case 'success':
        console.log(`${prefix} ✅ ${message}`, ...args);
        break;
    }
  }

  /**
   * 進捗ログ
   */
  protected logProgress(current: number, total: number, message: string): void {
    const percent = Math.round((current / total) * 100);
    console.log(`[${this.options['name']}] [${current}/${total}] (${percent}%) ${message}`);
  }

  /**
   * レート制限付きfetch
   */
  protected async fetch(url: string, init?: RequestInit): Promise<Response> {
    return robustFetch(url, {
      ...(init !== undefined && { init }),
      rateLimiter: this.rateLimiter,
    });
  }

  /**
   * レート制限の待機
   */
  protected async waitForRateLimit(): Promise<void> {
    await this.rateLimiter.wait();
    this.rateLimiter.done();
  }

  /**
   * 商品データを検証
   */
  protected validateProduct(data: { title: string; description?: string; originalId: string }): ProductValidation {
    return validateProductData({
      title: data['title'],
      ...(data['description'] !== undefined && { description: data['description'] }),
      aspName: this.options['aspName'],
      originalId: data.originalId,
    });
  }

  // ============================================================
  // Item Processing
  // ============================================================

  /**
   * 単一アイテムを処理
   *
   * トランザクションを使用してデータの整合性を保証:
   * - 生データ保存（GCS/重複チェック）はトランザクション外
   * - 商品保存、リンク作成、関連データ保存はトランザクション内
   * - AI処理はトランザクション外（長時間処理のため）
   */
  protected async processItem(rawItem: TRawItem, index: number, total: number): Promise<void> {
    try {
      // 1. パース
      const parsed = this.parseItem(rawItem);
      if (!parsed) {
        this.stats.skippedInvalid++;
        return;
      }

      this.logProgress(index + 1, total, `処理中: ${parsed.title.slice(0, 50)}...`);

      // 2. 検証
      const validation = this.validateProduct({
        title: parsed.title,
        ...(parsed.description !== undefined && { description: parsed.description }),
        originalId: parsed.originalId,
      });

      if (!validation.isValid) {
        console.log(`  ⚠️ スキップ(無効): ${validation.reason}`);
        this.stats.skippedInvalid++;
        return;
      }

      // 3. 生データ保存（重複チェック） - トランザクション外
      // GCS保存を含むため、トランザクションの外で実行
      const rawDataJson = this.getRawDataJson(rawItem);
      const upsertResult = await this.saveRawData(parsed.originalId, rawDataJson);

      if (upsertResult.shouldSkip && !this.getEffectiveForceReprocess()) {
        console.log(`  ⏭️ スキップ(処理済み): ${parsed.originalId}`);
        this.stats.skippedUnchanged++;
        return;
      }

      if (upsertResult.isNew || !upsertResult.shouldSkip) {
        this.stats.rawDataSaved++;
        const storageType = upsertResult.gcsUrl ? '[GCS]' : '[DB]';
        console.log(`  ✓ 生データ${upsertResult.isNew ? '保存' : '更新'} (raw_id: ${upsertResult.id}) ${storageType}`);
      }

      // 4-7. DB操作をトランザクションで実行
      let productId: number;
      try {
        productId = await this.db.transaction(async (tx) => {
          // 4. 商品保存
          const pId = await this.saveProduct(parsed, tx);

          // 5. リンク作成
          await linkProductToRawData(
            pId,
            this.options.sourceType,
            upsertResult.id,
            this.getTableName(),
            upsertResult.gcsUrl || `hash:${upsertResult.id}`,
            tx,
          );

          // 6. 関連データ保存
          await this.saveRelatedData(pId, parsed, tx);

          // 7. 商品同一性マッチング
          await this.processIdentity(pId, parsed, tx);

          // 9. 処理済みマーク
          await markRawDataAsProcessed(this.options.sourceType, upsertResult.id, tx);

          return pId;
        });
      } catch (error) {
        // トランザクションエラーをラップ
        const crawlerError = wrapError(error, {
          operation: 'processItem.transaction',
          productId: parsed.normalizedProductId,
        });
        throw new DatabaseError(`トランザクション失敗: ${crawlerError.message}`, CrawlerErrorCode.DB_TRANSACTION, {
          operation: 'processItem',
          ...(error instanceof Error && { originalError: error }),
        });
      }

      // 8. AI処理（トランザクション外 - 長時間処理のため）
      if (this.getEffectiveEnableAI()) {
        await this.processAI(productId, parsed);
      }

      console.log();

      // レート制限
      await this.waitForRateLimit();
    } catch (error) {
      this.log('error', `処理エラー: ${error instanceof Error ? error.message : error}`);
      this.stats.errors++;
    }
  }

  /**
   * 生データを保存
   */
  protected async saveRawData(originalId: string, rawData: Record<string, unknown>): Promise<UpsertRawDataResult> {
    return upsertRawHtmlDataWithGcs(this.options['aspName'], originalId, '', JSON.stringify(rawData));
  }

  /**
   * 商品をDB保存
   * @param tx - オプションのトランザクションコンテキスト
   */
  protected async saveProduct(data: ParsedProductData, tx?: DbContext): Promise<number> {
    const dbCtx = tx || this.db;
    const result = await dbCtx.execute(sql`
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
        ${data.normalizedProductId},
        ${data['title']},
        ${data['description'] || null},
        ${data['releaseDate'] || null},
        ${data['duration'] || null},
        ${data['thumbnailUrl'] || null},
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

    const row = getFirstRow<IdRow>(result);
    const productId = row!.id;

    const isNew = result.rowCount === 1;
    if (isNew) {
      this.stats.newProducts++;
      console.log(`  ✓ 新規商品作成 (product_id: ${productId})`);
    } else {
      this.stats.updatedProducts++;
      console.log(`  ✓ 商品更新 (product_id: ${productId})`);
    }

    // product_sources保存
    await dbCtx.execute(sql`
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
        ${this.options['aspName']},
        ${data.originalId},
        ${data['affiliateUrl'] || ''},
        ${data['price'] || null},
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

    return productId;
  }

  /**
   * 関連データを保存（画像、出演者、カテゴリ、セール情報）
   * @param tx - オプションのトランザクションコンテキスト
   */
  protected async saveRelatedData(productId: number, data: ParsedProductData, tx?: DbContext): Promise<void> {
    // サンプル画像
    if (data.sampleImages && data.sampleImages.length > 0) {
      await this.saveSampleImages(productId, data.sampleImages, tx);
    }

    // パッケージ画像
    if (data.packageUrl) {
      await this.savePackageImage(productId, data.packageUrl, tx);
    }

    // サンプル動画
    if (data.sampleVideos && data.sampleVideos.length > 0) {
      await this.saveSampleVideos(productId, data.sampleVideos, tx);
    }

    // 出演者（wiki_crawl_data優先）
    if (data.performers && data.performers.length > 0) {
      const result = await processProductPerformers(
        productId,
        data.performers,
        data['title'],
        data.originalId, // 品番（wiki検索用）
        this.options['aspName'], // ASPプレフィックス
        tx,
      );
      console.log(`  ✓ 出演者保存完了 (${result.added}/${result.total}人)`);
    }

    // カテゴリ/タグ
    if (data.categories && data.categories.length > 0) {
      await this.saveCategories(productId, data.categories, tx);
    }

    // セール情報
    if (data.saleInfo) {
      try {
        const saved = await saveSaleInfo(this.options['aspName'], data.originalId, data.saleInfo);
        if (saved) {
          this.stats.salesSaved++;
          console.log(
            `  💰 セール情報保存: ¥${data.saleInfo.regularPrice.toLocaleString()} → ¥${data.saleInfo.salePrice.toLocaleString()} (${data.saleInfo.discountPercent}% OFF)`,
          );
        }
      } catch (error) {
        console.log(`  ⚠️ セール情報保存失敗: ${error instanceof Error ? error.message : error}`);
      }
    }

    // レビュー
    if (!this.getEffectiveSkipReviews() && data.reviews && data.reviews.length > 0) {
      await this.saveReviews(productId, data.reviews, tx);
    }

    // 集計評価
    if (data.aggregateRating) {
      await this.saveAggregateRating(productId, data.aggregateRating, tx);
    }
  }

  /**
   * 商品同一性マッチングを処理
   * @param tx - オプションのトランザクションコンテキスト（将来的に使用予定）
   */
  protected async processIdentity(productId: number, data: ParsedProductData, _tx?: DbContext): Promise<void> {
    try {
      // ProductForMatching 形式に変換
      const productForMatching: ProductForMatching = {
        id: productId,
        normalizedProductId: data.normalizedProductId,
        makerProductCode: null, // maker_product_code は後でDBから取得するか、parsedに追加する必要がある
        title: data['title'],
        releaseDate: data['releaseDate'] ? new Date(data['releaseDate']) : null,
        duration: data['duration'] || null,
        aspName: this.options['aspName'],
        performers: data.performers || [],
      };

      // TODO: processProductIdentity もトランザクション対応が必要
      const result = await processProductIdentity(productForMatching);

      if (result.action === 'created') {
        console.log(`  🔗 同一性グループ作成 (group_id: ${result.groupId})`);
      } else if (result.action === 'added') {
        const method = result.matchResult?.matchingMethod || 'unknown';
        const confidence = result.matchResult?.confidenceScore || 0;
        console.log(
          `  🔗 既存グループに追加 (group_id: ${result.groupId}, method: ${method}, confidence: ${confidence}%)`,
        );
      }
      // 'skipped' の場合は既にグループに所属しているためログなし
    } catch (error) {
      // 同一性マッチングエラーはクローラー処理を止めない
      console.log(`  ⚠️ 同一性マッチングエラー: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * サンプル画像を保存
   * @param tx - オプションのトランザクションコンテキスト
   */
  protected async saveSampleImages(productId: number, imageUrls: string[], tx?: DbContext): Promise<void> {
    const dbCtx = tx || this.db;
    console.log(`  📷 サンプル画像保存中 (${imageUrls.length}枚)...`);

    // 既存の画像を削除
    await dbCtx.execute(sql`
      DELETE FROM product_images
      WHERE product_id = ${productId}
      AND asp_name = ${this.options['aspName']}
      AND image_type = 'sample'
    `);

    // 新しい画像をバッチ挿入
    if (imageUrls.length > 0) {
      const valuesClauses = imageUrls.map(
        (imageUrl, index) => sql`(${productId}, ${this.options['aspName']}, ${imageUrl}, 'sample', ${index})`,
      );
      await dbCtx.execute(sql`
        INSERT INTO product_images (product_id, asp_name, image_url, image_type, display_order)
        VALUES ${sql.join(valuesClauses, sql`, `)}
      `);
    }

    console.log(`  ✓ サンプル画像保存完了`);
  }

  /**
   * パッケージ画像を保存
   * @param tx - オプションのトランザクションコンテキスト
   */
  protected async savePackageImage(productId: number, imageUrl: string, tx?: DbContext): Promise<void> {
    const dbCtx = tx || this.db;
    await dbCtx.execute(sql`
      INSERT INTO product_images (
        product_id,
        asp_name,
        image_url,
        image_type,
        display_order
      )
      VALUES (
        ${productId},
        ${this.options['aspName']},
        ${imageUrl},
        'package',
        0
      )
      ON CONFLICT DO NOTHING
    `);

    console.log(`  ✓ パッケージ画像保存完了`);
  }

  /**
   * サンプル動画を保存
   * @param tx - オプションのトランザクションコンテキスト
   */
  protected async saveSampleVideos(productId: number, videoUrls: string[], tx?: DbContext): Promise<void> {
    const dbCtx = tx || this.db;
    console.log(`  🎬 サンプル動画保存中 (${videoUrls.length}件)...`);

    // 既存の動画を削除
    await dbCtx.execute(sql`
      DELETE FROM product_videos
      WHERE product_id = ${productId}
      AND asp_name = ${this.options['aspName']}
    `);

    // 新しい動画をバッチ挿入
    if (videoUrls.length > 0) {
      const valuesClauses = videoUrls.map(
        (videoUrl, index) => sql`(${productId}, ${this.options['aspName']}, ${videoUrl}, 'sample', ${index})`,
      );
      await dbCtx.execute(sql`
        INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
        VALUES ${sql.join(valuesClauses, sql`, `)}
      `);
    }

    console.log(`  ✓ サンプル動画保存完了`);
  }

  /**
   * カテゴリ/タグを保存
   * @param tx - オプションのトランザクションコンテキスト
   */
  protected async saveCategories(productId: number, categories: string[], tx?: DbContext): Promise<void> {
    const dbCtx = tx || this.db;
    console.log(`  🏷️ カテゴリ/タグ保存中 (${categories.length}件)...`);

    if (categories.length === 0) {
      return;
    }

    // 1. categories一括UPSERT
    const catValuesClauses = categories.map((name) => sql`(${name})`);
    const catResult = await dbCtx.execute(sql`
      INSERT INTO categories (name)
      VALUES ${sql.join(catValuesClauses, sql`, `)}
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name
    `);

    // 2. product_categories一括INSERT
    const catLinks = catResult.rows.map((row) => sql`(${productId}, ${row['id'] as number})`);
    if (catLinks.length > 0) {
      await dbCtx.execute(sql`
        INSERT INTO product_categories (product_id, category_id)
        VALUES ${sql.join(catLinks, sql`, `)}
        ON CONFLICT DO NOTHING
      `);
    }

    // 3. tags一括UPSERT
    const tagValuesClauses = categories.map((name) => sql`(${name}, 'genre')`);
    const tagResult = await dbCtx.execute(sql`
      INSERT INTO tags (name, category)
      VALUES ${sql.join(tagValuesClauses, sql`, `)}
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name
    `);

    // 4. product_tags一括INSERT
    const tagLinks = tagResult.rows.map((row) => sql`(${productId}, ${row['id'] as number})`);
    if (tagLinks.length > 0) {
      await dbCtx.execute(sql`
        INSERT INTO product_tags (product_id, tag_id)
        VALUES ${sql.join(tagLinks, sql`, `)}
        ON CONFLICT DO NOTHING
      `);
    }

    console.log(`  ✓ カテゴリ/タグ保存完了`);
  }

  /**
   * レビューを保存
   * @param tx - オプションのトランザクションコンテキスト
   */
  protected async saveReviews(
    productId: number,
    reviews: NonNullable<ParsedProductData['reviews']>,
    tx?: DbContext,
  ): Promise<void> {
    const dbCtx = tx || this.db;
    console.log(`  📝 レビュー保存中 (${reviews.length}件)...`);

    if (reviews.length > 0) {
      const valuesClauses = reviews.map(
        (review) =>
          sql`(${productId}, ${this.options['aspName']}, ${review.reviewerName || null}, ${review['rating']}, 5, ${review['title'] || null}, ${review.content || null}, ${review.date ? new Date(review.date) : null}, ${review.helpfulYes || null}, ${review.reviewId || null}, NOW(), NOW())`,
      );
      await dbCtx.execute(sql`
        INSERT INTO product_reviews (
          product_id, asp_name, reviewer_name, rating, max_rating,
          title, content, review_date, helpful, source_review_id,
          created_at, updated_at
        )
        VALUES ${sql.join(valuesClauses, sql`, `)}
        ON CONFLICT (product_id, asp_name, source_review_id)
        DO UPDATE SET
          reviewer_name = EXCLUDED.reviewer_name,
          rating = EXCLUDED.rating,
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          helpful = EXCLUDED.helpful,
          updated_at = NOW()
      `);
      this.stats.reviewsSaved += reviews.length;
    }

    this.stats.reviewsFetched = (this.stats.reviewsFetched || 0) + reviews.length;
    console.log(`  ✓ レビュー保存完了`);
  }

  /**
   * 集計評価を保存
   * @param tx - オプションのトランザクションコンテキスト
   */
  protected async saveAggregateRating(
    productId: number,
    rating: NonNullable<ParsedProductData['aggregateRating']>,
    tx?: DbContext,
  ): Promise<void> {
    const dbCtx = tx || this.db;
    await dbCtx.execute(sql`
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
        ${this.options['aspName']},
        ${rating.averageRating},
        ${rating.bestRating},
        ${rating.reviewCount},
        ${JSON.stringify({ worstRating: rating.worstRating })}::jsonb,
        NOW()
      )
      ON CONFLICT (product_id, asp_name)
      DO UPDATE SET
        average_rating = EXCLUDED.average_rating,
        total_reviews = EXCLUDED.total_reviews,
        rating_distribution = EXCLUDED.rating_distribution,
        last_updated = NOW()
    `);

    console.log(`  ✓ 評価サマリー保存完了 (${rating.averageRating}点, ${rating.reviewCount}件)`);
  }

  /**
   * AI処理（説明文生成、タグ抽出、翻訳）
   * CrawlerAIHelperを使用して並列処理を行う
   */
  protected async processAI(productId: number, data: ParsedProductData): Promise<void> {
    try {
      console.log(`  🤖 AI機能を実行中...`);

      // CrawlerAIHelperを使用して全AI処理を並列実行
      const aiResult = await this.aiHelper.processProduct(
        {
          title: data['title'],
          ...(data['description'] !== undefined && { description: data['description'] }),
          ...(data.performers !== undefined && { performers: data.performers }),
          ...(data.categories !== undefined && { genres: data.categories }),
        },
        {
          extractTags: true,
          translate: true,
          generateDescription: true,
        },
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
          await this.db.execute(sql`
            UPDATE products
            SET
              ai_description = ${JSON.stringify(aiResult.description)}::jsonb,
              ai_catchphrase = ${aiResult.description.catchphrase},
              ai_short_description = ${aiResult.description.shortDescription},
              updated_at = NOW()
            WHERE id = ${productId}
          `);
          console.log(`    💾 AI生成データを保存しました`);
          this.stats.aiGenerated = (this.stats.aiGenerated || 0) + 1;
        } catch {
          console.log(`    ⚠️ AI生成データの保存をスキップ（カラム未作成の可能性）`);
        }
      }

      // AIタグを保存
      if (aiResult.tags && (aiResult.tags.genres.length > 0 || aiResult.tags.attributes.length > 0)) {
        console.log(`    ✅ AIタグ抽出完了`);
        console.log(`       ジャンル: ${aiResult.tags.genres.join(', ') || 'なし'}`);

        try {
          await this.db.execute(sql`
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
          await this.db.execute(sql`
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
    } catch (error) {
      console.log(`    ⚠️ AI機能エラー: ${error instanceof Error ? error.message : error}`);
    }
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * テーブル名を取得
   */
  protected getTableName(): RawDataTable {
    const tableMap: Record<string, RawDataTable> = {
      duga: 'duga_raw_responses',
      sokmil: 'sokmil_raw_responses',
      mgs: 'mgs_raw_pages',
      fanza: 'raw_html_data',
      fc2: 'raw_html_data',
    };
    return tableMap[this.options.sourceType] || 'raw_html_data';
  }

  /**
   * 有効なAI設定を取得（オプション + CLI引数をマージ）
   */
  protected getEffectiveEnableAI(): boolean {
    return this.options.enableAI ?? this.cliArgs.enableAI;
  }

  /**
   * 有効な強制再処理設定を取得
   */
  protected getEffectiveForceReprocess(): boolean {
    return this.options.forceReprocess ?? this.cliArgs.forceReprocess;
  }

  /**
   * 有効なレビュースキップ設定を取得
   */
  protected getEffectiveSkipReviews(): boolean {
    return this.options.skipReviews ?? this.cliArgs.skipReviews;
  }

  // ============================================================
  // Output Methods
  // ============================================================

  /**
   * ヘッダーを出力
   */
  protected printHeader(): void {
    console.log('========================================');
    console.log(`=== ${this.options['name']} クローラー ===`);
    console.log('========================================');
    console.log(`取得範囲: offset=${this.cliArgs.offset}, limit=${this.cliArgs.limit}`);
    console.log(`AI機能: ${this.getEffectiveEnableAI() ? '有効' : '無効'}`);
    console.log(`強制再処理: ${this.getEffectiveForceReprocess() ? '有効' : '無効'}`);
    console.log(`レビュー取得: ${this.getEffectiveSkipReviews() ? '無効' : '有効'}`);
    if (this.cliArgs.fullScan) console.log(`フルスキャン: 有効`);
    if (this.cliArgs.year) console.log(`指定年: ${this.cliArgs.year}`);
    if (this.cliArgs.month) console.log(`指定月: ${this.cliArgs.month}`);
    console.log('========================================\n');
  }

  /**
   * サマリーを出力
   */
  protected printSummary(): void {
    console.log('\n=== クロール完了 ===\n');
    console.log('統計情報:');
    console.table(this.stats);

    if (this.stats.durationMs) {
      const seconds = Math.round(this.stats.durationMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      console.log(`\n処理時間: ${minutes}分${remainingSeconds}秒`);
    }
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 年月範囲を生成（フルスキャン用）
 * @param format - 'YYYYMMDD' または 'ISO' (YYYY-MM-DDThh:mm:ss形式)
 */
export function generateDateRanges(
  startYear: number,
  endYear: number,
  format: 'YYYYMMDD' | 'ISO' = 'YYYYMMDD',
): Array<{ start: string; end: string }> {
  const ranges: Array<{ start: string; end: string }> = [];

  for (let year = endYear; year >= startYear; year--) {
    for (let month = 12; month >= 1; month--) {
      const lastDay = new Date(year, month, 0).getDate();

      if (format === 'ISO') {
        const start = `${year}-${month.toString().padStart(2, '0')}-01T00:00:00`;
        const end = `${year}-${month.toString().padStart(2, '0')}-${lastDay}T23:59:59`;
        ranges.push({ start, end });
      } else {
        const start = `${year}${month.toString().padStart(2, '0')}01`;
        const end = `${year}${month.toString().padStart(2, '0')}${lastDay}`;
        ranges.push({ start, end });
      }
    }
  }

  return ranges;
}

/**
 * CLI引数をパース（スタンドアロン関数版）
 * BaseCrawlerを継承しないスクリプトから使用可能
 */
export function parseCliArgs(): ParsedCliArgs {
  const args = process.argv.slice(2);

  const getArg = (name: string): string | undefined => {
    const arg = args.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.split('=')[1] : undefined;
  };

  const hasFlag = (name: string): boolean => args.includes(`--${name}`);

  // カスタム引数を収集
  const customArgs: Record<string, string | boolean> = {};
  args.forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (
        key &&
        !['limit', 'offset', 'no-ai', 'force', 'skip-reviews', 'full-scan', 'year', 'month', 'start-id'].includes(key)
      ) {
        customArgs[key] = value !== undefined ? value : true;
      }
    }
  });

  const yearArg2 = getArg('year');
  const monthArg2 = getArg('month');
  const startIdArg2 = getArg('start-id');
  return {
    limit: parseInt(getArg('limit') || '100', 10),
    offset: parseInt(getArg('offset') || '0', 10),
    enableAI: !hasFlag('no-ai'),
    forceReprocess: hasFlag('force'),
    skipReviews: hasFlag('skip-reviews'),
    fullScan: hasFlag('full-scan'),
    ...(yearArg2 !== undefined && { year: parseInt(yearArg2, 10) }),
    ...(monthArg2 !== undefined && { month: parseInt(monthArg2, 10) }),
    ...(startIdArg2 !== undefined && { startId: startIdArg2 }),
    customArgs,
  };
}

/**
 * 共通のヘッダーを出力
 */
export function printCrawlerHeader(
  name: string,
  options: {
    limit?: number;
    offset?: number;
    enableAI?: boolean;
    forceReprocess?: boolean;
    fullScan?: boolean;
    customInfo?: Record<string, string | number | boolean>;
  },
): void {
  console.log('========================================');
  console.log(`=== ${name} ===`);
  console.log('========================================');
  if (options.limit !== undefined) console.log(`取得件数上限: ${options.limit}`);
  if (options.offset !== undefined && options.offset > 0) console.log(`オフセット: ${options.offset}`);
  if (options.enableAI !== undefined) console.log(`AI機能: ${options.enableAI ? '有効' : '無効'}`);
  if (options.forceReprocess) console.log('強制再処理: 有効');
  if (options.fullScan) console.log('フルスキャン: 有効');
  if (options.customInfo) {
    for (const [key, value] of Object.entries(options.customInfo)) {
      console.log(`${key}: ${value}`);
    }
  }
  console.log('========================================\n');
}

/**
 * 簡易的なクローラー実行ラッパー
 */
export async function runCrawler<T extends BaseCrawler>(
  CrawlerClass: new (options: BaseCrawlerOptions) => T,
  options: BaseCrawlerOptions,
): Promise<void> {
  const crawler = new CrawlerClass(options);
  const result = await crawler.run();

  if (!result.success) {
    console.error('クローラーが失敗しました');
    process.exit(1);
  }

  process.exit(0);
}
