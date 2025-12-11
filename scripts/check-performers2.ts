import { getDb } from "../packages/crawlers/src/lib/db";
import { sql } from "drizzle-orm";

const db = getDb();

async function main() {
  console.log("=== 演者データ確認 ===\n");

  // 身長が異常な値（100cm未満）の件数
  const abnormal = await db.execute(sql`SELECT COUNT(*) as cnt FROM performers WHERE height IS NOT NULL AND height < 100`);
  console.log("身長100cm未満（異常値）:", (abnormal.rows[0] as any).cnt);

  // 身長が正常な値（140cm以上170cm以下）の件数
  const normal = await db.execute(sql`SELECT COUNT(*) as cnt FROM performers WHERE height >= 140 AND height <= 170`);
  console.log("身長140-170cm（正常範囲）:", (normal.rows[0] as any).cnt);

  // 異常値の例
  const examples = await db.execute(sql`SELECT id, name, height, birthday FROM performers WHERE height IS NOT NULL AND height < 100 LIMIT 10`);
  console.log("\n異常値の例:");
  for (const row of examples.rows as any[]) {
    console.log("  ID:", row.id, row.name, "height:", row.height, "birthday:", row.birthday);
  }

  // 正常値の例
  const normalExamples = await db.execute(sql`SELECT id, name, height, birthday FROM performers WHERE height >= 140 AND height <= 170 ORDER BY id DESC LIMIT 10`);
  console.log("\n正常値の例:");
  for (const row of normalExamples.rows as any[]) {
    console.log("  ID:", row.id, row.name, "height:", row.height, "birthday:", row.birthday);
  }
}
main().catch(console.error).finally(() => process.exit(0));
