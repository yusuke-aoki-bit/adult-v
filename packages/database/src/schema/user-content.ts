/**
 * ユーザー生成コンテンツ関連テーブル
 * userReviews, userTagSuggestions, userCorrections, publicFavoriteLists, publicFavoriteListItems,
 * userReviewVotes, userTagVotes, publicListLikes, userPerformerSuggestions, userPerformerVotes, productRankingVotes
 */

import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  decimal,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { products } from './products';
import { performers } from './performers';
import { tags } from './tags';

/**
 * ユーザーレビューテーブル
 * ユーザーが投稿したレビュー・評価を保存
 */
export const userReviews = pgTable(
  'user_reviews',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 }).notNull(), // Firebase UID
    rating: decimal('rating', { precision: 3, scale: 1 }).notNull(), // 1.0-5.0
    title: varchar('title', { length: 200 }),
    content: text('content').notNull(),
    helpfulCount: integer('helpful_count').default(0),
    // モデレーション関連
    status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending', 'approved', 'rejected', 'flagged'
    moderationReason: text('moderation_reason'), // AIまたは管理者による却下理由
    moderatedAt: timestamp('moderated_at'),
    moderatedBy: varchar('moderated_by', { length: 100 }), // 'ai' or admin user id
    // タイムスタンプ
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    productIdx: index('idx_user_reviews_product').on(table.productId),
    userIdx: index('idx_user_reviews_user').on(table.userId),
    statusIdx: index('idx_user_reviews_status').on(table.status),
    ratingIdx: index('idx_user_reviews_rating').on(table.rating),
    createdAtIdx: index('idx_user_reviews_created').on(table.createdAt),
    productUserUnique: uniqueIndex('idx_user_reviews_product_user').on(table.productId, table.userId),
  }),
);

/**
 * ユーザータグ提案テーブル
 * ユーザーが提案したタグを保存
 */
export const userTagSuggestions = pgTable(
  'user_tag_suggestions',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 }).notNull(), // Firebase UID
    suggestedTagName: varchar('suggested_tag_name', { length: 100 }).notNull(),
    existingTagId: integer('existing_tag_id').references(() => tags.id, { onDelete: 'set null' }), // 既存タグへの紐付け（あれば）
    upvotes: integer('upvotes').default(0),
    downvotes: integer('downvotes').default(0),
    // モデレーション関連
    status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending', 'approved', 'rejected'
    moderationReason: text('moderation_reason'),
    moderatedAt: timestamp('moderated_at'),
    moderatedBy: varchar('moderated_by', { length: 100 }),
    // タイムスタンプ
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    productIdx: index('idx_user_tag_suggestions_product').on(table.productId),
    userIdx: index('idx_user_tag_suggestions_user').on(table.userId),
    statusIdx: index('idx_user_tag_suggestions_status').on(table.status),
    tagNameIdx: index('idx_user_tag_suggestions_tag').on(table.suggestedTagName),
    productTagUnique: uniqueIndex('idx_user_tag_suggestions_product_tag').on(table.productId, table.suggestedTagName),
  }),
);

/**
 * ユーザー情報修正提案テーブル
 * ユーザーが提案した情報修正を保存
 */
export const userCorrections = pgTable(
  'user_corrections',
  {
    id: serial('id').primaryKey(),
    targetType: varchar('target_type', { length: 50 }).notNull(), // 'product', 'performer'
    targetId: integer('target_id').notNull(), // products.id or performers.id
    userId: varchar('user_id', { length: 255 }).notNull(), // Firebase UID
    fieldName: varchar('field_name', { length: 100 }).notNull(), // 修正対象のフィールド名
    currentValue: text('current_value'), // 現在の値（参考用）
    suggestedValue: text('suggested_value').notNull(), // 提案された新しい値
    reason: text('reason'), // 修正理由
    // モデレーション関連
    status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending', 'approved', 'rejected'
    moderationReason: text('moderation_reason'),
    moderatedAt: timestamp('moderated_at'),
    moderatedBy: varchar('moderated_by', { length: 100 }),
    // タイムスタンプ
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    targetIdx: index('idx_user_corrections_target').on(table.targetType, table.targetId),
    userIdx: index('idx_user_corrections_user').on(table.userId),
    statusIdx: index('idx_user_corrections_status').on(table.status),
    fieldIdx: index('idx_user_corrections_field').on(table.fieldName),
  }),
);

/**
 * 公開お気に入りリストテーブル
 * ユーザーが作成した公開リストを保存
 */
export const publicFavoriteLists = pgTable(
  'public_favorite_lists',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull(), // Firebase UID
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    isPublic: boolean('is_public').default(true).notNull(),
    viewCount: integer('view_count').default(0),
    likeCount: integer('like_count').default(0),
    // タイムスタンプ
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_public_favorite_lists_user').on(table.userId),
    isPublicIdx: index('idx_public_favorite_lists_public').on(table.isPublic),
    viewCountIdx: index('idx_public_favorite_lists_views').on(table.viewCount),
    likeCountIdx: index('idx_public_favorite_lists_likes').on(table.likeCount),
  }),
);

/**
 * 公開お気に入りリストアイテムテーブル
 */
export const publicFavoriteListItems = pgTable(
  'public_favorite_list_items',
  {
    listId: integer('list_id')
      .notNull()
      .references(() => publicFavoriteLists.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    displayOrder: integer('display_order').default(0),
    note: text('note'), // ユーザーメモ（任意）
    addedAt: timestamp('added_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.listId, table.productId] }),
    listIdx: index('idx_public_favorite_list_items_list').on(table.listId),
    productIdx: index('idx_public_favorite_list_items_product').on(table.productId),
    orderIdx: index('idx_public_favorite_list_items_order').on(table.listId, table.displayOrder),
  }),
);

/**
 * レビュー「参考になった」投票テーブル
 * 重複投票を防止
 */
export const userReviewVotes = pgTable(
  'user_review_votes',
  {
    reviewId: integer('review_id')
      .notNull()
      .references(() => userReviews.id, { onDelete: 'cascade' }),
    voterId: varchar('voter_id', { length: 255 }).notNull(), // Firebase UID
    voteType: varchar('vote_type', { length: 20 }).notNull(), // 'helpful', 'not_helpful'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.reviewId, table.voterId] }),
    reviewIdx: index('idx_user_review_votes_review').on(table.reviewId),
    voterIdx: index('idx_user_review_votes_voter').on(table.voterId),
  }),
);

/**
 * タグ提案投票テーブル
 * upvote/downvoteの追跡
 */
export const userTagVotes = pgTable(
  'user_tag_votes',
  {
    suggestionId: integer('suggestion_id')
      .notNull()
      .references(() => userTagSuggestions.id, { onDelete: 'cascade' }),
    voterId: varchar('voter_id', { length: 255 }).notNull(), // Firebase UID
    voteType: varchar('vote_type', { length: 20 }).notNull(), // 'up', 'down'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.suggestionId, table.voterId] }),
    suggestionIdx: index('idx_user_tag_votes_suggestion').on(table.suggestionId),
    voterIdx: index('idx_user_tag_votes_voter').on(table.voterId),
  }),
);

/**
 * 公開リスト「いいね」テーブル
 */
export const publicListLikes = pgTable(
  'public_list_likes',
  {
    listId: integer('list_id')
      .notNull()
      .references(() => publicFavoriteLists.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 }).notNull(), // Firebase UID
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.listId, table.userId] }),
    listIdx: index('idx_public_list_likes_list').on(table.listId),
    userIdx: index('idx_public_list_likes_user').on(table.userId),
  }),
);

/**
 * ユーザー演者提案テーブル
 * 作品に出演している演者の提案を保存
 */
export const userPerformerSuggestions = pgTable(
  'user_performer_suggestions',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 }).notNull(), // Firebase UID
    performerName: varchar('performer_name', { length: 200 }).notNull(),
    existingPerformerId: integer('existing_performer_id').references(() => performers.id, { onDelete: 'set null' }),
    upvotes: integer('upvotes').default(0),
    downvotes: integer('downvotes').default(0),
    // モデレーション関連
    status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending', 'approved', 'rejected'
    moderationReason: text('moderation_reason'),
    moderatedAt: timestamp('moderated_at'),
    moderatedBy: varchar('moderated_by', { length: 100 }),
    // タイムスタンプ
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    productIdx: index('idx_user_performer_suggestions_product').on(table.productId),
    userIdx: index('idx_user_performer_suggestions_user').on(table.userId),
    statusIdx: index('idx_user_performer_suggestions_status').on(table.status),
    performerNameIdx: index('idx_user_performer_suggestions_name').on(table.performerName),
    productPerformerUnique: uniqueIndex('idx_user_performer_suggestions_product_name').on(
      table.productId,
      table.performerName,
    ),
  }),
);

/**
 * 演者提案投票テーブル
 */
export const userPerformerVotes = pgTable(
  'user_performer_votes',
  {
    suggestionId: integer('suggestion_id')
      .notNull()
      .references(() => userPerformerSuggestions.id, { onDelete: 'cascade' }),
    voterId: varchar('voter_id', { length: 255 }).notNull(), // Firebase UID
    voteType: varchar('vote_type', { length: 20 }).notNull(), // 'up', 'down'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.suggestionId, table.voterId] }),
    suggestionIdx: index('idx_user_performer_votes_suggestion').on(table.suggestionId),
    voterIdx: index('idx_user_performer_votes_voter').on(table.voterId),
  }),
);

/**
 * 作品ランキング投票テーブル
 * ユーザーが作品に投票できる機能
 */
export const productRankingVotes = pgTable(
  'product_ranking_votes',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 }).notNull(), // Firebase UID
    category: varchar('category', { length: 50 }).notNull(), // 'best', 'trending', 'classic'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    productIdx: index('idx_product_ranking_votes_product').on(table.productId),
    userIdx: index('idx_product_ranking_votes_user').on(table.userId),
    categoryIdx: index('idx_product_ranking_votes_category').on(table.category),
    productCategoryUserUnique: uniqueIndex('idx_product_ranking_votes_unique').on(
      table.productId,
      table.category,
      table.userId,
    ),
  }),
);

/**
 * ユーザー貢献度サマリーテーブル
 * ユーザーの貢献度を集計
 */
export const userContributionStats = pgTable(
  'user_contribution_stats',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 255 }).unique().notNull(),
    displayName: varchar('display_name', { length: 100 }),
    reviewCount: integer('review_count').default(0),
    tagSuggestionCount: integer('tag_suggestion_count').default(0),
    tagApprovedCount: integer('tag_approved_count').default(0),
    performerSuggestionCount: integer('performer_suggestion_count').default(0),
    performerApprovedCount: integer('performer_approved_count').default(0),
    correctionCount: integer('correction_count').default(0),
    correctionApprovedCount: integer('correction_approved_count').default(0),
    publicListCount: integer('public_list_count').default(0),
    totalListLikes: integer('total_list_likes').default(0),
    contributionScore: integer('contribution_score').default(0),
    badges: jsonb('badges').default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_contribution_stats_user').on(table.userId),
    scoreIdx: index('idx_contribution_stats_score').on(table.contributionScore),
  }),
);

// 型エクスポート
export type UserReview = typeof userReviews.$inferSelect;
export type NewUserReview = typeof userReviews.$inferInsert;
export type UserTagSuggestion = typeof userTagSuggestions.$inferSelect;
export type NewUserTagSuggestion = typeof userTagSuggestions.$inferInsert;
export type UserCorrection = typeof userCorrections.$inferSelect;
export type NewUserCorrection = typeof userCorrections.$inferInsert;
export type PublicFavoriteList = typeof publicFavoriteLists.$inferSelect;
export type NewPublicFavoriteList = typeof publicFavoriteLists.$inferInsert;
export type PublicFavoriteListItem = typeof publicFavoriteListItems.$inferSelect;
export type NewPublicFavoriteListItem = typeof publicFavoriteListItems.$inferInsert;
export type UserReviewVote = typeof userReviewVotes.$inferSelect;
export type NewUserReviewVote = typeof userReviewVotes.$inferInsert;
export type UserTagVote = typeof userTagVotes.$inferSelect;
export type NewUserTagVote = typeof userTagVotes.$inferInsert;
export type PublicListLike = typeof publicListLikes.$inferSelect;
export type NewPublicListLike = typeof publicListLikes.$inferInsert;
export type UserPerformerSuggestion = typeof userPerformerSuggestions.$inferSelect;
export type NewUserPerformerSuggestion = typeof userPerformerSuggestions.$inferInsert;
export type UserPerformerVote = typeof userPerformerVotes.$inferSelect;
export type NewUserPerformerVote = typeof userPerformerVotes.$inferInsert;
export type UserContributionStat = typeof userContributionStats.$inferSelect;
export type NewUserContributionStat = typeof userContributionStats.$inferInsert;
