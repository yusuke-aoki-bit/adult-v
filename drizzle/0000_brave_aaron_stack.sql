CREATE TABLE "duga_raw_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"api_version" text DEFAULT '1.2' NOT NULL,
	"raw_json" jsonb NOT NULL,
	"hash" varchar(64),
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mgs_raw_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_url" text NOT NULL,
	"product_id" text,
	"raw_html" text NOT NULL,
	"raw_json" jsonb,
	"hash" varchar(64),
	"status_code" integer DEFAULT 200 NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mgs_raw_pages_product_url_unique" UNIQUE("product_url")
);
--> statement-breakpoint
CREATE TABLE "performer_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"performer_id" integer NOT NULL,
	"alias_name" varchar(200) NOT NULL,
	"source" varchar(100),
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performer_external_ids" (
	"id" serial PRIMARY KEY NOT NULL,
	"performer_id" integer NOT NULL,
	"provider" varchar(50) NOT NULL,
	"external_id" varchar(200) NOT NULL,
	"external_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "performer_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"performer_id" integer NOT NULL,
	"image_url" text NOT NULL,
	"image_type" varchar(50),
	"width" integer,
	"height" integer,
	"source" varchar(100),
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"name_kana" varchar(200),
	"profile_image_url" text,
	"name_en" varchar(200),
	"name_zh" varchar(200),
	"name_zh_tw" varchar(200),
	"name_ko" varchar(200),
	"bio_ja" text,
	"bio_en" text,
	"bio_zh" text,
	"bio_zh_tw" text,
	"bio_ko" text,
	"height" integer,
	"bust" integer,
	"waist" integer,
	"hip" integer,
	"cup" varchar(10),
	"birthday" date,
	"blood_type" varchar(10),
	"birthplace" varchar(100),
	"hobbies" text,
	"twitter_id" varchar(100),
	"instagram_id" varchar(100),
	"debut_year" integer,
	"is_retired" boolean DEFAULT false,
	"is_fanza_only" boolean DEFAULT false,
	"ai_review" text,
	"ai_review_en" text,
	"ai_review_zh" text,
	"ai_review_ko" text,
	"ai_review_updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "performers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_source_id" integer NOT NULL,
	"price" integer NOT NULL,
	"sale_price" integer,
	"discount_percent" integer,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"image_url" text NOT NULL,
	"image_type" varchar(50) NOT NULL,
	"display_order" integer DEFAULT 0,
	"width" integer,
	"height" integer,
	"asp_name" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_performers" (
	"product_id" integer NOT NULL,
	"performer_id" integer NOT NULL,
	CONSTRAINT "product_performers_product_id_performer_id_pk" PRIMARY KEY("product_id","performer_id")
);
--> statement-breakpoint
CREATE TABLE "product_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_source_id" integer NOT NULL,
	"price_type" varchar(30) NOT NULL,
	"price" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'JPY',
	"is_default" boolean DEFAULT false,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_rating_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"asp_name" varchar(50) NOT NULL,
	"average_rating" numeric(3, 2),
	"max_rating" numeric(3, 1) DEFAULT '5',
	"total_reviews" integer DEFAULT 0,
	"rating_distribution" jsonb,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_raw_data_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"source_type" text NOT NULL,
	"raw_data_id" integer NOT NULL,
	"raw_data_table" text NOT NULL,
	"content_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"asp_name" varchar(50) NOT NULL,
	"reviewer_name" varchar(100),
	"rating" numeric(3, 1),
	"max_rating" numeric(3, 1) DEFAULT '5',
	"title" text,
	"title_en" text,
	"title_zh" text,
	"title_ko" text,
	"content" text,
	"content_en" text,
	"content_zh" text,
	"content_ko" text,
	"review_date" timestamp,
	"helpful" integer DEFAULT 0,
	"source_review_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_source_id" integer NOT NULL,
	"regular_price" integer NOT NULL,
	"sale_price" integer NOT NULL,
	"discount_percent" integer,
	"sale_type" varchar(50),
	"sale_name" varchar(200),
	"start_at" timestamp,
	"end_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"asp_name" varchar(50) NOT NULL,
	"original_product_id" varchar(100) NOT NULL,
	"affiliate_url" text NOT NULL,
	"price" integer,
	"currency" varchar(3) DEFAULT 'JPY',
	"is_subscription" boolean DEFAULT false,
	"data_source" varchar(10) NOT NULL,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_tags" (
	"product_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "product_tags_product_id_tag_id_pk" PRIMARY KEY("product_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "product_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"language" varchar(10) NOT NULL,
	"title" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"video_url" text NOT NULL,
	"video_type" varchar(50) NOT NULL,
	"quality" varchar(50),
	"duration" integer,
	"file_size" bigint,
	"format" varchar(50),
	"asp_name" varchar(50),
	"display_order" integer DEFAULT 0,
	"requires_auth" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"normalized_product_id" varchar(100) NOT NULL,
	"maker_product_code" varchar(50),
	"title" varchar(500) NOT NULL,
	"release_date" date,
	"description" text,
	"duration" integer,
	"default_thumbnail_url" text,
	"title_en" varchar(500),
	"title_zh" varchar(500),
	"title_zh_tw" varchar(500),
	"title_ko" varchar(500),
	"description_en" text,
	"description_zh" text,
	"description_zh_tw" text,
	"description_ko" text,
	"ai_description" jsonb,
	"ai_catchphrase" varchar(500),
	"ai_short_description" text,
	"ai_tags" jsonb,
	"ai_review" text,
	"ai_review_en" text,
	"ai_review_zh" text,
	"ai_review_ko" text,
	"ai_review_updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_normalized_product_id_unique" UNIQUE("normalized_product_id")
);
--> statement-breakpoint
CREATE TABLE "public_favorite_list_items" (
	"list_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"display_order" integer DEFAULT 0,
	"note" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_favorite_list_items_list_id_product_id_pk" PRIMARY KEY("list_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "public_favorite_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"view_count" integer DEFAULT 0,
	"like_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_list_likes" (
	"list_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_list_likes_list_id_user_id_pk" PRIMARY KEY("list_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "raw_csv_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(50) NOT NULL,
	"product_id" varchar(100) NOT NULL,
	"raw_data" jsonb,
	"gcs_url" text,
	"downloaded_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"hash" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_html_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(50) NOT NULL,
	"product_id" varchar(100) NOT NULL,
	"url" text NOT NULL,
	"html_content" text,
	"gcs_url" text,
	"crawled_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"hash" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_patterns" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_source_id" integer,
	"performer_id" integer,
	"maker_id" integer,
	"pattern_type" varchar(50) NOT NULL,
	"month_distribution" jsonb,
	"day_of_week_distribution" jsonb,
	"avg_discount_percent" numeric(5, 2),
	"avg_sale_duration_days" numeric(5, 2),
	"sale_frequency_per_year" numeric(5, 2),
	"total_sales_count" integer DEFAULT 0,
	"last_sale_date" date,
	"last_calculated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sokmil_raw_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"api_type" text NOT NULL,
	"raw_json" jsonb NOT NULL,
	"hash" varchar(64),
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(50),
	"name_en" varchar(100),
	"name_zh" varchar(100),
	"name_zh_tw" varchar(100),
	"name_ko" varchar(100),
	"description_ja" text,
	"description_en" text,
	"description_zh" text,
	"description_zh_tw" text,
	"description_ko" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_corrections" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"field_name" varchar(100) NOT NULL,
	"current_value" text,
	"suggested_value" text NOT NULL,
	"reason" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"moderation_reason" text,
	"moderated_at" timestamp,
	"moderated_by" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_review_votes" (
	"review_id" integer NOT NULL,
	"voter_id" varchar(255) NOT NULL,
	"vote_type" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_review_votes_review_id_voter_id_pk" PRIMARY KEY("review_id","voter_id")
);
--> statement-breakpoint
CREATE TABLE "user_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"rating" numeric(3, 1) NOT NULL,
	"title" varchar(200),
	"content" text NOT NULL,
	"helpful_count" integer DEFAULT 0,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"moderation_reason" text,
	"moderated_at" timestamp,
	"moderated_by" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tag_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"suggested_tag_name" varchar(100) NOT NULL,
	"existing_tag_id" integer,
	"upvotes" integer DEFAULT 0,
	"downvotes" integer DEFAULT 0,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"moderation_reason" text,
	"moderated_at" timestamp,
	"moderated_by" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tag_votes" (
	"suggestion_id" integer NOT NULL,
	"voter_id" varchar(255) NOT NULL,
	"vote_type" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_tag_votes_suggestion_id_voter_id_pk" PRIMARY KEY("suggestion_id","voter_id")
);
--> statement-breakpoint
CREATE TABLE "video_timestamps" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_video_id" integer NOT NULL,
	"timestamp_seconds" integer NOT NULL,
	"label" varchar(100),
	"vote_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_crawl_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(50) NOT NULL,
	"product_code" varchar(100) NOT NULL,
	"performer_name" varchar(200) NOT NULL,
	"source_url" text,
	"raw_data" jsonb,
	"gcs_url" text,
	"crawled_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "wiki_performer_index" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_code" varchar(100),
	"product_title" varchar(500),
	"maker" varchar(100),
	"performer_name" varchar(200) NOT NULL,
	"performer_name_romaji" varchar(200),
	"performer_name_variants" jsonb,
	"source" varchar(50) NOT NULL,
	"source_url" text,
	"confidence" integer DEFAULT 100,
	"verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "performer_aliases" ADD CONSTRAINT "performer_aliases_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performer_external_ids" ADD CONSTRAINT "performer_external_ids_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performer_images" ADD CONSTRAINT "performer_images_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_source_id_product_sources_id_fk" FOREIGN KEY ("product_source_id") REFERENCES "public"."product_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_performers" ADD CONSTRAINT "product_performers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_performers" ADD CONSTRAINT "product_performers_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_source_id_product_sources_id_fk" FOREIGN KEY ("product_source_id") REFERENCES "public"."product_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_rating_summary" ADD CONSTRAINT "product_rating_summary_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_raw_data_links" ADD CONSTRAINT "product_raw_data_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sales" ADD CONSTRAINT "product_sales_product_source_id_product_sources_id_fk" FOREIGN KEY ("product_source_id") REFERENCES "public"."product_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sources" ADD CONSTRAINT "product_sources_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_videos" ADD CONSTRAINT "product_videos_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_favorite_list_items" ADD CONSTRAINT "public_favorite_list_items_list_id_public_favorite_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."public_favorite_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_favorite_list_items" ADD CONSTRAINT "public_favorite_list_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_list_likes" ADD CONSTRAINT "public_list_likes_list_id_public_favorite_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."public_favorite_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_patterns" ADD CONSTRAINT "sale_patterns_product_source_id_product_sources_id_fk" FOREIGN KEY ("product_source_id") REFERENCES "public"."product_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_patterns" ADD CONSTRAINT "sale_patterns_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_patterns" ADD CONSTRAINT "sale_patterns_maker_id_tags_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_review_votes" ADD CONSTRAINT "user_review_votes_review_id_user_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."user_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reviews" ADD CONSTRAINT "user_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tag_suggestions" ADD CONSTRAINT "user_tag_suggestions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tag_suggestions" ADD CONSTRAINT "user_tag_suggestions_existing_tag_id_tags_id_fk" FOREIGN KEY ("existing_tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tag_votes" ADD CONSTRAINT "user_tag_votes_suggestion_id_user_tag_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."user_tag_suggestions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_timestamps" ADD CONSTRAINT "video_timestamps_product_video_id_product_videos_id_fk" FOREIGN KEY ("product_video_id") REFERENCES "public"."product_videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_duga_raw_product_id" ON "duga_raw_responses" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_duga_raw_hash" ON "duga_raw_responses" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "idx_duga_raw_fetched_at" ON "duga_raw_responses" USING btree ("fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_duga_raw_product_unique" ON "duga_raw_responses" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_mgs_raw_product_url" ON "mgs_raw_pages" USING btree ("product_url");--> statement-breakpoint
CREATE INDEX "idx_mgs_raw_product_id" ON "mgs_raw_pages" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_mgs_raw_hash" ON "mgs_raw_pages" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "idx_mgs_raw_fetched_at" ON "mgs_raw_pages" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "idx_aliases_performer" ON "performer_aliases" USING btree ("performer_id");--> statement-breakpoint
CREATE INDEX "idx_aliases_name" ON "performer_aliases" USING btree ("alias_name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_aliases_performer_alias" ON "performer_aliases" USING btree ("performer_id","alias_name");--> statement-breakpoint
CREATE INDEX "idx_performer_external_performer" ON "performer_external_ids" USING btree ("performer_id");--> statement-breakpoint
CREATE INDEX "idx_performer_external_provider" ON "performer_external_ids" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_performer_external_lookup" ON "performer_external_ids" USING btree ("provider","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_performer_external_unique" ON "performer_external_ids" USING btree ("performer_id","provider");--> statement-breakpoint
CREATE INDEX "idx_performer_images_performer" ON "performer_images" USING btree ("performer_id");--> statement-breakpoint
CREATE INDEX "idx_performer_images_type" ON "performer_images" USING btree ("image_type");--> statement-breakpoint
CREATE INDEX "idx_performer_images_primary" ON "performer_images" USING btree ("performer_id","is_primary");--> statement-breakpoint
CREATE INDEX "idx_performers_name" ON "performers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_performers_kana" ON "performers" USING btree ("name_kana");--> statement-breakpoint
CREATE INDEX "idx_performers_name_en" ON "performers" USING btree ("name_en");--> statement-breakpoint
CREATE INDEX "idx_performers_name_zh" ON "performers" USING btree ("name_zh");--> statement-breakpoint
CREATE INDEX "idx_performers_name_zh_tw" ON "performers" USING btree ("name_zh_tw");--> statement-breakpoint
CREATE INDEX "idx_performers_name_ko" ON "performers" USING btree ("name_ko");--> statement-breakpoint
CREATE INDEX "idx_performers_height" ON "performers" USING btree ("height");--> statement-breakpoint
CREATE INDEX "idx_performers_cup" ON "performers" USING btree ("cup");--> statement-breakpoint
CREATE INDEX "idx_performers_birthday" ON "performers" USING btree ("birthday");--> statement-breakpoint
CREATE INDEX "idx_performers_fanza_only" ON "performers" USING btree ("is_fanza_only");--> statement-breakpoint
CREATE INDEX "idx_price_history_product_source" ON "price_history" USING btree ("product_source_id");--> statement-breakpoint
CREATE INDEX "idx_price_history_recorded_at" ON "price_history" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "idx_price_history_product_source_recorded" ON "price_history" USING btree ("product_source_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_product_images_product" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_images_type" ON "product_images" USING btree ("image_type");--> statement-breakpoint
CREATE INDEX "idx_product_images_order" ON "product_images" USING btree ("product_id","display_order");--> statement-breakpoint
CREATE INDEX "idx_product_images_asp" ON "product_images" USING btree ("asp_name");--> statement-breakpoint
CREATE INDEX "idx_pp_product" ON "product_performers" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_pp_performer" ON "product_performers" USING btree ("performer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_prices_source_type" ON "product_prices" USING btree ("product_source_id","price_type");--> statement-breakpoint
CREATE INDEX "idx_prices_source" ON "product_prices" USING btree ("product_source_id");--> statement-breakpoint
CREATE INDEX "idx_prices_type" ON "product_prices" USING btree ("price_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_rating_summary_product_asp" ON "product_rating_summary" USING btree ("product_id","asp_name");--> statement-breakpoint
CREATE INDEX "idx_rating_summary_product" ON "product_rating_summary" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_rating_summary_avg" ON "product_rating_summary" USING btree ("average_rating");--> statement-breakpoint
CREATE INDEX "idx_product_raw_links_product" ON "product_raw_data_links" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_raw_links_source" ON "product_raw_data_links" USING btree ("source_type","raw_data_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_raw_links_unique" ON "product_raw_data_links" USING btree ("product_id","source_type","raw_data_id");--> statement-breakpoint
CREATE INDEX "idx_product_reviews_product" ON "product_reviews" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_reviews_asp" ON "product_reviews" USING btree ("asp_name");--> statement-breakpoint
CREATE INDEX "idx_product_reviews_rating" ON "product_reviews" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "idx_product_reviews_date" ON "product_reviews" USING btree ("review_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_reviews_source" ON "product_reviews" USING btree ("product_id","asp_name","source_review_id");--> statement-breakpoint
CREATE INDEX "idx_sales_product_source" ON "product_sales" USING btree ("product_source_id");--> statement-breakpoint
CREATE INDEX "idx_sales_active" ON "product_sales" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_sales_end_at" ON "product_sales" USING btree ("end_at");--> statement-breakpoint
CREATE INDEX "idx_sales_discount" ON "product_sales" USING btree ("discount_percent");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sources_product_asp" ON "product_sources" USING btree ("product_id","asp_name");--> statement-breakpoint
CREATE INDEX "idx_sources_product" ON "product_sources" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_sources_asp" ON "product_sources" USING btree ("asp_name");--> statement-breakpoint
CREATE INDEX "idx_sources_original_product_id" ON "product_sources" USING btree ("original_product_id");--> statement-breakpoint
CREATE INDEX "idx_sources_asp_original_id" ON "product_sources" USING btree ("asp_name","original_product_id");--> statement-breakpoint
CREATE INDEX "idx_pt_product" ON "product_tags" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_pt_tag" ON "product_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_translations_unique" ON "product_translations" USING btree ("product_id","language");--> statement-breakpoint
CREATE INDEX "idx_product_translations_product_id" ON "product_translations" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_translations_language" ON "product_translations" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_product_videos_product" ON "product_videos" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_videos_type" ON "product_videos" USING btree ("video_type");--> statement-breakpoint
CREATE INDEX "idx_product_videos_quality" ON "product_videos" USING btree ("quality");--> statement-breakpoint
CREATE INDEX "idx_product_videos_asp" ON "product_videos" USING btree ("asp_name");--> statement-breakpoint
CREATE INDEX "idx_product_videos_order" ON "product_videos" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "idx_products_normalized_id" ON "products" USING btree ("normalized_product_id");--> statement-breakpoint
CREATE INDEX "idx_products_maker_code" ON "products" USING btree ("maker_product_code");--> statement-breakpoint
CREATE INDEX "idx_products_title" ON "products" USING btree ("title");--> statement-breakpoint
CREATE INDEX "idx_products_release_date" ON "products" USING btree ("release_date");--> statement-breakpoint
CREATE INDEX "idx_products_title_en" ON "products" USING btree ("title_en");--> statement-breakpoint
CREATE INDEX "idx_products_title_zh" ON "products" USING btree ("title_zh");--> statement-breakpoint
CREATE INDEX "idx_products_title_zh_tw" ON "products" USING btree ("title_zh_tw");--> statement-breakpoint
CREATE INDEX "idx_products_title_ko" ON "products" USING btree ("title_ko");--> statement-breakpoint
CREATE INDEX "idx_public_favorite_list_items_list" ON "public_favorite_list_items" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "idx_public_favorite_list_items_product" ON "public_favorite_list_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_public_favorite_list_items_order" ON "public_favorite_list_items" USING btree ("list_id","display_order");--> statement-breakpoint
CREATE INDEX "idx_public_favorite_lists_user" ON "public_favorite_lists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_public_favorite_lists_public" ON "public_favorite_lists" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "idx_public_favorite_lists_views" ON "public_favorite_lists" USING btree ("view_count");--> statement-breakpoint
CREATE INDEX "idx_public_favorite_lists_likes" ON "public_favorite_lists" USING btree ("like_count");--> statement-breakpoint
CREATE INDEX "idx_public_list_likes_list" ON "public_list_likes" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "idx_public_list_likes_user" ON "public_list_likes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_raw_csv_source_product" ON "raw_csv_data" USING btree ("source","product_id");--> statement-breakpoint
CREATE INDEX "idx_raw_csv_hash" ON "raw_csv_data" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "idx_raw_csv_source" ON "raw_csv_data" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_raw_csv_downloaded" ON "raw_csv_data" USING btree ("downloaded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_raw_html_source_product" ON "raw_html_data" USING btree ("source","product_id");--> statement-breakpoint
CREATE INDEX "idx_raw_html_hash" ON "raw_html_data" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "idx_raw_html_source" ON "raw_html_data" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_raw_html_crawled" ON "raw_html_data" USING btree ("crawled_at");--> statement-breakpoint
CREATE INDEX "idx_raw_html_url" ON "raw_html_data" USING btree ("url");--> statement-breakpoint
CREATE INDEX "idx_sale_patterns_type" ON "sale_patterns" USING btree ("pattern_type");--> statement-breakpoint
CREATE INDEX "idx_sale_patterns_performer" ON "sale_patterns" USING btree ("performer_id");--> statement-breakpoint
CREATE INDEX "idx_sale_patterns_maker" ON "sale_patterns" USING btree ("maker_id");--> statement-breakpoint
CREATE INDEX "idx_sale_patterns_product_source" ON "sale_patterns" USING btree ("product_source_id");--> statement-breakpoint
CREATE INDEX "idx_sokmil_raw_item_id" ON "sokmil_raw_responses" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_sokmil_raw_api_type" ON "sokmil_raw_responses" USING btree ("api_type");--> statement-breakpoint
CREATE INDEX "idx_sokmil_raw_hash" ON "sokmil_raw_responses" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "idx_sokmil_raw_fetched_at" ON "sokmil_raw_responses" USING btree ("fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sokmil_raw_item_type_unique" ON "sokmil_raw_responses" USING btree ("item_id","api_type");--> statement-breakpoint
CREATE INDEX "idx_tags_name" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_tags_category" ON "tags" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_tags_name_en" ON "tags" USING btree ("name_en");--> statement-breakpoint
CREATE INDEX "idx_tags_name_zh" ON "tags" USING btree ("name_zh");--> statement-breakpoint
CREATE INDEX "idx_tags_name_zh_tw" ON "tags" USING btree ("name_zh_tw");--> statement-breakpoint
CREATE INDEX "idx_tags_name_ko" ON "tags" USING btree ("name_ko");--> statement-breakpoint
CREATE INDEX "idx_user_corrections_target" ON "user_corrections" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_user_corrections_user" ON "user_corrections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_corrections_status" ON "user_corrections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_corrections_field" ON "user_corrections" USING btree ("field_name");--> statement-breakpoint
CREATE INDEX "idx_user_review_votes_review" ON "user_review_votes" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "idx_user_review_votes_voter" ON "user_review_votes" USING btree ("voter_id");--> statement-breakpoint
CREATE INDEX "idx_user_reviews_product" ON "user_reviews" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_user_reviews_user" ON "user_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_reviews_status" ON "user_reviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_reviews_rating" ON "user_reviews" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "idx_user_reviews_created" ON "user_reviews" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_reviews_product_user" ON "user_reviews" USING btree ("product_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_user_tag_suggestions_product" ON "user_tag_suggestions" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_user_tag_suggestions_user" ON "user_tag_suggestions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_tag_suggestions_status" ON "user_tag_suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_tag_suggestions_tag" ON "user_tag_suggestions" USING btree ("suggested_tag_name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_tag_suggestions_product_tag" ON "user_tag_suggestions" USING btree ("product_id","suggested_tag_name");--> statement-breakpoint
CREATE INDEX "idx_user_tag_votes_suggestion" ON "user_tag_votes" USING btree ("suggestion_id");--> statement-breakpoint
CREATE INDEX "idx_user_tag_votes_voter" ON "user_tag_votes" USING btree ("voter_id");--> statement-breakpoint
CREATE INDEX "idx_video_timestamps_video" ON "video_timestamps" USING btree ("product_video_id");--> statement-breakpoint
CREATE INDEX "idx_video_timestamps_votes" ON "video_timestamps" USING btree ("vote_count");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_wiki_crawl_source_product_performer" ON "wiki_crawl_data" USING btree ("source","product_code","performer_name");--> statement-breakpoint
CREATE INDEX "idx_wiki_crawl_source" ON "wiki_crawl_data" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_wiki_crawl_product_code" ON "wiki_crawl_data" USING btree ("product_code");--> statement-breakpoint
CREATE INDEX "idx_wiki_crawl_performer_name" ON "wiki_crawl_data" USING btree ("performer_name");--> statement-breakpoint
CREATE INDEX "idx_wiki_crawl_processed" ON "wiki_crawl_data" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "idx_wiki_performer_product_code" ON "wiki_performer_index" USING btree ("product_code");--> statement-breakpoint
CREATE INDEX "idx_wiki_performer_product_title" ON "wiki_performer_index" USING btree ("product_title");--> statement-breakpoint
CREATE INDEX "idx_wiki_performer_maker" ON "wiki_performer_index" USING btree ("maker");--> statement-breakpoint
CREATE INDEX "idx_wiki_performer_name" ON "wiki_performer_index" USING btree ("performer_name");--> statement-breakpoint
CREATE INDEX "idx_wiki_performer_source" ON "wiki_performer_index" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_wiki_performer_maker_title" ON "wiki_performer_index" USING btree ("maker","product_title");