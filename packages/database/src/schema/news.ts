/**
 * ニュース記事テーブル
 * 自動生成（新着まとめ・セール速報・AI分析）+ 手動登録（サイト更新・業界ニュース）
 */

import { pgTable, serial, varchar, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

export const newsArticles = pgTable(
  'news_articles',
  {
    id: serial('id').primaryKey(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    category: varchar('category', { length: 50 }).notNull(),
    // 'new_releases' | 'sales' | 'industry' | 'site_update' | 'ai_analysis'
    title: varchar('title', { length: 500 }).notNull(),
    titleEn: varchar('title_en', { length: 500 }),
    excerpt: text('excerpt'),
    content: text('content').notNull(),
    imageUrl: varchar('image_url', { length: 1000 }),
    source: varchar('source', { length: 100 }),
    // 'auto' | 'gemini' | 'rss:xxx' | 'manual'
    sourceUrl: varchar('source_url', { length: 1000 }),
    status: varchar('status', { length: 20 }).default('published').notNull(),
    // 'draft' | 'published' | 'archived'
    featured: boolean('featured').default(false),
    viewCount: integer('view_count').default(0),
    publishedAt: timestamp('published_at').defaultNow(),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    aiModel: varchar('ai_model', { length: 50 }),
    relatedProductIds: text('related_product_ids'),
    relatedPerformerIds: text('related_performer_ids'),
  },
  (table) => [
    index('idx_news_category').on(table.category),
    index('idx_news_published').on(table.publishedAt),
    index('idx_news_status').on(table.status),
  ],
);

export type NewsArticle = InferSelectModel<typeof newsArticles>;
export type NewNewsArticle = InferInsertModel<typeof newsArticles>;
