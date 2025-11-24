import { getDb } from '../lib/db';
import { products, performers, tags } from '../lib/db/schema';
import { isNull, or, sql } from 'drizzle-orm';

async function checkTranslationStatus() {
  const db = getDb();

  console.log('🔍 データベース翻訳状況チェック\n');

  // Products の確認
  console.log('📦 Products テーブル:');
  const totalProducts = await db.select({ count: sql<number>`count(*)` }).from(products);
  const missingEnProducts = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(isNull(products.titleEn));
  const missingZhProducts = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(isNull(products.titleZh));
  const missingKoProducts = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(isNull(products.titleKo));

  console.log(`  総レコード数: ${totalProducts[0].count}`);
  console.log(`  英語翻訳欠落: ${missingEnProducts[0].count}`);
  console.log(`  中国語翻訳欠落: ${missingZhProducts[0].count}`);
  console.log(`  韓国語翻訳欠落: ${missingKoProducts[0].count}`);

  // サンプルデータを表示
  const sampleProducts = await db.select().from(products).limit(3);
  console.log('\n  サンプルデータ:');
  sampleProducts.forEach((p, i) => {
    console.log(`  ${i + 1}. ID: ${p.id}`);
    console.log(`     Title: ${p.title}`);
    console.log(`     EN: ${p.titleEn || 'NULL'}`);
    console.log(`     ZH: ${p.titleZh || 'NULL'}`);
    console.log(`     KO: ${p.titleKo || 'NULL'}`);
  });

  // Performers の確認
  console.log('\n👤 Performers テーブル:');
  const totalPerformers = await db.select({ count: sql<number>`count(*)` }).from(performers);
  const missingEnPerformers = await db
    .select({ count: sql<number>`count(*)` })
    .from(performers)
    .where(isNull(performers.nameEn));

  console.log(`  総レコード数: ${totalPerformers[0].count}`);
  console.log(`  英語翻訳欠落: ${missingEnPerformers[0].count}`);

  // Tags の確認
  console.log('\n🏷️  Tags テーブル:');
  const totalTags = await db.select({ count: sql<number>`count(*)` }).from(tags);
  const missingEnTags = await db
    .select({ count: sql<number>`count(*)` })
    .from(tags)
    .where(isNull(tags.nameEn));

  console.log(`  総レコード数: ${totalTags[0].count}`);
  console.log(`  英語翻訳欠落: ${missingEnTags[0].count}`);

  process.exit(0);
}

checkTranslationStatus();
