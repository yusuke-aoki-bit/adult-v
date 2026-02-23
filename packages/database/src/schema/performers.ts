/**
 * 演者関連テーブル
 * performers, performerAliases, performerExternalIds, performerImages
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
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

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
    nameZh: varchar('name_zh', { length: 200 }), // 簡体字中国語
    nameZhTw: varchar('name_zh_tw', { length: 200 }), // 繁体字中国語
    nameKo: varchar('name_ko', { length: 200 }),
    bioJa: text('bio_ja'),
    bioEn: text('bio_en'),
    bioZh: text('bio_zh'), // 簡体字中国語
    bioZhTw: text('bio_zh_tw'), // 繁体字中国語
    bioKo: text('bio_ko'),
    // 身体情報
    height: integer('height'), // 身長 (cm)
    bust: integer('bust'), // バスト (cm)
    waist: integer('waist'), // ウエスト (cm)
    hip: integer('hip'), // ヒップ (cm)
    cup: varchar('cup', { length: 10 }), // カップサイズ
    birthday: date('birthday'), // 生年月日
    bloodType: varchar('blood_type', { length: 10 }), // 血液型
    birthplace: varchar('birthplace', { length: 100 }), // 出身地
    hobbies: text('hobbies'), // 趣味・特技
    twitterId: varchar('twitter_id', { length: 100 }), // Twitter/X
    instagramId: varchar('instagram_id', { length: 100 }), // Instagram
    debutYear: integer('debut_year'), // デビュー年
    isRetired: boolean('is_retired').default(false), // 引退フラグ
    isFanzaOnly: boolean('is_fanza_only').default(false), // FANZA専用フラグ（FANZA以外のASPに出演作品がない）
    // 統計情報（performer-pipelineで更新）
    latestReleaseDate: date('latest_release_date'), // 最新作品のリリース日（ソート用）
    releaseCount: integer('release_count').default(0), // 出演作品数（ソート用）
    // AIレビュー
    aiReview: text('ai_review'), // Gemini AIによる演者レビュー
    aiReviewEn: text('ai_review_en'), // AIレビュー（英語）
    aiReviewZh: text('ai_review_zh'), // AIレビュー（中国語簡体字）
    aiReviewKo: text('ai_review_ko'), // AIレビュー（韓国語）
    aiReviewUpdatedAt: timestamp('ai_review_updated_at'), // レビュー更新日時
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('idx_performers_name').on(table.name),
    kanaIdx: index('idx_performers_kana').on(table.nameKana),
    nameEnIdx: index('idx_performers_name_en').on(table.nameEn),
    nameZhIdx: index('idx_performers_name_zh').on(table.nameZh),
    nameZhTwIdx: index('idx_performers_name_zh_tw').on(table.nameZhTw),
    nameKoIdx: index('idx_performers_name_ko').on(table.nameKo),
    heightIdx: index('idx_performers_height').on(table.height),
    cupIdx: index('idx_performers_cup').on(table.cup),
    birthdayIdx: index('idx_performers_birthday').on(table.birthday),
    fanzaOnlyIdx: index('idx_performers_fanza_only').on(table.isFanzaOnly),
    latestReleaseDateIdx: index('idx_performers_latest_release_date').on(table.latestReleaseDate),
    releaseCountIdx: index('idx_performers_release_count').on(table.releaseCount),
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
    performerId: integer('performer_id')
      .notNull()
      .references(() => performers.id, { onDelete: 'cascade' }),
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
 * 出演者の外部サイトID
 * 各サイト（FANZA, MGS, Sokmil等）での女優IDを保存
 */
export const performerExternalIds = pgTable(
  'performer_external_ids',
  {
    id: serial('id').primaryKey(),
    performerId: integer('performer_id')
      .notNull()
      .references(() => performers.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).notNull(), // 'sokmil', 'fanza', 'mgs', 'b10f', etc.
    externalId: varchar('external_id', { length: 200 }).notNull(), // そのサイトでの女優ID
    externalUrl: text('external_url'), // そのサイトでの女優ページURL
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    performerIdIdx: index('idx_performer_external_performer').on(table.performerId),
    providerIdx: index('idx_performer_external_provider').on(table.provider),
    providerExternalIdx: index('idx_performer_external_lookup').on(table.provider, table.externalId),
    uniqueProviderPerformer: uniqueIndex('idx_performer_external_unique').on(table.performerId, table.provider),
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
    performerId: integer('performer_id')
      .notNull()
      .references(() => performers.id, { onDelete: 'cascade' }),
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

// 型エクスポート
export type Performer = typeof performers.$inferSelect;
export type NewPerformer = typeof performers.$inferInsert;
export type PerformerAlias = typeof performerAliases.$inferSelect;
export type NewPerformerAlias = typeof performerAliases.$inferInsert;
export type PerformerImage = typeof performerImages.$inferSelect;
export type NewPerformerImage = typeof performerImages.$inferInsert;
