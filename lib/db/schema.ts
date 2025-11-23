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
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    normalizedIdIdx: index('idx_products_normalized_id').on(table.normalizedProductId),
    titleIdx: index('idx_products_title').on(table.title),
    releaseDateIdx: index('idx_products_release_date').on(table.releaseDate),
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
 * 動的情報キャッシュテーブル
 * APIから取得した価格・在庫などの頻繁に変わる情報をキャッシュ
 */
export const productCache = pgTable(
  'product_cache',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    aspName: varchar('asp_name', { length: 50 }).notNull(),
    price: integer('price'),
    salePrice: integer('sale_price'), // セール価格
    inStock: boolean('in_stock').default(true),
    affiliateUrl: text('affiliate_url'),
    thumbnailUrl: text('thumbnail_url'),
    sampleImages: jsonb('sample_images'), // サンプル画像のURL配列
    pointRate: decimal('point_rate', { precision: 5, scale: 2 }), // ポイント還元率
    cachedAt: timestamp('cached_at').defaultNow(),
  },
  (table) => ({
    productAspCacheUnique: uniqueIndex('idx_cache_product_asp').on(table.productId, table.aspName),
    freshnessIdx: index('idx_cache_freshness').on(table.productId, table.aspName, table.cachedAt),
    productCacheIdx: index('idx_cache_product').on(table.productId),
    aspCacheIdx: index('idx_cache_asp').on(table.aspName),
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
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('idx_performers_name').on(table.name),
    kanaIdx: index('idx_performers_kana').on(table.nameKana),
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
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('idx_tags_name').on(table.name),
    categoryIdx: index('idx_tags_category').on(table.category),
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

// 型エクスポート
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductSource = typeof productSources.$inferSelect;
export type NewProductSource = typeof productSources.$inferInsert;
export type ProductCache = typeof productCache.$inferSelect;
export type NewProductCache = typeof productCache.$inferInsert;
export type Performer = typeof performers.$inferSelect;
export type NewPerformer = typeof performers.$inferInsert;
export type PerformerAlias = typeof performerAliases.$inferSelect;
export type NewPerformerAlias = typeof performerAliases.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type RawCsvData = typeof rawCsvData.$inferSelect;
export type NewRawCsvData = typeof rawCsvData.$inferInsert;
export type RawHtmlData = typeof rawHtmlData.$inferSelect;
export type NewRawHtmlData = typeof rawHtmlData.$inferInsert;
