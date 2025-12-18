/**
 * wiki_crawl_dataの品番と商品テーブルのマッチング状況を分析
 */
import { getDb } from "../packages/crawlers/src/lib/db";
import { sql } from "drizzle-orm";

const db = getDb();

async function main() {
  console.log("=== Wiki品番マッチング分析 ===\n");

  // 1. wiki_crawl_dataのサンプル品番を取得
  const sampleCodes = await db.execute(sql`
    SELECT product_code, source
    FROM wiki_crawl_data
    WHERE processed_at IS NOT NULL
    LIMIT 20
  `);

  console.log("📋 処理済みWikiデータのサンプル品番:");
  for (const row of sampleCodes.rows as any[]) {
    console.log(`  ${row.source}: ${row.product_code}`);
  }

  // 2. 未処理のWikiデータのサンプル
  const unprocessedSample = await db.execute(sql`
    SELECT product_code, source
    FROM wiki_crawl_data
    WHERE processed_at IS NULL
    LIMIT 20
  `);

  console.log("\n📋 未処理Wikiデータのサンプル品番:");
  for (const row of unprocessedSample.rows as any[]) {
    console.log(`  ${row.source}: ${row.product_code}`);
  }

  // 3. 商品テーブルのnormalized_product_idサンプル
  const productSample = await db.execute(sql`
    SELECT normalized_product_id
    FROM products
    LIMIT 20
  `);

  console.log("\n📦 商品テーブルのnormalized_product_idサンプル:");
  for (const row of productSample.rows as any[]) {
    console.log(`  ${row.normalized_product_id}`);
  }

  // 4. マッチするかテスト（そのまま）
  const directMatch = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM wiki_crawl_data wcd
    WHERE EXISTS (
      SELECT 1 FROM products p
      WHERE p.normalized_product_id = wcd.product_code
    )
  `);
  console.log(`\n🔍 直接マッチ数: ${(directMatch.rows[0] as any).count}`);

  // 5. 小文字化してマッチ
  const lowerMatch = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM wiki_crawl_data wcd
    WHERE EXISTS (
      SELECT 1 FROM products p
      WHERE p.normalized_product_id = LOWER(wcd.product_code)
    )
  `);
  console.log(`🔍 小文字マッチ数: ${(lowerMatch.rows[0] as any).count}`);

  // 6. ハイフン除去+小文字化してマッチ
  const normalizedMatch = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM wiki_crawl_data wcd
    WHERE EXISTS (
      SELECT 1 FROM products p
      WHERE p.normalized_product_id = LOWER(REPLACE(wcd.product_code, '-', ''))
    )
  `);
  console.log(`🔍 正規化マッチ数(小文字+ハイフン除去): ${(normalizedMatch.rows[0] as any).count}`);

  // 7. 品番パターン別の分析
  console.log("\n📊 ソース別の品番パターン:");
  const patternAnalysis = await db.execute(sql`
    SELECT
      source,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE product_code ~ '^[A-Z]+-[0-9]+$') as with_hyphen,
      COUNT(*) FILTER (WHERE product_code ~ '^[a-z]+[0-9]+$') as lowercase_no_hyphen,
      COUNT(*) FILTER (WHERE product_code ~ '^[A-Z]+[0-9]+$') as uppercase_no_hyphen
    FROM wiki_crawl_data
    GROUP BY source
    ORDER BY total DESC
  `);

  for (const row of patternAnalysis.rows as any[]) {
    console.log(`  ${row.source}:`);
    console.log(`    合計: ${row.total}`);
    console.log(`    ハイフン付き(ABC-123): ${row.with_hyphen}`);
    console.log(`    小文字+数字(abc123): ${row.lowercase_no_hyphen}`);
    console.log(`    大文字+数字(ABC123): ${row.uppercase_no_hyphen}`);
  }

  // 8. 商品テーブルの正規化形式確認
  console.log("\n📦 商品テーブルのnormalized_product_idパターン:");
  const productPatterns = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE normalized_product_id ~ '^[a-z]+[0-9]+$') as lowercase_no_hyphen,
      COUNT(*) FILTER (WHERE normalized_product_id ~ '^[a-z]+-[0-9]+$') as lowercase_with_hyphen,
      COUNT(*) FILTER (WHERE normalized_product_id ~ '^[A-Z]+') as has_uppercase
    FROM products
  `);

  const patterns = productPatterns.rows[0] as any;
  console.log(`  合計: ${patterns.total}`);
  console.log(`  小文字+数字(abc123): ${patterns.lowercase_no_hyphen}`);
  console.log(`  小文字+ハイフン+数字(abc-123): ${patterns.lowercase_with_hyphen}`);
  console.log(`  大文字含む: ${patterns.has_uppercase}`);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
