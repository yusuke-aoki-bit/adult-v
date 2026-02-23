/**
 * minnano-av.com AV女優リストクローラー
 * 24,000件以上の女優データを収集
 * 名前、読み仮名、別名、作品数等を取得
 */

import * as cheerio from 'cheerio';
import { db } from './lib/db';
import { performers, performerAliases, performerExternalIds } from './lib/db/schema';
import { eq, sql } from 'drizzle-orm';

const BASE_URL = 'https://www.minnano-av.com';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DELAY_MS = 2000;

interface MinnanoPerformer {
  name: string;
  nameKana: string | null;
  actressId: string; // actress123456.html のID
  profileUrl: string;
  imageUrl: string | null;
  workCount: number | null;
}

interface PerformerDetail {
  name: string;
  nameKana: string | null;
  aliases: string[];
  birthday: string | null;
  bloodType: string | null;
  height: number | null;
  bust: number | null;
  waist: number | null;
  hip: number | null;
  cup: string | null;
  birthplace: string | null;
  hobby: string | null;
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

/**
 * 女優リストページから女優情報を取得
 */
async function fetchActressList(page: number): Promise<MinnanoPerformer[]> {
  const url = `${BASE_URL}/actress_list.php?page=${page}`;
  console.log(`  Fetching: ${url}`);

  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const performers: MinnanoPerformer[] = [];

  // 女優リストの各アイテムを取得
  // URLフォーマット: actress291335.html?綾崎潤
  $('a[href^="actress"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    // クエリパラメータ付きのURLにも対応: actress123456.html または actress123456.html?名前
    const match = href.match(/^actress(\d+)\.html/);

    if (match) {
      const actressId = match[1];
      const linkText = $(el).text().trim();

      // リンクテキストまたはクエリパラメータから名前を取得
      let name = linkText;

      // クエリパラメータから名前を取得（より信頼性が高い）
      const queryMatch = href.match(/\?(.+)$/);
      if (queryMatch) {
        try {
          name = decodeURIComponent(queryMatch[1]);
        } catch {
          // デコード失敗時はリンクテキストを使用
        }
      }

      // 名前のバリデーション
      if (
        name &&
        name.length >= 2 &&
        name.length <= 30 &&
        /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\sA-Za-z・ー]+$/.test(name) &&
        !name.includes('評価') &&
        !name.includes('女優') &&
        !name.includes('一覧')
      ) {
        // 重複チェック
        if (!performers.find((p) => p.actressId === actressId)) {
          performers.push({
            name,
            nameKana: null,
            actressId,
            profileUrl: `${BASE_URL}/actress${actressId}.html`,
            imageUrl: null,
            workCount: null,
          });
        }
      }
    }
  });

  return performers;
}

/**
 * 女優詳細ページから詳細情報を取得
 */
async function fetchActressDetail(url: string): Promise<PerformerDetail | null> {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const detail: PerformerDetail = {
      name: '',
      nameKana: null,
      aliases: [],
      birthday: null,
      bloodType: null,
      height: null,
      bust: null,
      waist: null,
      hip: null,
      cup: null,
      birthplace: null,
      hobby: null,
    };

    // 名前を取得
    const nameEl = $('h1').first();
    detail.name = nameEl
      .text()
      .trim()
      .replace(/\s*のAV作品.*/, '');

    // プロフィールテーブルから情報を抽出
    $('table tr, .profile-table tr').each((_, row) => {
      const th = $(row).find('th, td:first-child').text().trim();
      const td = $(row).find('td:last-child').text().trim();

      if (th.includes('よみがな') || th.includes('読み')) {
        detail.nameKana = td || null;
      } else if (th.includes('別名') || th.includes('旧名義')) {
        if (td) {
          detail.aliases = td
            .split(/[、,・]/)
            .map((s) => s.trim())
            .filter((s) => s.length >= 2);
        }
      } else if (th.includes('生年月日') || th.includes('誕生日')) {
        // 1990年1月1日 形式をパース
        const match = td.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (match) {
          detail.birthday = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        }
      } else if (th.includes('血液型')) {
        const match = td.match(/([ABO]|AB)/);
        detail.bloodType = match ? match[1] : null;
      } else if (th.includes('身長')) {
        const match = td.match(/(\d+)/);
        detail.height = match ? parseInt(match[1], 10) : null;
      } else if (th.includes('スリーサイズ') || th.includes('3サイズ')) {
        // B90 W60 H88 形式をパース
        const bustMatch = td.match(/B(\d+)/);
        const waistMatch = td.match(/W(\d+)/);
        const hipMatch = td.match(/H(\d+)/);
        detail.bust = bustMatch ? parseInt(bustMatch[1], 10) : null;
        detail.waist = waistMatch ? parseInt(waistMatch[1], 10) : null;
        detail.hip = hipMatch ? parseInt(hipMatch[1], 10) : null;

        // カップサイズ
        const cupMatch = td.match(/\(([A-Z]+)\)/);
        detail.cup = cupMatch ? cupMatch[1] : null;
      } else if (th.includes('カップ')) {
        const match = td.match(/([A-Z]+)/);
        detail.cup = match ? match[1] : null;
      } else if (th.includes('出身')) {
        detail.birthplace = td || null;
      } else if (th.includes('趣味')) {
        detail.hobby = td || null;
      }
    });

    return detail.name ? detail : null;
  } catch (error) {
    console.error(`  Error fetching detail: ${error}`);
    return null;
  }
}

/**
 * DBに保存
 */
async function savePerformerToDb(performer: MinnanoPerformer, detail: PerformerDetail | null): Promise<void> {
  const name = detail?.name || performer.name;

  // 既存のperformerを検索（名前で）
  const existing = await db.select().from(performers).where(eq(performers.name, name)).limit(1);

  if (existing.length > 0) {
    // 既存のperformerを更新（既存のデータがnullの場合のみ更新）
    const existingPerformer = existing[0];
    const updates: Record<string, unknown> = {};

    if (detail) {
      if (!existingPerformer.nameKana && detail.nameKana) updates.nameKana = detail.nameKana;
      if (!existingPerformer.height && detail.height) updates.height = detail.height;
      if (!existingPerformer.bust && detail.bust) updates.bust = detail.bust;
      if (!existingPerformer.waist && detail.waist) updates.waist = detail.waist;
      if (!existingPerformer.hip && detail.hip) updates.hip = detail.hip;
      if (!existingPerformer.cup && detail.cup) updates.cup = detail.cup;
      if (!existingPerformer.birthday && detail.birthday) updates.birthday = detail.birthday;
      if (!existingPerformer.bloodType && detail.bloodType) updates.bloodType = detail.bloodType;
      if (!existingPerformer.birthplace && detail.birthplace) updates.birthplace = detail.birthplace;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(performers).set(updates).where(eq(performers.id, existingPerformer.id));
      console.log(`  Updated: ${name} (${Object.keys(updates).join(', ')})`);
    } else {
      console.log(`  Skipped (no new data): ${name}`);
    }

    // 別名を追加
    if (detail?.aliases) {
      for (const alias of detail.aliases) {
        await db
          .insert(performerAliases)
          .values({
            performerId: existingPerformer.id,
            aliasName: alias,
            source: 'minnano-av',
          })
          .onConflictDoNothing();
      }
    }

    // 外部IDを保存
    await db
      .insert(performerExternalIds)
      .values({
        performerId: existingPerformer.id,
        provider: 'minnano-av',
        externalId: performer.actressId,
        profileUrl: performer.profileUrl,
      })
      .onConflictDoNothing();
  } else {
    // 新規performer作成
    const [newPerformer] = await db
      .insert(performers)
      .values({
        name,
        nameKana: detail?.nameKana,
        height: detail?.height,
        bust: detail?.bust,
        waist: detail?.waist,
        hip: detail?.hip,
        cup: detail?.cup,
        birthday: detail?.birthday,
        bloodType: detail?.bloodType,
        birthplace: detail?.birthplace,
      })
      .returning({ id: performers.id });

    console.log(`  Created: ${name}`);

    // 別名を追加
    if (detail?.aliases) {
      for (const alias of detail.aliases) {
        await db
          .insert(performerAliases)
          .values({
            performerId: newPerformer.id,
            aliasName: alias,
            source: 'minnano-av',
          })
          .onConflictDoNothing();
      }
    }

    // 外部IDを保存
    await db
      .insert(performerExternalIds)
      .values({
        performerId: newPerformer.id,
        provider: 'minnano-av',
        externalId: performer.actressId,
        profileUrl: performer.profileUrl,
      })
      .onConflictDoNothing();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;
  const startPageArg = args.find((a) => a.startsWith('--start-page='));
  const startPage = startPageArg ? parseInt(startPageArg.split('=')[1], 10) : 1;
  const fetchDetail = args.includes('--detail');

  console.log('=== minnano-av.com 女優クローラー ===\n');
  console.log(`Dry run: ${dryRun}`);
  console.log(`Limit: ${limit}`);
  console.log(`Start page: ${startPage}`);
  console.log(`Fetch detail: ${fetchDetail}`);

  // 既にクロール済みのactressIdを取得
  const crawledIds = await db
    .select({ externalId: performerExternalIds.externalId })
    .from(performerExternalIds)
    .where(eq(performerExternalIds.provider, 'minnano-av'));

  const crawledSet = new Set(crawledIds.map((r) => r.externalId));
  console.log(`Already crawled: ${crawledSet.size}`);

  const allPerformers: MinnanoPerformer[] = [];
  let page = startPage;
  let emptyPages = 0;

  // ページを順次取得
  while (allPerformers.length < limit && emptyPages < 3) {
    try {
      const performers = await fetchActressList(page);

      if (performers.length === 0) {
        emptyPages++;
        console.log(`  Page ${page}: No performers found`);
      } else {
        emptyPages = 0;
        // 未クロールのperformerのみ追加
        const newPerformers = performers.filter((p) => !crawledSet.has(p.actressId));
        console.log(`  Page ${page}: Found ${performers.length} performers (${newPerformers.length} new)`);
        allPerformers.push(...newPerformers);
      }

      page++;
      await new Promise((r) => setTimeout(r, 1000));
    } catch (error) {
      console.error(`  Error on page ${page}: ${error}`);
      emptyPages++;
    }
  }

  console.log(`\nTotal new performers to process: ${allPerformers.length}`);

  if (allPerformers.length === 0) {
    console.log('No new performers to crawl.');
    process.exit(0);
  }

  // 制限を適用
  const performersToProcess = allPerformers.slice(0, limit);

  if (dryRun) {
    console.log('\n=== Dry run results ===');
    for (const p of performersToProcess) {
      console.log(`  ${p.name} (ID: ${p.actressId})`);
    }
    process.exit(0);
  }

  let processed = 0;
  let errors = 0;

  for (const performer of performersToProcess) {
    try {
      console.log(`\nProcessing: ${performer.name} (${performer.actressId})`);

      let detail: PerformerDetail | null = null;

      if (fetchDetail) {
        detail = await fetchActressDetail(performer.profileUrl);
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }

      await savePerformerToDb(performer, detail);
      processed++;
    } catch (error) {
      console.error(`  Error: ${error}`);
      errors++;
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`Processed: ${processed}, Errors: ${errors}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
