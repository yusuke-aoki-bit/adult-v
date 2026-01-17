/**
 * レビュー関連テーブル
 * productReviews, productRatingSummary
 */

import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  decimal,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { products } from './products';

/**
 * 商品レビューテーブル
 * 各ASPから収集したレビュー情報を保存
 */
export const productReviews = pgTable(
  'product_reviews',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    aspName: varchar('asp_name', { length: 50 }).notNull(), // レビュー取得元ASP
    reviewerName: varchar('reviewer_name', { length: 100 }), // レビュワー名（匿名の場合null）
    rating: decimal('rating', { precision: 3, scale: 1 }), // 評価（5段階など、ASPにより異なる）
    maxRating: decimal('max_rating', { precision: 3, scale: 1 }).default('5'), // 最大評価値
    title: text('title'), // レビュータイトル
    titleEn: text('title_en'), // 英語翻訳
    titleZh: text('title_zh'), // 中国語翻訳
    titleKo: text('title_ko'), // 韓国語翻訳
    content: text('content'), // レビュー本文
    contentEn: text('content_en'), // 英語翻訳
    contentZh: text('content_zh'), // 中国語翻訳
    contentKo: text('content_ko'), // 韓国語翻訳
    reviewDate: timestamp('review_date'), // レビュー投稿日
    helpful: integer('helpful').default(0), // 参考になった数
    sourceReviewId: varchar('source_review_id', { length: 100 }), // ASP側のレビューID
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    productIdx: index('idx_product_reviews_product').on(table.productId),
    aspIdx: index('idx_product_reviews_asp').on(table.aspName),
    ratingIdx: index('idx_product_reviews_rating').on(table.rating),
    dateIdx: index('idx_product_reviews_date').on(table.reviewDate),
    sourceReviewUnique: uniqueIndex('idx_product_reviews_source').on(
      table.productId,
      table.aspName,
      table.sourceReviewId,
    ),
  }),
);

/**
 * 商品評価サマリーテーブル
 * 各ASPからの評価の集計データ
 */
export const productRatingSummary = pgTable(
  'product_rating_summary',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    aspName: varchar('asp_name', { length: 50 }).notNull(), // ASP名
    averageRating: decimal('average_rating', { precision: 3, scale: 2 }), // 平均評価
    maxRating: decimal('max_rating', { precision: 3, scale: 1 }).default('5'), // 最大評価値
    totalReviews: integer('total_reviews').default(0), // レビュー総数
    ratingDistribution: jsonb('rating_distribution'), // 評価分布 {1: 10, 2: 20, 3: 50, 4: 30, 5: 40}
    lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  },
  (table) => ({
    productAspUnique: uniqueIndex('idx_rating_summary_product_asp').on(
      table.productId,
      table.aspName,
    ),
    productIdx: index('idx_rating_summary_product').on(table.productId),
    avgRatingIdx: index('idx_rating_summary_avg').on(table.averageRating),
  }),
);

// 型エクスポート
export type ProductReview = typeof productReviews.$inferSelect;
export type NewProductReview = typeof productReviews.$inferInsert;
export type ProductRatingSummary = typeof productRatingSummary.$inferSelect;
export type NewProductRatingSummary = typeof productRatingSummary.$inferInsert;
