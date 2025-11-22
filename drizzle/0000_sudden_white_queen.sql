CREATE TABLE "performers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"name_kana" varchar(200),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "performers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "product_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"asp_name" varchar(50) NOT NULL,
	"price" integer,
	"sale_price" integer,
	"in_stock" boolean DEFAULT true,
	"affiliate_url" text,
	"thumbnail_url" text,
	"sample_images" jsonb,
	"point_rate" numeric(5, 2),
	"cached_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_performers" (
	"product_id" integer NOT NULL,
	"performer_id" integer NOT NULL,
	CONSTRAINT "product_performers_product_id_performer_id_pk" PRIMARY KEY("product_id","performer_id")
);
--> statement-breakpoint
CREATE TABLE "product_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"asp_name" varchar(50) NOT NULL,
	"original_product_id" varchar(100) NOT NULL,
	"affiliate_url" text NOT NULL,
	"price" integer,
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
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"normalized_product_id" varchar(100) NOT NULL,
	"title" varchar(500) NOT NULL,
	"release_date" date,
	"description" text,
	"duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_normalized_product_id_unique" UNIQUE("normalized_product_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "product_cache" ADD CONSTRAINT "product_cache_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_performers" ADD CONSTRAINT "product_performers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_performers" ADD CONSTRAINT "product_performers_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sources" ADD CONSTRAINT "product_sources_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_performers_name" ON "performers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_performers_kana" ON "performers" USING btree ("name_kana");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cache_product_asp" ON "product_cache" USING btree ("product_id","asp_name");--> statement-breakpoint
CREATE INDEX "idx_cache_freshness" ON "product_cache" USING btree ("product_id","asp_name","cached_at");--> statement-breakpoint
CREATE INDEX "idx_cache_product" ON "product_cache" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_pp_product" ON "product_performers" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_pp_performer" ON "product_performers" USING btree ("performer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sources_product_asp" ON "product_sources" USING btree ("product_id","asp_name");--> statement-breakpoint
CREATE INDEX "idx_sources_product" ON "product_sources" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_sources_asp" ON "product_sources" USING btree ("asp_name");--> statement-breakpoint
CREATE INDEX "idx_pt_product" ON "product_tags" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_pt_tag" ON "product_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_products_normalized_id" ON "products" USING btree ("normalized_product_id");--> statement-breakpoint
CREATE INDEX "idx_products_title" ON "products" USING btree ("title");--> statement-breakpoint
CREATE INDEX "idx_products_release_date" ON "products" USING btree ("release_date");--> statement-breakpoint
CREATE INDEX "idx_tags_name" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_tags_category" ON "tags" USING btree ("category");