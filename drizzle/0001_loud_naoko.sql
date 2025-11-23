CREATE TABLE "performer_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"performer_id" integer NOT NULL,
	"alias_name" varchar(200) NOT NULL,
	"source" varchar(100),
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_csv_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(50) NOT NULL,
	"product_id" varchar(100) NOT NULL,
	"raw_data" jsonb NOT NULL,
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
	"html_content" text NOT NULL,
	"crawled_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"hash" varchar(64) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "performer_aliases" ADD CONSTRAINT "performer_aliases_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_aliases_performer" ON "performer_aliases" USING btree ("performer_id");--> statement-breakpoint
CREATE INDEX "idx_aliases_name" ON "performer_aliases" USING btree ("alias_name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_aliases_performer_alias" ON "performer_aliases" USING btree ("performer_id","alias_name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_raw_csv_source_product" ON "raw_csv_data" USING btree ("source","product_id");--> statement-breakpoint
CREATE INDEX "idx_raw_csv_hash" ON "raw_csv_data" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "idx_raw_csv_source" ON "raw_csv_data" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_raw_csv_downloaded" ON "raw_csv_data" USING btree ("downloaded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_raw_html_source_product" ON "raw_html_data" USING btree ("source","product_id");--> statement-breakpoint
CREATE INDEX "idx_raw_html_hash" ON "raw_html_data" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "idx_raw_html_source" ON "raw_html_data" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_raw_html_crawled" ON "raw_html_data" USING btree ("crawled_at");--> statement-breakpoint
CREATE INDEX "idx_raw_html_url" ON "raw_html_data" USING btree ("url");--> statement-breakpoint
CREATE INDEX "idx_cache_asp" ON "product_cache" USING btree ("asp_name");--> statement-breakpoint
CREATE INDEX "idx_sources_original_product_id" ON "product_sources" USING btree ("original_product_id");--> statement-breakpoint
CREATE INDEX "idx_sources_asp_original_id" ON "product_sources" USING btree ("asp_name","original_product_id");