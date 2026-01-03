-- ユーザー参加型プラットフォーム機能用テーブル追加
-- Migration: 0001_add_user_platform_tables

-- ユーザーレビューテーブル
CREATE TABLE IF NOT EXISTS "user_reviews" (
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

-- ユーザータグ提案テーブル
CREATE TABLE IF NOT EXISTS "user_tag_suggestions" (
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

-- ユーザー情報修正提案テーブル
CREATE TABLE IF NOT EXISTS "user_corrections" (
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

-- 公開お気に入りリストテーブル
CREATE TABLE IF NOT EXISTS "public_favorite_lists" (
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

-- 公開お気に入りリストアイテムテーブル
CREATE TABLE IF NOT EXISTS "public_favorite_list_items" (
	"list_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"display_order" integer DEFAULT 0,
	"note" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_favorite_list_items_list_id_product_id_pk" PRIMARY KEY("list_id","product_id")
);

-- レビュー投票テーブル
CREATE TABLE IF NOT EXISTS "user_review_votes" (
	"review_id" integer NOT NULL,
	"voter_id" varchar(255) NOT NULL,
	"vote_type" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_review_votes_review_id_voter_id_pk" PRIMARY KEY("review_id","voter_id")
);

-- タグ提案投票テーブル
CREATE TABLE IF NOT EXISTS "user_tag_votes" (
	"suggestion_id" integer NOT NULL,
	"voter_id" varchar(255) NOT NULL,
	"vote_type" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_tag_votes_suggestion_id_voter_id_pk" PRIMARY KEY("suggestion_id","voter_id")
);

-- 公開リストいいねテーブル
CREATE TABLE IF NOT EXISTS "public_list_likes" (
	"list_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_list_likes_list_id_user_id_pk" PRIMARY KEY("list_id","user_id")
);

-- 外部キー制約
ALTER TABLE "user_reviews" ADD CONSTRAINT "user_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "user_tag_suggestions" ADD CONSTRAINT "user_tag_suggestions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "user_tag_suggestions" ADD CONSTRAINT "user_tag_suggestions_existing_tag_id_tags_id_fk" FOREIGN KEY ("existing_tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "public_favorite_list_items" ADD CONSTRAINT "public_favorite_list_items_list_id_public_favorite_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."public_favorite_lists"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public_favorite_list_items" ADD CONSTRAINT "public_favorite_list_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "user_review_votes" ADD CONSTRAINT "user_review_votes_review_id_user_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."user_reviews"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "user_tag_votes" ADD CONSTRAINT "user_tag_votes_suggestion_id_user_tag_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."user_tag_suggestions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public_list_likes" ADD CONSTRAINT "public_list_likes_list_id_public_favorite_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."public_favorite_lists"("id") ON DELETE cascade ON UPDATE no action;

-- インデックス
CREATE INDEX IF NOT EXISTS "idx_user_reviews_product" ON "user_reviews" USING btree ("product_id");
CREATE INDEX IF NOT EXISTS "idx_user_reviews_user" ON "user_reviews" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_reviews_status" ON "user_reviews" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_user_reviews_rating" ON "user_reviews" USING btree ("rating");
CREATE INDEX IF NOT EXISTS "idx_user_reviews_created" ON "user_reviews" USING btree ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_reviews_product_user" ON "user_reviews" USING btree ("product_id","user_id");

CREATE INDEX IF NOT EXISTS "idx_user_tag_suggestions_product" ON "user_tag_suggestions" USING btree ("product_id");
CREATE INDEX IF NOT EXISTS "idx_user_tag_suggestions_user" ON "user_tag_suggestions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_tag_suggestions_status" ON "user_tag_suggestions" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_user_tag_suggestions_tag" ON "user_tag_suggestions" USING btree ("suggested_tag_name");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_tag_suggestions_product_tag" ON "user_tag_suggestions" USING btree ("product_id","suggested_tag_name");

CREATE INDEX IF NOT EXISTS "idx_user_corrections_target" ON "user_corrections" USING btree ("target_type","target_id");
CREATE INDEX IF NOT EXISTS "idx_user_corrections_user" ON "user_corrections" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_corrections_status" ON "user_corrections" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_user_corrections_field" ON "user_corrections" USING btree ("field_name");

CREATE INDEX IF NOT EXISTS "idx_public_favorite_lists_user" ON "public_favorite_lists" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_public_favorite_lists_public" ON "public_favorite_lists" USING btree ("is_public");
CREATE INDEX IF NOT EXISTS "idx_public_favorite_lists_views" ON "public_favorite_lists" USING btree ("view_count");
CREATE INDEX IF NOT EXISTS "idx_public_favorite_lists_likes" ON "public_favorite_lists" USING btree ("like_count");

CREATE INDEX IF NOT EXISTS "idx_public_favorite_list_items_list" ON "public_favorite_list_items" USING btree ("list_id");
CREATE INDEX IF NOT EXISTS "idx_public_favorite_list_items_product" ON "public_favorite_list_items" USING btree ("product_id");
CREATE INDEX IF NOT EXISTS "idx_public_favorite_list_items_order" ON "public_favorite_list_items" USING btree ("list_id","display_order");

CREATE INDEX IF NOT EXISTS "idx_user_review_votes_review" ON "user_review_votes" USING btree ("review_id");
CREATE INDEX IF NOT EXISTS "idx_user_review_votes_voter" ON "user_review_votes" USING btree ("voter_id");

CREATE INDEX IF NOT EXISTS "idx_user_tag_votes_suggestion" ON "user_tag_votes" USING btree ("suggestion_id");
CREATE INDEX IF NOT EXISTS "idx_user_tag_votes_voter" ON "user_tag_votes" USING btree ("voter_id");

CREATE INDEX IF NOT EXISTS "idx_public_list_likes_list" ON "public_list_likes" USING btree ("list_id");
CREATE INDEX IF NOT EXISTS "idx_public_list_likes_user" ON "public_list_likes" USING btree ("user_id");
