import { getDb } from '../lib/db';
import { performers, performerAliases, performerImages } from '../lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import { fetchActressWikiData } from '../lib/wiki-client';

/**
 * Wikiから女優の別名・作品情報を収集してデータベースに保存
 */

async function collectActressAliases() {
  const db = getDb();

  console.log('=== Collecting Actress Aliases from Wiki ===\n');

  // 処理する女優を取得（別名が未登録の女優を優先）
  const actressesToProcess = await db.execute(sql`
    SELECT p.id, p.name
    FROM performers p
    LEFT JOIN performer_aliases pa ON p.id = pa.performer_id
    WHERE pa.id IS NULL
    ORDER BY p.id
    LIMIT 100
  `);

  console.log(`Found ${actressesToProcess.rows.length} actresses without aliases\n`);

  let successCount = 0;
  let failCount = 0;
  let aliasesAdded = 0;
  let imagesAdded = 0;

  for (const actress of actressesToProcess.rows as any[]) {
    console.log(`\n[${successCount + failCount + 1}/${actressesToProcess.rows.length}] Processing: ${actress.name}`);

    try {
      // Wikiデータ取得（両方のWikiから）
      const wikiData = await fetchActressWikiData(actress.name);

      if (!wikiData) {
        console.log(`  ⚠️  No wiki data found for ${actress.name}`);
        failCount++;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // 別名を保存
      let addedAliases = 0;
      for (const alias of wikiData.aliases) {
        try {
          // 重複チェック
          const existing = await db.query.performerAliases.findFirst({
            where: eq(performerAliases.aliasName, alias),
          });

          if (!existing) {
            await db.insert(performerAliases).values({
              performerId: actress.id,
              aliasName: alias,
              source: wikiData.source,
              isPrimary: false,
            });
            addedAliases++;
            aliasesAdded++;
          }
        } catch (error) {
          console.error(`    ❌ Error adding alias "${alias}":`, error);
        }
      }

      // プロフィール画像を保存
      if (wikiData.profileImageUrl) {
        try {
          // 既存画像チェック
          const existingImage = await db.query.performerImages.findFirst({
            where: sql`${performerImages.performerId} = ${actress.id} AND ${performerImages.imageType} = 'profile'`,
          });

          if (!existingImage) {
            await db.insert(performerImages).values({
              performerId: actress.id,
              imageUrl: wikiData.profileImageUrl,
              imageType: 'profile',
              source: wikiData.source,
              isPrimary: true,
            });

            // performers.profile_image_url も更新（互換性）
            await db.update(performers)
              .set({ profileImageUrl: wikiData.profileImageUrl })
              .where(eq(performers.id, actress.id));

            imagesAdded++;
            console.log(`  ✓ Added profile image from ${wikiData.source}`);
          }
        } catch (error) {
          console.error(`    ❌ Error adding profile image:`, error);
        }
      }

      console.log(`  ✓ Added ${addedAliases} alias(es), ${wikiData.products.length} product(s) found`);
      successCount++;

      // Rate limiting（両方のWikiをクロールするため長めに）
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`  ❌ Error processing ${actress.name}:`, error);
      failCount++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total processed: ${successCount + failCount}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Aliases added: ${aliasesAdded}`);
  console.log(`Profile images added: ${imagesAdded}`);

  process.exit(0);
}

collectActressAliases().catch(console.error);
