/**
 * 商品関連テーブル
 * products, productSources, productPrices, productSales, productImages, productVideos, productTranslations
 */

import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  bigint,
  numeric,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * 作品マスタテーブル
 * 名寄せ後の統合データを格納
 */
export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    normalizedProductId: varchar('normalized_product_id', { length: 100 }).unique().notNull(),
    makerProductCode: varchar('maker_product_code', { length: 50 }), // メーカー品番 (例: SSIS-865, 300MIUM-1000)
    title: varchar('title', { length: 500 }).notNull(),
    releaseDate: date('release_date'),
    description: text('description'),
    duration: integer('duration'), // 再生時間（分）
    defaultThumbnailUrl: text('default_thumbnail_url'), // デフォルトサムネイル画像（互換性のため）
    // 多言語対応カラム
    titleEn: varchar('title_en', { length: 500 }),
    titleZh: varchar('title_zh', { length: 500 }), // 簡体字中国語
    titleZhTw: varchar('title_zh_tw', { length: 500 }), // 繁体字中国語
    titleKo: varchar('title_ko', { length: 500 }),
    descriptionEn: text('description_en'),
    descriptionZh: text('description_zh'), // 簡体字中国語
    descriptionZhTw: text('description_zh_tw'), // 繁体字中国語
    descriptionKo: text('description_ko'),
    // AI生成コンテンツ
    aiDescription: jsonb('ai_description'), // AI生成の説明文詳細（キャッチコピー、短い説明、詳細説明など）
    aiCatchphrase: varchar('ai_catchphrase', { length: 500 }), // AIが生成したキャッチコピー
    aiShortDescription: text('ai_short_description'), // AIが生成した短い説明文
    aiTags: jsonb('ai_tags'), // AI抽出タグ（genres, attributes, plays, situations）
    aiReview: text('ai_review'), // AI生成のレビュー要約（ユーザーレビューベース）
    aiReviewEn: text('ai_review_en'), // AIレビュー（英語）
    aiReviewZh: text('ai_review_zh'), // AIレビュー（中国語簡体字）
    aiReviewKo: text('ai_review_ko'), // AIレビュー（韓国語）
    aiReviewUpdatedAt: timestamp('ai_review_updated_at'), // AIレビュー更新日時
    // 非正規化カラム（パイプラインで更新）
    performerCount: integer('performer_count').default(0), // 出演者数
    hasVideo: boolean('has_video').default(false), // 動画の有無
    hasActiveSale: boolean('has_active_sale').default(false), // セール中かどうか
    minPrice: integer('min_price'), // 最低価格（全ASP横断）
    bestRating: numeric('best_rating', { precision: 3, scale: 2 }), // 最高評価
    totalReviews: integer('total_reviews').default(0), // レビュー総数
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    normalizedIdIdx: index('idx_products_normalized_id').on(table.normalizedProductId),
    makerProductCodeIdx: index('idx_products_maker_code').on(table.makerProductCode),
    titleIdx: index('idx_products_title').on(table.title),
    releaseDateIdx: index('idx_products_release_date').on(table.releaseDate),
    titleEnIdx: index('idx_products_title_en').on(table.titleEn),
    titleZhIdx: index('idx_products_title_zh').on(table.titleZh),
    titleZhTwIdx: index('idx_products_title_zh_tw').on(table.titleZhTw),
    titleKoIdx: index('idx_products_title_ko').on(table.titleKo),
  }),
);

/**
 * ASP別商品情報テーブル
 * 各ASPごとの商品情報を保持
 */
export const productSources = pgTable(
  'product_sources',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    aspName: varchar('asp_name', { length: 50 }).notNull(), // 'DMM', 'MGS', 'DUGA' など
    originalProductId: varchar('original_product_id', { length: 100 }).notNull(),
    affiliateUrl: text('affiliate_url').notNull(),
    price: integer('price'), // 代表価格（後方互換性のため残す）
    currency: varchar('currency', { length: 3 }).default('JPY'), // 'JPY' or 'USD'
    isSubscription: boolean('is_subscription').default(false), // 月額制かどうか
    productType: varchar('product_type', { length: 20 }), // 'haishin'(配信), 'dvd', 'monthly'(月額) など
    dataSource: varchar('data_source', { length: 10 }).notNull(), // 'API' or 'CSV'
    lastUpdated: timestamp('last_updated').defaultNow(),
  },
  (table) => ({
    productAspUnique: uniqueIndex('idx_sources_product_asp').on(table.productId, table.aspName),
    productIdx: index('idx_sources_product').on(table.productId),
    aspIdx: index('idx_sources_asp').on(table.aspName),
    originalProductIdIdx: index('idx_sources_original_product_id').on(table.originalProductId),
    aspOriginalIdIdx: index('idx_sources_asp_original_id').on(table.aspName, table.originalProductId),
  }),
);

/**
 * 商品価格テーブル（価格タイプ別）
 * 各商品ソースの価格タイプ別価格を保持
 * 価格タイプ: download, streaming, hd, 4k, sd, rental など
 */
export const productPrices = pgTable(
  'product_prices',
  {
    id: serial('id').primaryKey(),
    productSourceId: integer('product_source_id')
      .notNull()
      .references(() => productSources.id, { onDelete: 'cascade' }),
    priceType: varchar('price_type', { length: 30 }).notNull(), // 'download', 'streaming', 'hd', '4k', 'sd', 'rental', 'subscription'
    price: integer('price').notNull(), // 価格（円）
    currency: varchar('currency', { length: 3 }).default('JPY'),
    isDefault: boolean('is_default').default(false), // この価格タイプがデフォルト（代表価格）かどうか
    displayOrder: integer('display_order').default(0), // 表示順（小さいほど優先）
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    sourceTypeUnique: uniqueIndex('idx_prices_source_type').on(table.productSourceId, table.priceType),
    sourceIdx: index('idx_prices_source').on(table.productSourceId),
    priceTypeIdx: index('idx_prices_type').on(table.priceType),
  }),
);

/**
 * セール情報テーブル
 * 各ASPのセール・割引情報を保持
 */
export const productSales = pgTable(
  'product_sales',
  {
    id: serial('id').primaryKey(),
    productSourceId: integer('product_source_id')
      .notNull()
      .references(() => productSources.id, { onDelete: 'cascade' }),
    regularPrice: integer('regular_price').notNull(), // 通常価格
    salePrice: integer('sale_price').notNull(), // セール価格
    discountPercent: integer('discount_percent'), // 割引率
    saleType: varchar('sale_type', { length: 50 }), // 'timesale', 'campaign', 'clearance' など
    saleName: varchar('sale_name', { length: 200 }), // セール名（例：「週末限定50%OFF」）
    startAt: timestamp('start_at'), // セール開始日時
    endAt: timestamp('end_at'), // セール終了日時
    isActive: boolean('is_active').default(true).notNull(),
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    productSourceIdx: index('idx_sales_product_source').on(table.productSourceId),
    activeIdx: index('idx_sales_active').on(table.isActive),
    endAtIdx: index('idx_sales_end_at').on(table.endAt),
    discountIdx: index('idx_sales_discount').on(table.discountPercent),
  }),
);

/**
 * 作品画像テーブル
 * 1作品に複数の画像を管理
 */
export const productImages = pgTable(
  'product_images',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    imageUrl: text('image_url').notNull(),
    imageType: varchar('image_type', { length: 50 }).notNull(), // 'thumbnail', 'cover', 'sample', 'screenshot' など
    displayOrder: integer('display_order').default(0), // 表示順序
    width: integer('width'),
    height: integer('height'),
    aspName: varchar('asp_name', { length: 50 }), // 画像の取得元ASP
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    productIdx: index('idx_product_images_product').on(table.productId),
    typeIdx: index('idx_product_images_type').on(table.imageType),
    orderIdx: index('idx_product_images_order').on(table.productId, table.displayOrder),
    aspIdx: index('idx_product_images_asp').on(table.aspName),
  }),
);

/**
 * 作品動画テーブル
 * 1作品に複数の動画URLを管理
 */
export const productVideos = pgTable(
  'product_videos',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    videoUrl: text('video_url').notNull(),
    videoType: varchar('video_type', { length: 50 }).notNull(), // 'streaming', 'download', 'preview', 'trailer', 'sample' など
    quality: varchar('quality', { length: 50 }), // '1080p', '720p', '480p', '4K' など
    duration: integer('duration'), // 再生時間（秒）
    fileSize: bigint('file_size', { mode: 'number' }), // ファイルサイズ（バイト）
    format: varchar('format', { length: 50 }), // 'mp4', 'wmv', 'm3u8' など
    aspName: varchar('asp_name', { length: 50 }), // 動画の取得元ASP
    displayOrder: integer('display_order').default(0), // 表示順序（複数動画の並び順）
    requiresAuth: boolean('requires_auth').default(false), // 認証が必要かどうか
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    productIdx: index('idx_product_videos_product').on(table.productId),
    typeIdx: index('idx_product_videos_type').on(table.videoType),
    qualityIdx: index('idx_product_videos_quality').on(table.quality),
    aspIdx: index('idx_product_videos_asp').on(table.aspName),
    orderIdx: index('idx_product_videos_order').on(table.displayOrder),
  }),
);

/**
 * 商品翻訳テーブル
 * 各商品のタイトル・説明の多言語翻訳を保存
 */
export const productTranslations = pgTable(
  'product_translations',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    language: varchar('language', { length: 10 }).notNull(), // 'en', 'zh', 'zh-TW', 'ko'
    title: text('title'),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    productLanguageUnique: uniqueIndex('idx_product_translations_unique').on(table.productId, table.language),
    productIdx: index('idx_product_translations_product_id').on(table.productId),
    languageIdx: index('idx_product_translations_language').on(table.language),
  }),
);

// 型エクスポート
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductSource = typeof productSources.$inferSelect;
export type NewProductSource = typeof productSources.$inferInsert;
export type ProductPrice = typeof productPrices.$inferSelect;
export type NewProductPrice = typeof productPrices.$inferInsert;
export type ProductImage = typeof productImages.$inferSelect;
export type NewProductImage = typeof productImages.$inferInsert;
export type ProductVideo = typeof productVideos.$inferSelect;
export type NewProductVideo = typeof productVideos.$inferInsert;
export type ProductTranslation = typeof productTranslations.$inferSelect;
export type NewProductTranslation = typeof productTranslations.$inferInsert;
