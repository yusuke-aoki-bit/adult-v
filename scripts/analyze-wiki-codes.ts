import { getDb } from "../packages/crawlers/src/lib/db";
import { sql } from "drizzle-orm";

const db = getDb();

async function main() {
  console.log("=== wiki_crawl_data 品番パターン分析 ===\n");

  // パターン別の件数
  const patterns = [
    { name: "HEYZO形式 (HEYZO-XXXX)", pattern: "^HEYZO-[0-9]+" },
    { name: "英字-数字 (ABW-123)", pattern: "^[A-Z]{2,6}-[0-9]{2,5}$" },
    { name: "数字プレフィックス (300MIUM-123)", pattern: "^[0-9]{3}[A-Z]+-[0-9]+$" },
    { name: "アンダースコア形式 (112918_776)", pattern: "^[0-9]{6}_[0-9]+$" },
    { name: "ハイフンなし (STARS123)", pattern: "^[A-Z]{2,6}[0-9]{2,5}$" },
    { name: "FC2 (FC2-PPV-123)", pattern: "^FC2" },
  ];

  for (const p of patterns) {
    const result = await db.execute(sql.raw(`
      SELECT COUNT(*) as cnt FROM wiki_crawl_data WHERE product_code ~ '${p.pattern}'
    `));
    console.log(`${p.name}: ${result.rows[0].cnt}件`);
  }

  // 具体的なサンプル
  console.log("\n=== 品番サンプル ===\n");

  // 英字-数字形式
  const samples1 = await db.execute(sql`
    SELECT DISTINCT product_code FROM wiki_crawl_data
    WHERE product_code ~ '^[A-Z]{2,6}-[0-9]{2,5}$'
    ORDER BY product_code
    LIMIT 20
  `);
  console.log("英字-数字形式サンプル:");
  console.log(samples1.rows.map(r => r.product_code).join(", "));

  // 数字プレフィックス
  const samples2 = await db.execute(sql`
    SELECT DISTINCT product_code FROM wiki_crawl_data
    WHERE product_code ~ '^[0-9]{3}[A-Z]+-[0-9]+$'
    ORDER BY product_code DESC
    LIMIT 20
  `);
  console.log("\n数字プレフィックス形式サンプル:");
  console.log(samples2.rows.map(r => r.product_code).join(", "));

  // productsテーブルのMGS品番
  console.log("\n=== products (MGS) 品番サンプル ===");
  const mgsSamples = await db.execute(sql`
    SELECT p.normalized_product_id, ps.original_product_id
    FROM products p
    INNER JOIN product_sources ps ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS'
    LIMIT 20
  `);
  for (const r of mgsSamples.rows) {
    console.log(`  ${r.normalized_product_id} (original: ${r.original_product_id})`);
  }

  // マッチングテスト: wiki品番 vs products品番
  console.log("\n=== マッチングテスト ===");

  // 品番変換関数
  function extractCodes(normalizedId: string): string[] {
    const codes: string[] = [];
    const upper = normalizedId.toUpperCase();
    codes.push(upper);

    // FANZA-xxx → xxx
    if (upper.startsWith("FANZA-")) {
      const withoutFanza = upper.replace("FANZA-", "");
      codes.push(withoutFanza);
      const match = withoutFanza.match(/^([A-Z]+)(\d+)$/);
      if (match) {
        const letters = match[1];
        const numbers = match[2].replace(/^0+/, "");
        codes.push(`${letters}-${numbers}`);
      }
    }

    // 425BDSX-01902 → BDSX-1902
    const numPrefixMatch = upper.match(/^(\d{2,3})([A-Z]+)-?(\d+)$/);
    if (numPrefixMatch) {
      const letters = numPrefixMatch[2];
      const numbers = numPrefixMatch[3];
      codes.push(`${letters}-${numbers}`);
      codes.push(`${letters}-${numbers.replace(/^0+/, "")}`);
    }

    return [...new Set(codes)];
  }

  // テストケース
  const testCases = [
    "FANZA-gvh00802",
    "425bdsx-01902",
    "HEYZO-0463",
    "300mium-123",
  ];

  for (const tc of testCases) {
    console.log(`  ${tc} → ${extractCodes(tc).join(", ")}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
