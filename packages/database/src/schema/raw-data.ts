/**
 * 生データ関連テーブル
 * rawCsvData, rawHtmlData, dugaRawResponses, sokmilRawResponses, mgsRawPages, productRawDataLinks, wikiCrawlData, wikiPerformerIndex
 */

import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { products } from './products';

/**
 * 生データ保存テーブル（CSV）
 * DUGA CSVの生データを保存し、再解析と重複を避ける
 */
export const rawCsvData = pgTable(
  'raw_csv_data',
  {
    id: serial('id').primaryKey(),
    source: varchar('source', { length: 50 }).notNull(), // 'DUGA' など
    productId: varchar('product_id', { length: 100 }).notNull(), // 商品ID（CSVの商品ID列）
    rawData: jsonb('raw_data'), // CSV行の全データをJSONBで保存（GCS移行後はnull可）
    gcsUrl: text('gcs_url'), // GCSに保存した場合のURL (gs://bucket/path)
    downloadedAt: timestamp('downloaded_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'), // 処理完了日時
    hash: varchar('hash', { length: 64 }).notNull(), // データのハッシュ値（重複検出用）
  },
  (table) => ({
    sourceProductUnique: uniqueIndex('idx_raw_csv_source_product').on(table.source, table.productId),
    hashIdx: index('idx_raw_csv_hash').on(table.hash),
    sourceIdx: index('idx_raw_csv_source').on(table.source),
    downloadedIdx: index('idx_raw_csv_downloaded').on(table.downloadedAt),
  }),
);

/**
 * 生データ保存テーブル（HTML）
 * クロールしたHTMLの生データを保存し、再解析と重複を避ける
 */
export const rawHtmlData = pgTable(
  'raw_html_data',
  {
    id: serial('id').primaryKey(),
    source: varchar('source', { length: 50 }).notNull(), // 'カリビアンコムプレミアム', '一本道', 'HEYZO' など
    productId: varchar('product_id', { length: 100 }).notNull(), // 商品ID（URL内のID部分）
    url: text('url').notNull(),
    htmlContent: text('html_content'), // HTML全体を保存（GCS移行後はnull可）
    gcsUrl: text('gcs_url'), // GCSに保存した場合のURL (gs://bucket/path)
    crawledAt: timestamp('crawled_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'), // 処理完了日時
    hash: varchar('hash', { length: 64 }).notNull(), // コンテンツのハッシュ値（重複・更新検出用）
  },
  (table) => ({
    sourceProductUnique: uniqueIndex('idx_raw_html_source_product').on(table.source, table.productId),
    hashIdx: index('idx_raw_html_hash').on(table.hash),
    sourceIdx: index('idx_raw_html_source').on(table.source),
    crawledIdx: index('idx_raw_html_crawled').on(table.crawledAt),
    urlIdx: index('idx_raw_html_url').on(table.url),
  }),
);

/**
 * DUGA API生レスポンス保存テーブル
 * リカバリー用にAPIレスポンス全体を保存
 */
export const dugaRawResponses = pgTable(
  'duga_raw_responses',
  {
    id: serial('id').primaryKey(),
    productId: text('product_id').notNull(),
    apiVersion: text('api_version').notNull().default('1.2'),
    rawJson: jsonb('raw_json').notNull(),
    hash: varchar('hash', { length: 64 }), // 重複・更新検出用
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'), // 処理完了日時
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    productIdIdx: index('idx_duga_raw_product_id').on(table.productId),
    hashIdx: index('idx_duga_raw_hash').on(table.hash),
    fetchedIdx: index('idx_duga_raw_fetched_at').on(table.fetchedAt),
    productIdUnique: uniqueIndex('idx_duga_raw_product_unique').on(table.productId),
  }),
);

/**
 * ソクミルAPI生レスポンス保存テーブル
 */
export const sokmilRawResponses = pgTable(
  'sokmil_raw_responses',
  {
    id: serial('id').primaryKey(),
    itemId: text('item_id').notNull(),
    apiType: text('api_type').notNull(), // 'item', 'maker', 'label', 'series', 'genre', 'director', 'actor'
    rawJson: jsonb('raw_json').notNull(),
    hash: varchar('hash', { length: 64 }),
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    itemIdIdx: index('idx_sokmil_raw_item_id').on(table.itemId),
    apiTypeIdx: index('idx_sokmil_raw_api_type').on(table.apiType),
    hashIdx: index('idx_sokmil_raw_hash').on(table.hash),
    fetchedIdx: index('idx_sokmil_raw_fetched_at').on(table.fetchedAt),
    itemTypeUnique: uniqueIndex('idx_sokmil_raw_item_type_unique').on(table.itemId, table.apiType),
  }),
);

/**
 * MGSスクレイピング生データ保存テーブル
 */
export const mgsRawPages = pgTable(
  'mgs_raw_pages',
  {
    id: serial('id').primaryKey(),
    productUrl: text('product_url').notNull().unique(),
    productId: text('product_id'),
    rawHtml: text('raw_html').notNull(),
    rawJson: jsonb('raw_json'),
    hash: varchar('hash', { length: 64 }),
    statusCode: integer('status_code').notNull().default(200),
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    productUrlIdx: index('idx_mgs_raw_product_url').on(table.productUrl),
    productIdIdx: index('idx_mgs_raw_product_id').on(table.productId),
    hashIdx: index('idx_mgs_raw_hash').on(table.hash),
    fetchedIdx: index('idx_mgs_raw_fetched_at').on(table.fetchedAt),
  }),
);

/**
 * 商品と生データのリレーション管理テーブル
 * どの商品がどの生データから作成されたかを追跡
 */
export const productRawDataLinks = pgTable(
  'product_raw_data_links',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sourceType: text('source_type').notNull(), // 'duga', 'sokmil', 'mgs', 'fc2', 'dti', 'b10f'
    rawDataId: integer('raw_data_id').notNull(), // 対応する生データテーブルのID
    rawDataTable: text('raw_data_table').notNull(), // 'duga_raw_responses', 'raw_html_data' など
    contentHash: varchar('content_hash', { length: 64 }), // 処理時点のハッシュ（再処理判定用）
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    productIdx: index('idx_product_raw_links_product').on(table.productId),
    sourceIdx: index('idx_product_raw_links_source').on(table.sourceType, table.rawDataId),
    productSourceUnique: uniqueIndex('idx_product_raw_links_unique').on(
      table.productId,
      table.sourceType,
      table.rawDataId,
    ),
  }),
);

/**
 * Wikiクロールデータテーブル
 * 各Wikiサイトから収集した商品ID-出演者データを保存
 */
export const wikiCrawlData = pgTable(
  'wiki_crawl_data',
  {
    id: serial('id').primaryKey(),
    source: varchar('source', { length: 50 }).notNull(), // 'av-wiki', 'seesaa-wiki', 'shiroutoname', 'nakiny', 'fc2-blog' など
    productCode: varchar('product_code', { length: 100 }).notNull(), // 品番（300MIUM-1000など）
    performerName: varchar('performer_name', { length: 200 }).notNull(), // クロールで取得した出演者名
    sourceUrl: text('source_url'), // 情報取得元のURL
    rawData: jsonb('raw_data'), // 追加情報（タイトル、タグ等）をJSONで保存
    gcsUrl: text('gcs_url'), // GCSに保存した場合のURL (gs://bucket/path)
    crawledAt: timestamp('crawled_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'), // performers/product_performersへの反映完了日時
  },
  (table) => ({
    sourceProductPerformerUnique: uniqueIndex('idx_wiki_crawl_source_product_performer').on(
      table.source,
      table.productCode,
      table.performerName,
    ),
    sourceIdx: index('idx_wiki_crawl_source').on(table.source),
    productCodeIdx: index('idx_wiki_crawl_product_code').on(table.productCode),
    performerNameIdx: index('idx_wiki_crawl_performer_name').on(table.performerName),
    processedIdx: index('idx_wiki_crawl_processed').on(table.processedAt),
  }),
);

/**
 * Wiki/参考サイトから取得した出演者インデックス
 * 商品ID、作品タイトルから出演者名を検索するためのテーブル
 */
export const wikiPerformerIndex = pgTable(
  'wiki_performer_index',
  {
    id: serial('id').primaryKey(),
    // 検索キー
    productCode: varchar('product_code', { length: 100 }), // 商品コード
    productTitle: varchar('product_title', { length: 500 }), // 作品タイトル
    maker: varchar('maker', { length: 100 }), // メーカー/レーベル

    // 出演者情報
    performerName: varchar('performer_name', { length: 200 }).notNull(), // 出演者名
    performerNameRomaji: varchar('performer_name_romaji', { length: 200 }), // ローマ字名
    performerNameVariants: jsonb('performer_name_variants'), // 名前の変換候補

    // メタデータ
    source: varchar('source', { length: 50 }).notNull(), // データ取得元
    sourceUrl: text('source_url'), // 取得元URL
    confidence: integer('confidence').default(100), // 信頼度
    verified: boolean('verified').default(false), // 手動検証済みフラグ

    // タイムスタンプ
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    productCodeIdx: index('idx_wiki_performer_product_code').on(table.productCode),
    productTitleIdx: index('idx_wiki_performer_product_title').on(table.productTitle),
    makerIdx: index('idx_wiki_performer_maker').on(table.maker),
    performerNameIdx: index('idx_wiki_performer_name').on(table.performerName),
    sourceIdx: index('idx_wiki_performer_source').on(table.source),
    makerTitleIdx: index('idx_wiki_performer_maker_title').on(table.maker, table.productTitle),
  }),
);

// 型エクスポート
export type RawCsvData = typeof rawCsvData.$inferSelect;
export type NewRawCsvData = typeof rawCsvData.$inferInsert;
export type RawHtmlData = typeof rawHtmlData.$inferSelect;
export type NewRawHtmlData = typeof rawHtmlData.$inferInsert;
export type DugaRawResponse = typeof dugaRawResponses.$inferSelect;
export type NewDugaRawResponse = typeof dugaRawResponses.$inferInsert;
export type SokmilRawResponse = typeof sokmilRawResponses.$inferSelect;
export type NewSokmilRawResponse = typeof sokmilRawResponses.$inferInsert;
export type MgsRawPage = typeof mgsRawPages.$inferSelect;
export type NewMgsRawPage = typeof mgsRawPages.$inferInsert;
export type ProductRawDataLink = typeof productRawDataLinks.$inferSelect;
export type NewProductRawDataLink = typeof productRawDataLinks.$inferInsert;
export type WikiCrawlData = typeof wikiCrawlData.$inferSelect;
export type NewWikiCrawlData = typeof wikiCrawlData.$inferInsert;
export type WikiPerformerIndex = typeof wikiPerformerIndex.$inferSelect;
export type NewWikiPerformerIndex = typeof wikiPerformerIndex.$inferInsert;
