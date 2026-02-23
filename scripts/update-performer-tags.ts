/**
 * 既存の演者にタグ情報を追加するスクリプト
 * minnano-av.comから特徴タグを収集
 *
 * Usage:
 *   npx tsx scripts/update-performer-tags.ts --limit=100 --mode=fill-gaps
 *
 * Options:
 *   --limit=N        処理件数上限 (デフォルト: 100)
 *   --mode=MODE      実行モード:
 *     fill-gaps      タグがない演者のみ (デフォルト)
 *     refresh-all    全演者を再スクレイプ
 *     stale-only     --stale-days以上古いタグを持つ演者を再スクレイプ
 *   --stale-days=N   stale-onlyモードで「古い」とみなす日数 (デフォルト: 90)
 */

import * as cheerio from 'cheerio';
import { getDb } from '../packages/crawlers/src/lib/db/index.js';
import { performers, performerExternalIds, tags, performerTags } from '../packages/crawlers/src/lib/db/schema.js';
import { eq, sql, and } from 'drizzle-orm';

const db = getDb();
const BASE_URL = 'https://www.minnano-av.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const DELAY_MS = 1500;
const MAX_RETRIES = 3;

type Mode = 'fill-gaps' | 'refresh-all' | 'stale-only';

async function fetchPage(url: string, retries = MAX_RETRIES): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        },
      });
      if (response.status === 429) {
        const backoffMs = 5000 * Math.pow(2, attempt - 1); // 5s, 10s, 20s
        console.log(`    Rate limited (429), retrying in ${backoffMs / 1000}s...`);
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    } catch (e: any) {
      if (attempt === retries) throw e;
      const backoffMs = 5000 * Math.pow(2, attempt - 1);
      console.log(`    Retry ${attempt}/${retries} in ${backoffMs / 1000}s: ${e.message}`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw new Error('Unreachable');
}

async function extractTags(html: string): Promise<string[]> {
  const $ = cheerio.load(html);
  const tagSet = new Set<string>();

  // tag_a_id形式のリンクからタグを抽出
  $('a[href*="tag_a_id="]').each((_, el) => {
    const tagText = $(el).text().trim();
    if (
      tagText &&
      tagText.length >= 2 &&
      tagText.length <= 20 &&
      !tagText.includes('一覧') &&
      !tagText.includes('評価')
    ) {
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
      // タグを取得または作成
      let tagRecord = await db.select().from(tags).where(eq(tags.name, tagName)).limit(1);

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

      // 演者-タグ関連を保存
      await db.insert(performerTags).values({ performerId, tagId, source: 'minnano-av' }).onConflictDoNothing();
      saved++;
    } catch (e) {
      // エラーは無視
    }
  }
  return saved;
}

async function deleteExistingMinnanoAvTags(performerId: number): Promise<number> {
  const result = await db.execute(sql`
    DELETE FROM performer_tags
    WHERE performer_id = ${performerId} AND source = 'minnano-av'
  `);
  return result.rowCount ?? 0;
}

function getPerformerQuery(mode: Mode, limit: number, staleDays: number) {
  if (mode === 'fill-gaps') {
    return sql`
      SELECT p.id, p.name, pe.external_id, pe.external_url
      FROM performers p
      INNER JOIN performer_external_ids pe ON pe.performer_id = p.id AND pe.provider = 'minnano-av'
      WHERE NOT EXISTS (
        SELECT 1 FROM performer_tags pt WHERE pt.performer_id = p.id
      )
      ORDER BY p.id DESC
      LIMIT ${limit}
    `;
  }

  if (mode === 'stale-only') {
    return sql`
      SELECT p.id, p.name, pe.external_id, pe.external_url
      FROM performers p
      INNER JOIN performer_external_ids pe ON pe.performer_id = p.id AND pe.provider = 'minnano-av'
      WHERE NOT EXISTS (
        SELECT 1 FROM performer_tags pt
        WHERE pt.performer_id = p.id
          AND pt.source = 'minnano-av'
          AND pt.created_at > NOW() - INTERVAL '1 day' * ${staleDays}
      )
      ORDER BY p.id DESC
      LIMIT ${limit}
    `;
  }

  // refresh-all
  return sql`
    SELECT p.id, p.name, pe.external_id, pe.external_url
    FROM performers p
    INNER JOIN performer_external_ids pe ON pe.performer_id = p.id AND pe.provider = 'minnano-av'
    ORDER BY p.id DESC
    LIMIT ${limit}
  `;
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const modeArg = args.find((a) => a.startsWith('--mode='));
  const staleDaysArg = args.find((a) => a.startsWith('--stale-days='));

  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100;
  const mode = (modeArg ? modeArg.split('=')[1] : 'fill-gaps') as Mode;
  const staleDays = staleDaysArg ? parseInt(staleDaysArg.split('=')[1], 10) : 90;

  if (!['fill-gaps', 'refresh-all', 'stale-only'].includes(mode)) {
    console.error(`Invalid mode: ${mode}. Use fill-gaps, refresh-all, or stale-only`);
    process.exit(1);
  }

  console.log('=== 演者タグ更新スクリプト ===\n');
  console.log(`Mode: ${mode}`);
  console.log(`Limit: ${limit}`);
  if (mode === 'stale-only') console.log(`Stale days: ${staleDays}`);

  console.log('Fetching performers...');
  const performersToUpdate = await db.execute(getPerformerQuery(mode, limit, staleDays));

  console.log(`Found ${performersToUpdate.rows.length} performers to process\n`);

  let processed = 0;
  let totalTags = 0;
  let deletedTags = 0;

  for (const row of performersToUpdate.rows as any[]) {
    try {
      const url = row.external_url || `${BASE_URL}/actress${row.external_id}.html`;
      console.log(`[${processed + 1}/${performersToUpdate.rows.length}] ${row.name}`);

      // refresh-all/stale-only: 既存のminnano-avタグを削除
      if (mode === 'refresh-all' || mode === 'stale-only') {
        const deleted = await deleteExistingMinnanoAvTags(row.id);
        if (deleted > 0) {
          console.log(`  Removed ${deleted} old tags`);
          deletedTags += deleted;
        }
      }

      const html = await fetchPage(url);
      const tagList = await extractTags(html);

      if (tagList.length > 0) {
        const saved = await savePerformerTags(row.id, tagList);
        console.log(`  ${saved} tags: ${tagList.slice(0, 5).join(', ')}${tagList.length > 5 ? '...' : ''}`);
        totalTags += saved;
      } else {
        console.log(`  - no tags found`);
      }

      processed++;
      await new Promise((r) => setTimeout(r, DELAY_MS));
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`Mode: ${mode}`);
  console.log(`Processed: ${processed}, Total tags added: ${totalTags}`);
  if (deletedTags > 0) console.log(`Tags removed (before refresh): ${deletedTags}`);
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
