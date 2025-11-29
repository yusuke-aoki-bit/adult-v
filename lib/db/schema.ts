import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  date,
  decimal,
  jsonb,
  bigint,
  index,
  uniqueIndex,
  primaryKey,
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
    title: varchar('title', { length: 500 }).notNull(),
    releaseDate: date('release_date'),
    description: text('description'),
    duration: integer('duration'), // 再生時間（分）
    defaultThumbnailUrl: text('default_thumbnail_url'), // デフォルトサムネイル画像（互換性のため）
    // 多言語対応カラム
    titleEn: varchar('title_en', { length: 500 }),
    titleZh: varchar('title_zh', { length: 500 }),
    titleKo: varchar('title_ko', { length: 500 }),
    descriptionEn: text('description_en'),
    descriptionZh: text('description_zh'),
    descriptionKo: text('description_ko'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    normalizedIdIdx: index('idx_products_normalized_id').on(table.normalizedProductId),
    titleIdx: index('idx_products_title').on(table.title),
    releaseDateIdx: index('idx_products_release_date').on(table.releaseDate),
    titleEnIdx: index('idx_products_title_en').on(table.titleEn),
    titleZhIdx: index('idx_products_title_zh').on(table.titleZh),
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
    productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    aspName: varchar('asp_name', { length: 50 }).notNull(), // 'DMM', 'MGS', 'DUGA' など
    originalProductId: varchar('original_product_id', { length: 100 }).notNull(),
    affiliateUrl: text('affiliate_url').notNull(),
    price: integer('price'),
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
 * 出演者テーブル
 */
export const performers = pgTable(
  'performers',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 200 }).unique().notNull(),
    nameKana: varchar('name_kana', { length: 200 }), // 読み仮名
    profileImageUrl: text('profile_image_url'), // デフォルトプロフィール画像（互換性のため）
    // 多言語対応カラム
    nameEn: varchar('name_en', { length: 200 }),
    nameZh: varchar('name_zh', { length: 200 }),
    nameKo: varchar('name_ko', { length: 200 }),
    bioJa: text('bio_ja'),
    bioEn: text('bio_en'),
    bioZh: text('bio_zh'),
    bioKo: text('bio_ko'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('idx_performers_name').on(table.name),
    kanaIdx: index('idx_performers_kana').on(table.nameKana),
    nameEnIdx: index('idx_performers_name_en').on(table.nameEn),
    nameZhIdx: index('idx_performers_name_zh').on(table.nameZh),
    nameKoIdx: index('idx_performers_name_ko').on(table.nameKo),
  }),
);

/**
 * 出演者別名テーブル
 * 1人の女優に複数の別名を持てるようにする
 */
export const performerAliases = pgTable(
  'performer_aliases',
  {
    id: serial('id').primaryKey(),
    performerId: integer('performer_id').notNull().references(() => performers.id, { onDelete: 'cascade' }),
    aliasName: varchar('alias_name', { length: 200 }).notNull(),
    source: varchar('source', { length: 100 }), // 'av-wiki', 'seesaa-wiki', 'manual' など
    isPrimary: boolean('is_primary').default(false), // 主要な名前かどうか
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    performerIdIdx: index('idx_aliases_performer').on(table.performerId),
    aliasNameIdx: index('idx_aliases_name').on(table.aliasName),
    performerAliasUnique: uniqueIndex('idx_aliases_performer_alias').on(table.performerId, table.aliasName),
  }),
);

/**
 * 作品-出演者 中間テーブル
 */
export const productPerformers = pgTable(
  'product_performers',
  {
    productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    performerId: integer('performer_id').notNull().references(() => performers.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.productId, table.performerId] }),
    productIdx: index('idx_pp_product').on(table.productId),
    performerIdx: index('idx_pp_performer').on(table.performerId),
  }),
);

/**
 * タグ/ジャンルテーブル
 */
export const tags = pgTable(
  'tags',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).unique().notNull(),
    category: varchar('category', { length: 50 }), // 'genre', 'series', 'maker' など
    // 多言語対応カラム
    nameEn: varchar('name_en', { length: 100 }),
    nameZh: varchar('name_zh', { length: 100 }),
    nameKo: varchar('name_ko', { length: 100 }),
    descriptionJa: text('description_ja'),
    descriptionEn: text('description_en'),
    descriptionZh: text('description_zh'),
    descriptionKo: text('description_ko'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('idx_tags_name').on(table.name),
    categoryIdx: index('idx_tags_category').on(table.category),
    nameEnIdx: index('idx_tags_name_en').on(table.nameEn),
    nameZhIdx: index('idx_tags_name_zh').on(table.nameZh),
    nameKoIdx: index('idx_tags_name_ko').on(table.nameKo),
  }),
);

/**
 * 作品-タグ 中間テーブル
 */
export const productTags = pgTable(
  'product_tags',
  {
    productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.productId, table.tagId] }),
    productIdx: index('idx_pt_product').on(table.productId),
    tagIdx: index('idx_pt_tag').on(table.tagId),
  }),
);

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
    rawData: jsonb('raw_data').notNull(), // CSV行の全データをJSONBで保存
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
    htmlContent: text('html_content').notNull(), // HTML全体を保存
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
 * 女優画像テーブル
 * 1女優に複数の画像を管理
 */
export const performerImages = pgTable(
  'performer_images',
  {
    id: serial('id').primaryKey(),
    performerId: integer('performer_id').notNull().references(() => performers.id, { onDelete: 'cascade' }),
    imageUrl: text('image_url').notNull(),
    imageType: varchar('image_type', { length: 50 }), // 'profile', 'thumbnail', 'banner', 'gallery' など
    width: integer('width'), // 画像の幅
    height: integer('height'), // 画像の高さ
    source: varchar('source', { length: 100 }), // 'av-wiki', 'seesaa-wiki', 'manual' など
    isPrimary: boolean('is_primary').default(false), // メイン画像かどうか
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    performerIdx: index('idx_performer_images_performer').on(table.performerId),
    typeIdx: index('idx_performer_images_type').on(table.imageType),
    primaryIdx: index('idx_performer_images_primary').on(table.performerId, table.isPrimary),
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
    productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
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
    productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
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
// 型エクスポート
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductSource = typeof productSources.$inferSelect;
export type NewProductSource = typeof productSources.$inferInsert;
export type Performer = typeof performers.$inferSelect;
export type NewPerformer = typeof performers.$inferInsert;
export type PerformerAlias = typeof performerAliases.$inferSelect;
export type NewPerformerAlias = typeof performerAliases.$inferInsert;
export type PerformerImage = typeof performerImages.$inferSelect;
export type NewPerformerImage = typeof performerImages.$inferInsert;
export type ProductImage = typeof productImages.$inferSelect;
export type NewProductImage = typeof productImages.$inferInsert;
export type ProductVideo = typeof productVideos.$inferSelect;
export type NewProductVideo = typeof productVideos.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type RawCsvData = typeof rawCsvData.$inferSelect;
export type NewRawCsvData = typeof rawCsvData.$inferInsert;
export type RawHtmlData = typeof rawHtmlData.$inferSelect;
export type NewRawHtmlData = typeof rawHtmlData.$inferInsert;
