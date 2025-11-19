import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

/**
 * 商品テーブル
 */
export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    category: text('category').notNull(),
    price: integer('price').notNull().default(0),
    imageUrl: text('image_url'),
    affiliateUrl: text('affiliate_url').notNull(),
    provider: text('provider').notNull(),
    providerLabel: text('provider_label').notNull(),
    actressId: text('actress_id'),
    actressName: text('actress_name'),
    releaseDate: text('release_date'),
    duration: integer('duration'),
    format: text('format'),
    rating: real('rating'),
    reviewCount: integer('review_count'),
    reviewHighlight: text('review_highlight'),
    ctaLabel: text('cta_label'),
    tags: text('tags'), // JSON文字列として保存
    isFeatured: integer('is_featured', { mode: 'boolean' }).default(false),
    isNew: integer('is_new', { mode: 'boolean' }).default(false),
    discount: integer('discount'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (table) => ({
    categoryIdx: index('category_idx').on(table.category),
    providerIdx: index('provider_idx').on(table.provider),
    actressIdIdx: index('actress_id_idx').on(table.actressId),
    isFeaturedIdx: index('is_featured_idx').on(table.isFeatured),
    isNewIdx: index('is_new_idx').on(table.isNew),
    releaseDateIdx: index('release_date_idx').on(table.releaseDate),
  }),
);

/**
 * 女優テーブル
 */
export const actresses = sqliteTable(
  'actresses',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    catchcopy: text('catchcopy'),
    description: text('description'),
    heroImage: text('hero_image'),
    thumbnail: text('thumbnail'),
    primaryGenres: text('primary_genres'), // JSON文字列として保存
    services: text('services'), // JSON文字列として保存
    releaseCount: integer('release_count').default(0),
    trendingScore: integer('trending_score').default(0),
    fanScore: integer('fan_score').default(0),
    highlightWorks: text('highlight_works'), // JSON文字列として保存
    tags: text('tags'), // JSON文字列として保存
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (table) => ({
    nameIdx: index('name_idx').on(table.name),
    trendingScoreIdx: index('trending_score_idx').on(table.trendingScore),
    releaseCountIdx: index('release_count_idx').on(table.releaseCount),
  }),
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Actress = typeof actresses.$inferSelect;
export type NewActress = typeof actresses.$inferInsert;


