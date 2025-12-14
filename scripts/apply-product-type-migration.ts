/**
 * product_type カラム追加マイグレーション
 *
 * 1. product_sources テーブルに product_type カラムを追加
 * 2. 既存のMGS商品は 'haishin' をデフォルトとして設定
 */

import { getDb } from "../packages/crawlers/src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const db = getDb();

  console.log("=== product_type カラム追加マイグレーション ===\n");

  try {
    // 1. カラムの存在確認
    const checkColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'product_sources'
      AND column_name = 'product_type'
    `);

    if (checkColumn.rows.length > 0) {
      console.log("product_type カラムは既に存在します");
    } else {
      // 2. カラム追加
      console.log("product_type カラムを追加中...");
      await db.execute(sql`
        ALTER TABLE product_sources
        ADD COLUMN product_type VARCHAR(20)
      `);
      console.log("  ✓ カラム追加完了");
    }

    // 3. インデックス追加
    console.log("\nインデックスを確認・追加中...");

    // product_type 単体インデックス
    const checkIdx1 = await db.execute(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'product_sources'
      AND indexname = 'idx_sources_product_type'
    `);

    if (checkIdx1.rows.length === 0) {
      await db.execute(sql`
        CREATE INDEX idx_sources_product_type ON product_sources(product_type)
      `);
      console.log("  ✓ idx_sources_product_type 追加完了");
    } else {
      console.log("  - idx_sources_product_type は既に存在");
    }

    // asp_name + product_type 複合インデックス
    const checkIdx2 = await db.execute(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'product_sources'
      AND indexname = 'idx_sources_asp_product_type'
    `);

    if (checkIdx2.rows.length === 0) {
      await db.execute(sql`
        CREATE INDEX idx_sources_asp_product_type ON product_sources(asp_name, product_type)
      `);
      console.log("  ✓ idx_sources_asp_product_type 追加完了");
    } else {
      console.log("  - idx_sources_asp_product_type は既に存在");
    }

    // 4. 既存MGS商品のデフォルト値を設定
    console.log("\n既存MGS商品のproduct_typeを設定中...");

    const updateResult = await db.execute(sql`
      UPDATE product_sources
      SET product_type = 'haishin'
      WHERE asp_name = 'MGS'
      AND product_type IS NULL
    `);

    console.log(`  ✓ ${updateResult.rowCount} 件のMGS商品を 'haishin' に設定`);

    // 5. 統計表示
    console.log("\n=== 現在のproduct_type統計 ===");
    const stats = await db.execute(sql`
      SELECT
        asp_name,
        product_type,
        COUNT(*) as count
      FROM product_sources
      WHERE asp_name = 'MGS'
      GROUP BY asp_name, product_type
      ORDER BY count DESC
    `);

    console.table(stats.rows);

    console.log("\n✓ マイグレーション完了!");

  } catch (error) {
    console.error("エラー:", error);
    throw error;
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
