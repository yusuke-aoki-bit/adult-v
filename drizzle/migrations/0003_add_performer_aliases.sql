-- Add performer_aliases table for managing multiple names per performer

CREATE TABLE IF NOT EXISTS "performer_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"performer_id" integer NOT NULL,
	"alias_name" varchar(200) NOT NULL,
	"source" varchar(100),
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraint
ALTER TABLE "performer_aliases" ADD CONSTRAINT "performer_aliases_performer_id_performers_id_fk"
  FOREIGN KEY ("performer_id") REFERENCES "performers"("id") ON DELETE cascade ON UPDATE no action;

-- Add indexes
CREATE INDEX IF NOT EXISTS "idx_aliases_performer" ON "performer_aliases" ("performer_id");
CREATE INDEX IF NOT EXISTS "idx_aliases_name" ON "performer_aliases" ("alias_name");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_aliases_performer_alias" ON "performer_aliases" ("performer_id","alias_name");

-- Insert current performer names as primary aliases
INSERT INTO "performer_aliases" ("performer_id", "alias_name", "source", "is_primary", "created_at")
SELECT
  id,
  name,
  'initial',
  true,
  created_at
FROM "performers"
ON CONFLICT DO NOTHING;
