import { getDb } from "../packages/crawlers/src/lib/db";
import { performers, performerAliases } from "../packages/crawlers/src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const performerId = parseInt(process.argv[2] || "376841", 10);
  const db = getDb();

  const [performer] = await db.select().from(performers).where(eq(performers.id, performerId)).limit(1);
  console.log("Performer:", JSON.stringify(performer, null, 2));

  const aliases = await db.select().from(performerAliases).where(eq(performerAliases.performerId, performerId));
  console.log("\nAliases count:", aliases.length);
  console.log("Aliases:", JSON.stringify(aliases, null, 2));

  process.exit(0);
}

main().catch(console.error);
