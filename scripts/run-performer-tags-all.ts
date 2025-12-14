/**
 * 全演者のタグを網羅するまで繰り返し実行するスクリプト
 * minnano-av.comから特徴タグを収集
 */

import * as cheerio from 'cheerio';
import { getDb } from '../packages/crawlers/src/lib/db/index.js';
import { performers, performerExternalIds, tags, performerTags } from '../packages/crawlers/src/lib/db/schema.js';
import { eq, sql } from 'drizzle-orm';

const db = getDb();
const BASE_URL = 'https://www.minnano-av.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const DELAY_MS = 1500;
const BATCH_SIZE = 500;

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function extractTags(html: string): Promise<string[]> {
  const $ = cheerio.load(html);
  const tagSet = new Set<string>();

  // tag_a_id形式のリンクからタグを抽出
  $('a[href*="tag_a_id="]').each((_, el) => {
    const tagText = $(el).text().trim();
    if (tagText && tagText.length >= 2 && tagText.length <= 20 &&
        !tagText.includes('一覧') && !tagText.includes('評価')) {
      tagSet.add(tagText);
    }
  });

  // カップサイズタグ
  $('a[href*="cup="]').each((_, el) => {
    const cupText = $(el).text().trim();
    if (cupText && cupText.includes('カップ')) {
      tagSet.add(cupText);
    }
  });

  return Array.from(tagSet);
}

async function savePerformerTags(performerId: number, tagNames: string[]): Promise<number> {
  let saved = 0;
  for (const tagName of tagNames) {
    try {
      let tagRecord = await db
        .select()
        .from(tags)
        .where(eq(tags.name, tagName))
        .limit(1);

      let tagId: number;
      if (tagRecord.length === 0) {
        const [newTag] = await db
          .insert(tags)
          .values({ name: tagName, category: 'performer_trait' })
          .returning({ id: tags.id });
        tagId = newTag.id;
      } else {
        tagId = tagRecord[0].id;
      }

      await db
        .insert(performerTags)
        .values({ performerId, tagId, source: 'minnano-av' })
        .onConflictDoNothing();
      saved++;
    } catch (e) {
      // エラーは無視
    }
  }
  return saved;
}

async function getPerformersWithoutTags(limit: number): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT p.id, p.name, pe.external_id, pe.external_url
    FROM performers p
    INNER JOIN performer_external_ids pe ON pe.performer_id = p.id AND pe.provider = 'minnano-av'
    WHERE NOT EXISTS (
      SELECT 1 FROM performer_tags pt WHERE pt.performer_id = p.id
    )
    ORDER BY p.id DESC
    LIMIT ${limit}
  `);
  return result.rows as any[];
}

async function main() {
  console.log('=== 演者タグ一括更新スクリプト ===\n');
  console.log(`バッチサイズ: ${BATCH_SIZE}`);
  console.log(`遅延: ${DELAY_MS}ms\n`);

  let batchNumber = 0;
  let totalProcessed = 0;
  let totalTags = 0;

  while (true) {
    batchNumber++;
    console.log(`\n===== バッチ ${batchNumber} 開始 =====`);

    const performersToUpdate = await getPerformersWithoutTags(BATCH_SIZE);

    if (performersToUpdate.length === 0) {
      console.log('\n✅ 全演者のタグ更新が完了しました！');
      break;
    }

    console.log(`タグなし演者: ${performersToUpdate.length}人\n`);

    let batchProcessed = 0;
    let batchTags = 0;

    for (const row of performersToUpdate) {
      try {
        const url = row.external_url || `${BASE_URL}/actress${row.external_id}.html`;
        console.log(`[${batchProcessed + 1}/${performersToUpdate.length}] ${row.name}`);

        const html = await fetchPage(url);
        const tagList = await extractTags(html);

        if (tagList.length > 0) {
          const saved = await savePerformerTags(row.id, tagList);
          console.log(`  ✅ ${saved} tags: ${tagList.slice(0, 5).join(', ')}${tagList.length > 5 ? '...' : ''}`);
          batchTags += saved;
        } else {
          console.log(`  - no tags found`);
        }

        batchProcessed++;
        await new Promise(r => setTimeout(r, DELAY_MS));
      } catch (e: any) {
        console.log(`  ✗ Error: ${e.message}`);
      }
    }

    totalProcessed += batchProcessed;
    totalTags += batchTags;

    console.log(`\n--- バッチ ${batchNumber} 完了 ---`);
    console.log(`このバッチ: ${batchProcessed}人処理, ${batchTags}タグ追加`);
    console.log(`累計: ${totalProcessed}人処理, ${totalTags}タグ追加`);
  }

  console.log('\n=== 最終結果 ===');
  console.log(`総処理演者数: ${totalProcessed}`);
  console.log(`総追加タグ数: ${totalTags}`);
  console.log(`バッチ数: ${batchNumber}`);
}

main()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  });
