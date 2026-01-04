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
    makerProductCode: varchar('maker_product_code', { length: 50 }), // メーカー品番 (例: SSIS-865, 300MIUM-1000)
    title: varchar('title', { length: 500 }).notNull(),
    releaseDate: date('release_date'),
    description: text('description'),
    duration: integer('duration'), // 再生時間（分）
    defaultThumbnailUrl: text('default_thumbnail_url'), // デフォルトサムネイル画像（互換性のため）
    // 多言語対応カラム
    titleEn: varchar('title_en', { length: 500 }),
    titleZh: varchar('title_zh', { length: 500 }), // 簡体字中国語
    titleZhTw: varchar('title_zh_tw', { length: 500 }), // 繁体字中国語
    titleKo: varchar('title_ko', { length: 500 }),
    descriptionEn: text('description_en'),
    descriptionZh: text('description_zh'), // 簡体字中国語
    descriptionZhTw: text('description_zh_tw'), // 繁体字中国語
    descriptionKo: text('description_ko'),
    // AI生成コンテンツ
    aiDescription: jsonb('ai_description'), // AI生成の説明文詳細（キャッチコピー、短い説明、詳細説明など）
    aiCatchphrase: varchar('ai_catchphrase', { length: 500 }), // AIが生成したキャッチコピー
    aiShortDescription: text('ai_short_description'), // AIが生成した短い説明文
    aiTags: jsonb('ai_tags'), // AI抽出タグ（genres, attributes, plays, situations）
    aiReview: text('ai_review'), // AI生成のレビュー要約（ユーザーレビューベース）
    aiReviewUpdatedAt: timestamp('ai_review_updated_at'), // AIレビュー更新日時
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    normalizedIdIdx: index('idx_products_normalized_id').on(table.normalizedProductId),
    makerProductCodeIdx: index('idx_products_maker_code').on(table.makerProductCode),
    titleIdx: index('idx_products_title').on(table.title),
    releaseDateIdx: index('idx_products_release_date').on(table.releaseDate),
    titleEnIdx: index('idx_products_title_en').on(table.titleEn),
    titleZhIdx: index('idx_products_title_zh').on(table.titleZh),
    titleZhTwIdx: index('idx_products_title_zh_tw').on(table.titleZhTw),
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
    currency: varchar('currency', { length: 3 }).default('JPY'), // 'JPY' or 'USD'
    isSubscription: boolean('is_subscription').default(false), // 月額制かどうか
    productType: varchar('product_type', { length: 20 }), // 'haishin'(配信), 'dvd', 'monthly'(月額) など
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
 * セール情報テーブル
 * 各ASPのセール・割引情報を保持
 */
export const productSales = pgTable(
  'product_sales',
  {
    id: serial('id').primaryKey(),
    productSourceId: integer('product_source_id').notNull().references(() => productSources.id, { onDelete: 'cascade' }),
    regularPrice: integer('regular_price').notNull(), // 通常価格
    salePrice: integer('sale_price').notNull(), // セール価格
    discountPercent: integer('discount_percent'), // 割引率
    saleType: varchar('sale_type', { length: 50 }), // 'timesale', 'campaign', 'clearance' など
    saleName: varchar('sale_name', { length: 200 }), // セール名（例：「週末限定50%OFF」）
    startAt: timestamp('start_at'), // セール開始日時
    endAt: timestamp('end_at'), // セール終了日時
    isActive: boolean('is_active').default(true).notNull(),
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    productSourceIdx: index('idx_sales_product_source').on(table.productSourceId),
    activeIdx: index('idx_sales_active').on(table.isActive),
    endAtIdx: index('idx_sales_end_at').on(table.endAt),
    discountIdx: index('idx_sales_discount').on(table.discountPercent),
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
    isFanzaOnly: boolean('is_fanza_only').default(false), // FANZA専用女優フラグ（事前計算）
    latestReleaseDate: date('latest_release_date'), // 最新作品のリリース日（事前計算・ソート用）
    releaseCount: integer('release_count').default(0), // 作品数（事前計算・ソート用）
    // AIレビュー
    aiReview: text('ai_review'), // Gemini AIによる演者レビュー
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
    // パフォーマンス最適化用インデックス
    latestReleaseDateIdx: index('idx_performers_latest_release').on(table.latestReleaseDate),
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
 * 出演者の外部サイトID
 * 各サイト（FANZA, MGS, Sokmil等）での女優IDを保存
 */
export const performerExternalIds = pgTable(
  'performer_external_ids',
  {
    id: serial('id').primaryKey(),
    performerId: integer('performer_id').notNull().references(() => performers.id, { onDelete: 'cascade' }),
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
 * 生データ保存テーブル（CSV）
 * DUGA CSVの生データを保存し、再解析と重複を避ける
 */
export const rawCsvData = pgTable(
  'raw_csv_data',
  {
    id: serial('id').primaryKey(),
    source: varchar('source', { length: 50 }).notNull(), // 'DUGA' など
    productId: varchar('product_id', { length: 100 }).notNull(), // 商品ID（CSVの商品ID列）
    rawData: jsonb('raw_data'), // CSV行の全データをJSONBで保存（GCS移行後はnull可）
    gcsUrl: text('gcs_url'), // GCSに保存した場合のURL (gs://bucket/path)
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
    htmlContent: text('html_content'), // HTML全体を保存（GCS移行後はnull可）
    gcsUrl: text('gcs_url'), // GCSに保存した場合のURL (gs://bucket/path)
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
 * DUGA API生レスポンス保存テーブル
 * リカバリー用にAPIレスポンス全体を保存
 */
export const dugaRawResponses = pgTable(
  'duga_raw_responses',
  {
    id: serial('id').primaryKey(),
    productId: text('product_id').notNull(),
    apiVersion: text('api_version').notNull().default('1.2'),
    rawJson: jsonb('raw_json').notNull(),
    hash: varchar('hash', { length: 64 }), // 重複・更新検出用
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'), // 処理完了日時
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    productIdIdx: index('idx_duga_raw_product_id').on(table.productId),
    hashIdx: index('idx_duga_raw_hash').on(table.hash),
    fetchedIdx: index('idx_duga_raw_fetched_at').on(table.fetchedAt),
    productIdUnique: uniqueIndex('idx_duga_raw_product_unique').on(table.productId),
  }),
);

/**
 * ソクミルAPI生レスポンス保存テーブル
 */
export const sokmilRawResponses = pgTable(
  'sokmil_raw_responses',
  {
    id: serial('id').primaryKey(),
    itemId: text('item_id').notNull(),
    apiType: text('api_type').notNull(), // 'item', 'maker', 'label', 'series', 'genre', 'director', 'actor'
    rawJson: jsonb('raw_json').notNull(),
    hash: varchar('hash', { length: 64 }),
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    itemIdIdx: index('idx_sokmil_raw_item_id').on(table.itemId),
    apiTypeIdx: index('idx_sokmil_raw_api_type').on(table.apiType),
    hashIdx: index('idx_sokmil_raw_hash').on(table.hash),
    fetchedIdx: index('idx_sokmil_raw_fetched_at').on(table.fetchedAt),
    itemTypeUnique: uniqueIndex('idx_sokmil_raw_item_type_unique').on(table.itemId, table.apiType),
  }),
);

/**
 * MGSスクレイピング生データ保存テーブル
 */
export const mgsRawPages = pgTable(
  'mgs_raw_pages',
  {
    id: serial('id').primaryKey(),
    productUrl: text('product_url').notNull().unique(),
    productId: text('product_id'),
    rawHtml: text('raw_html').notNull(),
    rawJson: jsonb('raw_json'),
    hash: varchar('hash', { length: 64 }),
    statusCode: integer('status_code').notNull().default(200),
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    productUrlIdx: index('idx_mgs_raw_product_url').on(table.productUrl),
    productIdIdx: index('idx_mgs_raw_product_id').on(table.productId),
    hashIdx: index('idx_mgs_raw_hash').on(table.hash),
    fetchedIdx: index('idx_mgs_raw_fetched_at').on(table.fetchedAt),
  }),
);

/**
 * 商品と生データのリレーション管理テーブル
 * どの商品がどの生データから作成されたかを追跡
 */
export const productRawDataLinks = pgTable(
  'product_raw_data_links',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    sourceType: text('source_type').notNull(), // 'duga', 'sokmil', 'mgs', 'fc2', 'dti', 'b10f'
    rawDataId: integer('raw_data_id').notNull(), // 対応する生データテーブルのID
    rawDataTable: text('raw_data_table').notNull(), // 'duga_raw_responses', 'raw_html_data' など
    contentHash: varchar('content_hash', { length: 64 }), // 処理時点のハッシュ（再処理判定用）
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    productIdx: index('idx_product_raw_links_product').on(table.productId),
    sourceIdx: index('idx_product_raw_links_source').on(table.sourceType, table.rawDataId),
    productSourceUnique: uniqueIndex('idx_product_raw_links_unique').on(
      table.productId,
      table.sourceType,
      table.rawDataId
    ),
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
/**
 * Wikiクロールデータテーブル
 * 各Wikiサイトから収集した商品ID-出演者データを保存
 */
export const wikiCrawlData = pgTable(
  'wiki_crawl_data',
  {
    id: serial('id').primaryKey(),
    source: varchar('source', { length: 50 }).notNull(), // 'av-wiki', 'seesaa-wiki', 'shiroutoname', 'nakiny', 'fc2-blog' など
    productCode: varchar('product_code', { length: 100 }).notNull(), // 品番（300MIUM-1000など）
    performerName: varchar('performer_name', { length: 200 }).notNull(), // クロールで取得した出演者名
    sourceUrl: text('source_url'), // 情報取得元のURL
    rawData: jsonb('raw_data'), // 追加情報（タイトル、タグ等）をJSONで保存
    gcsUrl: text('gcs_url'), // GCSに保存した場合のURL (gs://bucket/path)
    crawledAt: timestamp('crawled_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'), // performers/product_performersへの反映完了日時
  },
  (table) => ({
    sourceProductPerformerUnique: uniqueIndex('idx_wiki_crawl_source_product_performer').on(
      table.source,
      table.productCode,
      table.performerName,
    ),
    sourceIdx: index('idx_wiki_crawl_source').on(table.source),
    productCodeIdx: index('idx_wiki_crawl_product_code').on(table.productCode),
    performerNameIdx: index('idx_wiki_crawl_performer_name').on(table.performerName),
    processedIdx: index('idx_wiki_crawl_processed').on(table.processedAt),
  }),
);

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
    content: text('content'), // レビュー本文
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

/**
 * Wiki/参考サイトから取得した出演者インデックス
 * 商品ID、作品タイトルから出演者名を検索するためのテーブル
 */
export const wikiPerformerIndex = pgTable(
  'wiki_performer_index',
  {
    id: serial('id').primaryKey(),
    // 検索キー
    productCode: varchar('product_code', { length: 100 }), // 商品コード
    productTitle: varchar('product_title', { length: 500 }), // 作品タイトル
    maker: varchar('maker', { length: 100 }), // メーカー/レーベル

    // 出演者情報
    performerName: varchar('performer_name', { length: 200 }).notNull(), // 出演者名
    performerNameRomaji: varchar('performer_name_romaji', { length: 200 }), // ローマ字名
    performerNameVariants: jsonb('performer_name_variants'), // 名前の変換候補

    // メタデータ
    source: varchar('source', { length: 50 }).notNull(), // データ取得元
    sourceUrl: text('source_url'), // 取得元URL
    confidence: integer('confidence').default(100), // 信頼度
    verified: boolean('verified').default(false), // 手動検証済みフラグ

    // タイムスタンプ
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    productCodeIdx: index('idx_wiki_performer_product_code').on(table.productCode),
    productTitleIdx: index('idx_wiki_performer_product_title').on(table.productTitle),
    makerIdx: index('idx_wiki_performer_maker').on(table.maker),
    performerNameIdx: index('idx_wiki_performer_name').on(table.performerName),
    sourceIdx: index('idx_wiki_performer_source').on(table.source),
    makerTitleIdx: index('idx_wiki_performer_maker_title').on(table.maker, table.productTitle),
  }),
);

/**
 * フッター用フィーチャー女優テーブル
 * GSCデータに基づいて動的に更新される
 */
export const footerFeaturedActresses = pgTable(
  'footer_featured_actresses',
  {
    id: serial('id').primaryKey(),
    performerId: integer('performer_id').notNull().references(() => performers.id, { onDelete: 'cascade' }),
    performerName: varchar('performer_name', { length: 200 }).notNull(),
    // 選定理由スコア
    impressions: integer('impressions').default(0), // GSC表示回数
    position: decimal('position', { precision: 6, scale: 2 }), // 平均順位
    priorityScore: integer('priority_score').default(0), // 優先度スコア（高い=表示優先）
    // メタデータ
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    performerUnique: uniqueIndex('idx_footer_featured_performer').on(table.performerId),
    priorityIdx: index('idx_footer_featured_priority').on(table.priorityScore),
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
export type WikiCrawlData = typeof wikiCrawlData.$inferSelect;
export type NewWikiCrawlData = typeof wikiCrawlData.$inferInsert;
export type ProductReview = typeof productReviews.$inferSelect;
export type NewProductReview = typeof productReviews.$inferInsert;
export type ProductRatingSummary = typeof productRatingSummary.$inferSelect;
export type NewProductRatingSummary = typeof productRatingSummary.$inferInsert;
export type DugaRawResponse = typeof dugaRawResponses.$inferSelect;
export type NewDugaRawResponse = typeof dugaRawResponses.$inferInsert;
export type SokmilRawResponse = typeof sokmilRawResponses.$inferSelect;
export type NewSokmilRawResponse = typeof sokmilRawResponses.$inferInsert;
export type MgsRawPage = typeof mgsRawPages.$inferSelect;
export type NewMgsRawPage = typeof mgsRawPages.$inferInsert;
export type ProductRawDataLink = typeof productRawDataLinks.$inferSelect;
export type NewProductRawDataLink = typeof productRawDataLinks.$inferInsert;
export type WikiPerformerIndex = typeof wikiPerformerIndex.$inferSelect;
export type NewWikiPerformerIndex = typeof wikiPerformerIndex.$inferInsert;
export type FooterFeaturedActress = typeof footerFeaturedActresses.$inferSelect;
export type NewFooterFeaturedActress = typeof footerFeaturedActresses.$inferInsert;

/**
 * ユーザー修正提案テーブル
 * 商品・出演者情報の修正提案を管理
 */
export const userCorrections = pgTable(
  'user_corrections',
  {
    id: serial('id').primaryKey(),
    targetType: varchar('target_type', { length: 50 }).notNull(), // 'product', 'performer'
    targetId: integer('target_id').notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(), // Firebase UID
    fieldName: varchar('field_name', { length: 100 }).notNull(), // 修正対象フィールド名
    currentValue: text('current_value'), // 現在の値
    suggestedValue: text('suggested_value').notNull(), // 提案する値
    reason: text('reason'), // 修正理由
    status: varchar('status', { length: 50 }).default('pending').notNull(), // pending, approved, rejected
    reviewedBy: varchar('reviewed_by', { length: 255 }), // 審査者
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    targetIdx: index('idx_corrections_target').on(table.targetType, table.targetId),
    userIdx: index('idx_corrections_user').on(table.userId),
    statusIdx: index('idx_corrections_status').on(table.status),
    createdIdx: index('idx_corrections_created').on(table.createdAt),
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
    userId: varchar('user_id', { length: 255 }).unique().notNull(), // Firebase UID
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
    contributionScore: integer('contribution_score').default(0), // 総合貢献スコア
    badges: jsonb('badges').default([]), // 獲得バッジ
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_contribution_stats_user').on(table.userId),
    scoreIdx: index('idx_contribution_stats_score').on(table.contributionScore),
  }),
);

export type UserCorrection = typeof userCorrections.$inferSelect;
export type NewUserCorrection = typeof userCorrections.$inferInsert;
export type UserContributionStat = typeof userContributionStats.$inferSelect;
export type NewUserContributionStat = typeof userContributionStats.$inferInsert;
