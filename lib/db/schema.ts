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

// 型エクスポート
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductSource = typeof productSources.$inferSelect;
export type NewProductSource = typeof productSources.$inferInsert;
export type ProductCache = typeof productCache.$inferSelect;
export type NewProductCache = typeof productCache.$inferInsert;
export type Performer = typeof performers.$inferSelect;
export type NewPerformer = typeof performers.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
