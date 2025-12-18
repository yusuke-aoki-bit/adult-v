import { getDb } from "../packages/crawlers/src/lib/db";
import { products, performers, productPerformers, productSources, productImages, productReviews, performerExternalIds, wikiCrawlData } from "../packages/crawlers/src/lib/db/schema";
import { sql, count, isNotNull, isNull, and } from "drizzle-orm";

const db = getDb();

async function main() {
  console.log("=== データベース統計 ===\n");

  const [productCount] = await db.select({ count: count() }).from(products);
  console.log("📦 総商品数:", productCount.count);

  const [performerCount] = await db.select({ count: count() }).from(performers);
  console.log("👤 総演者数:", performerCount.count);

  const [linkCount] = await db.select({ count: count() }).from(productPerformers);
  console.log("🔗 商品-演者リンク:", linkCount.count);

  const [imageCount] = await db.select({ count: count() }).from(productImages);
  console.log("🖼️ 商品画像数:", imageCount.count);

  // 演者詳細情報の補充率
  console.log("\n👤 演者詳細情報の補充率:");

  // 画像URLあり
  const [withImage] = await db.select({ count: count() }).from(performers).where(isNotNull(performers.profileImageUrl));
  const imageRate = ((withImage.count as number) / (performerCount.count as number) * 100).toFixed(1);
  console.log(`  画像URLあり: ${withImage.count} (${imageRate}%)`);

  // 身体情報あり（身長がある場合）
  const [withHeight] = await db.select({ count: count() }).from(performers).where(isNotNull(performers.height));
  const heightRate = ((withHeight.count as number) / (performerCount.count as number) * 100).toFixed(1);
  console.log(`  身長あり: ${withHeight.count} (${heightRate}%)`);

  // 誕生日あり
  const [withBirthday] = await db.select({ count: count() }).from(performers).where(isNotNull(performers.birthday));
  const birthdayRate = ((withBirthday.count as number) / (performerCount.count as number) * 100).toFixed(1);
  console.log(`  誕生日あり: ${withBirthday.count} (${birthdayRate}%)`);

  // 出身地あり
  const [withBirthplace] = await db.select({ count: count() }).from(performers).where(isNotNull(performers.birthplace));
  const birthplaceRate = ((withBirthplace.count as number) / (performerCount.count as number) * 100).toFixed(1);
  console.log(`  出身地あり: ${withBirthplace.count} (${birthplaceRate}%)`);

  // AIレビューあり
  const [withAiReview] = await db.select({ count: count() }).from(performers).where(isNotNull(performers.aiReview));
  const aiReviewRate = ((withAiReview.count as number) / (performerCount.count as number) * 100).toFixed(1);
  console.log(`  AIレビューあり: ${withAiReview.count} (${aiReviewRate}%)`);

  // 完全なプロフィール（画像+身体情報+誕生日）
  const [fullProfile] = await db.select({ count: count() }).from(performers).where(
    and(
      isNotNull(performers.profileImageUrl),
      isNotNull(performers.height),
      isNotNull(performers.birthday)
    )
  );
  const fullRate = ((fullProfile.count as number) / (performerCount.count as number) * 100).toFixed(1);
  console.log(`  完全プロフィール(画像+身長+誕生日): ${fullProfile.count} (${fullRate}%)`);

  // 外部ID統計
  console.log("\n🔗 外部ID連携:");
  const externalIdCounts = await db.select({
    provider: performerExternalIds.provider,
    count: count()
  })
  .from(performerExternalIds)
  .groupBy(performerExternalIds.provider)
  .orderBy(sql`count(*) DESC`);

  for (const row of externalIdCounts) {
    console.log(`  ${row.provider}: ${row.count}`);
  }

  // Wikiクロールデータ統計
  console.log("\n📚 Wikiクロールデータ:");
  const wikiCounts = await db.select({
    source: wikiCrawlData.source,
    count: count()
  })
  .from(wikiCrawlData)
  .groupBy(wikiCrawlData.source)
  .orderBy(sql`count(*) DESC`);

  for (const row of wikiCounts) {
    console.log(`  ${row.source}: ${row.count}`);
  }

  // 処理済み/未処理
  const [processedWiki] = await db.select({ count: count() }).from(wikiCrawlData).where(isNotNull(wikiCrawlData.processedAt));
  const [totalWiki] = await db.select({ count: count() }).from(wikiCrawlData);
  const processedRate = totalWiki.count ? ((processedWiki.count as number) / (totalWiki.count as number) * 100).toFixed(1) : '0';
  console.log(`  処理済み: ${processedWiki.count}/${totalWiki.count} (${processedRate}%)`);

  // 翻訳統計
  console.log("\n🌐 翻訳データ:");
  const [enCount] = await db.select({ count: count() }).from(products).where(isNotNull(products.titleEn));
  const enRate = ((enCount.count as number) / (productCount.count as number) * 100).toFixed(1);
  console.log(`  英語翻訳あり: ${enCount.count} (${enRate}%)`);
  const [zhCount] = await db.select({ count: count() }).from(products).where(isNotNull(products.titleZh));
  const zhRate = ((zhCount.count as number) / (productCount.count as number) * 100).toFixed(1);
  console.log(`  中国語翻訳あり: ${zhCount.count} (${zhRate}%)`);
  const [koCount] = await db.select({ count: count() }).from(products).where(isNotNull(products.titleKo));
  const koRate = ((koCount.count as number) / (productCount.count as number) * 100).toFixed(1);
  console.log(`  韓国語翻訳あり: ${koCount.count} (${koRate}%)`);

  // レビュー統計
  console.log("\n⭐ レビューデータ:");
  const [reviewCount] = await db.select({ count: count() }).from(productReviews);
  console.log("  総レビュー数:", reviewCount.count);

  console.log("\n📊 ASP別商品数:");
  const aspCounts = await db.select({
    aspName: productSources.aspName,
    count: count()
  })
  .from(productSources)
  .groupBy(productSources.aspName)
  .orderBy(sql`count(*) DESC`);

  for (const row of aspCounts) {
    console.log(`  ${row.aspName}: ${row.count}`);
  }

  // 商品-演者紐づけ率
  console.log("\n🔗 商品-演者紐づけ:");
  const productsWithPerformerResult = await db.execute(sql`
    SELECT COUNT(DISTINCT product_id) as count FROM product_performers
  `);
  const linkedCount = Number((productsWithPerformerResult.rows[0] as any).count);
  const linkedRate = (linkedCount / (productCount.count as number) * 100).toFixed(1);
  console.log(`  演者紐づけ済み商品: ${linkedCount} (${linkedRate}%)`);
  console.log(`  未紐づけ商品: ${(productCount.count as number) - linkedCount}`);
}

main().catch(console.error).finally(() => process.exit(0));
