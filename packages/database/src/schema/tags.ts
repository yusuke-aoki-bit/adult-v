/**
 * タグ・中間テーブル
 * tags, productTags, productPerformers
 */

import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { products } from './products';
import { performers } from './performers';

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
    nameZh: varchar('name_zh', { length: 100 }), // 簡体字中国語
    nameZhTw: varchar('name_zh_tw', { length: 100 }), // 繁体字中国語
    nameKo: varchar('name_ko', { length: 100 }),
    descriptionJa: text('description_ja'),
    descriptionEn: text('description_en'),
    descriptionZh: text('description_zh'), // 簡体字中国語
    descriptionZhTw: text('description_zh_tw'), // 繁体字中国語
    descriptionKo: text('description_ko'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('idx_tags_name').on(table.name),
    categoryIdx: index('idx_tags_category').on(table.category),
    nameEnIdx: index('idx_tags_name_en').on(table.nameEn),
    nameZhIdx: index('idx_tags_name_zh').on(table.nameZh),
    nameZhTwIdx: index('idx_tags_name_zh_tw').on(table.nameZhTw),
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
 * 演者-タグ 中間テーブル
 * 演者の特徴（巨乳、スレンダー、美脚など）を保存
 */
export const performerTags = pgTable(
  'performer_tags',
  {
    performerId: integer('performer_id').notNull().references(() => performers.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
    source: varchar('source', { length: 50 }), // 'minnano-av', 'product-derivation', 'ai-gemini'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.performerId, table.tagId] }),
    performerIdx: index('idx_performer_tags_performer').on(table.performerId),
    tagIdx: index('idx_performer_tags_tag').on(table.tagId),
  }),
);

// 型エクスポート
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type PerformerTag = typeof performerTags.$inferSelect;
export type NewPerformerTag = typeof performerTags.$inferInsert;
