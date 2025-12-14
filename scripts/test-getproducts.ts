/**
 * getProducts関数のテスト
 * 実際に返されるProduct型のimageUrlを確認
 */

// apps/fanza/lib/dbからインポートできないので直接実装する
import { getDb } from "../packages/crawlers/src/lib/db";
import { products, productSources, productPerformers, productTags, productImages, productVideos, tags, performers } from "../packages/crawlers/src/lib/db/schema";
import { sql, eq, and, desc, asc, inArray } from "drizzle-orm";

const db = getDb();

// 商品タイプ（簡略版）
interface Product {
  id: string;
  title: string;
  imageUrl: string;
  defaultThumbnailUrl: string | null;
}

async function main() {
  console.log("=== getProducts imageUrl テスト ===\n");

  // FANZAフィルター付きで商品取得
  const results = await db
    .select({
      id: products.id,
      title: products.title,
      defaultThumbnailUrl: products.defaultThumbnailUrl,
      releaseDate: products.releaseDate,
      aspName: productSources.aspName,
    })
    .from(products)
    .innerJoin(productSources, eq(products.id, productSources.productId))
    .where(eq(productSources.aspName, 'FANZA'))
    .orderBy(desc(products.releaseDate))
    .limit(20);

  console.log(`取得件数: ${results.length}`);
  console.log("\n--- 商品一覧 ---");

  for (const p of results) {
    console.log(`ID: ${p.id}`);
    console.log(`  Title: ${p.title.substring(0, 40)}...`);
    console.log(`  ASP: ${p.aspName}`);
    console.log(`  defaultThumbnailUrl: ${p.defaultThumbnailUrl || 'NULL'}`);

    // mapProductToTypeと同じロジックでimageUrlを決定
    let imageUrl = p.defaultThumbnailUrl;
    if (!imageUrl) {
      // product_imagesから取得
      const images = await db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, p.id))
        .orderBy(asc(productImages.displayOrder))
        .limit(3);

      if (images.length > 0) {
        const thumbnail = images.find(img => img.imageType === 'thumbnail');
        imageUrl = thumbnail?.imageUrl || images[0].imageUrl;
      }
    }

    if (!imageUrl) {
      imageUrl = 'https://placehold.co/600x800/1f2937/ffffff?text=NO+IMAGE';
    }

    console.log(`  Final imageUrl: ${imageUrl}`);
    console.log('---');
  }

  // NULL/空のdefault_thumbnail_urlを持つFANZA商品を確認
  console.log("\n=== FANZA商品で imageUrl が空/NULLの確認 ===");
  const nullResults = await db
    .select({
      id: products.id,
      title: products.title,
      defaultThumbnailUrl: products.defaultThumbnailUrl,
    })
    .from(products)
    .innerJoin(productSources, eq(products.id, productSources.productId))
    .where(
      and(
        eq(productSources.aspName, 'FANZA'),
        sql`(${products.defaultThumbnailUrl} IS NULL OR ${products.defaultThumbnailUrl} = '')`
      )
    )
    .limit(10);

  console.log(`NULL/空のFANZA商品: ${nullResults.length}件`);
  for (const p of nullResults) {
    console.log(`  ID ${p.id}: ${p.title.substring(0, 30)}...`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
