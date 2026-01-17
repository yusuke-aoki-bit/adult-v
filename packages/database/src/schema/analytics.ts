/**
 * 分析・履歴関連テーブル
 * priceHistory, salePatterns, videoTimestamps
 */

import {
  pgTable,
  serial,
  varchar,
  integer,
  decimal,
  timestamp,
  date,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { productSources, productVideos } from './products';
import { performers } from './performers';
import { tags } from './tags';

/**
 * 価格履歴テーブル
 * セールアラート＆価格追跡機能用
 */
export const priceHistory = pgTable(
  'price_history',
  {
    id: serial('id').primaryKey(),
    productSourceId: integer('product_source_id').notNull().references(() => productSources.id, { onDelete: 'cascade' }),
    price: integer('price').notNull(),
    salePrice: integer('sale_price'),
    discountPercent: integer('discount_percent'),
    recordedAt: timestamp('recorded_at').defaultNow().notNull(),
  },
  (table) => ({
    productSourceIdx: index('idx_price_history_product_source').on(table.productSourceId),
    recordedAtIdx: index('idx_price_history_recorded_at').on(table.recordedAt),
    productSourceRecordedIdx: index('idx_price_history_product_source_recorded').on(table.productSourceId, table.recordedAt),
  }),
);

/**
 * セールパターンテーブル
 * 購入タイミング最適化機能用
 */
export const salePatterns = pgTable(
  'sale_patterns',
  {
    id: serial('id').primaryKey(),
    productSourceId: integer('product_source_id').references(() => productSources.id, { onDelete: 'cascade' }),
    performerId: integer('performer_id').references(() => performers.id, { onDelete: 'cascade' }),
    makerId: integer('maker_id').references(() => tags.id, { onDelete: 'cascade' }),
    patternType: varchar('pattern_type', { length: 50 }).notNull(), // 'product', 'performer', 'maker', 'global'
    monthDistribution: jsonb('month_distribution'), // {1: 0.05, ..., 12: 0.15}
    dayOfWeekDistribution: jsonb('day_of_week_distribution'), // {0: 0.1, ..., 6: 0.12}
    avgDiscountPercent: decimal('avg_discount_percent', { precision: 5, scale: 2 }),
    avgSaleDurationDays: decimal('avg_sale_duration_days', { precision: 5, scale: 2 }),
    saleFrequencyPerYear: decimal('sale_frequency_per_year', { precision: 5, scale: 2 }),
    totalSalesCount: integer('total_sales_count').default(0),
    lastSaleDate: date('last_sale_date'),
    lastCalculatedAt: timestamp('last_calculated_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    patternTypeIdx: index('idx_sale_patterns_type').on(table.patternType),
    performerIdx: index('idx_sale_patterns_performer').on(table.performerId),
    makerIdx: index('idx_sale_patterns_maker').on(table.makerId),
    productSourceIdx: index('idx_sale_patterns_product_source').on(table.productSourceId),
  }),
);

/**
 * 動画タイムスタンプテーブル
 * 試聴→購入コンバージョン強化機能用
 */
export const videoTimestamps = pgTable(
  'video_timestamps',
  {
    id: serial('id').primaryKey(),
    productVideoId: integer('product_video_id').notNull().references(() => productVideos.id, { onDelete: 'cascade' }),
    timestampSeconds: integer('timestamp_seconds').notNull(),
    label: varchar('label', { length: 100 }),
    voteCount: integer('vote_count').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    productVideoIdx: index('idx_video_timestamps_video').on(table.productVideoId),
    votesIdx: index('idx_video_timestamps_votes').on(table.voteCount),
  }),
);

// 型エクスポート
export type PriceHistory = typeof priceHistory.$inferSelect;
export type NewPriceHistory = typeof priceHistory.$inferInsert;
export type SalePattern = typeof salePatterns.$inferSelect;
export type NewSalePattern = typeof salePatterns.$inferInsert;
export type VideoTimestamp = typeof videoTimestamps.$inferSelect;
export type NewVideoTimestamp = typeof videoTimestamps.$inferInsert;
