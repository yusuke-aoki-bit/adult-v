/**
 * gravurefit.com (AV:fit) 女優情報クローラー
 * 女優のプロフィール情報（スリーサイズ、身長、生年月日等）を取得
 */

import * as cheerio from 'cheerio';
import { db } from '../../lib/db';
import { performers, performerAliases, performerExternalIds } from '../../lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { execSync } from 'child_process';

const BASE_URL = 'https://www.gravurefit.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DELAY_MS = 2000;

interface PerformerProfile {
  name: string;
  nameKana: string | null;
  aliases: string[];
  nameEn: string | null;
  height: number | null;
  bust: number | null;
  waist: number | null;
  hip: number | null;
  cup: string | null;
  birthday: string | null; // YYYY-MM-DD format
  bloodType: string | null;
  birthplace: string | null;
  debutDate: string | null; // YYYY-MM format
  twitterId: string | null;
  instagramId: string | null;
  sourceUrl: string;
  profileSlug: string;
}

function fetchPage(url: string): string {
  // curlコマンドを使用してCloudflare等のbot対策を回避
  const curlCommand = `curl -s -A "${USER_AGENT}" -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8" -H "Accept-Language: ja,en-US;q=0.7,en;q=0.3" -H "Referer: https://www.gravurefit.com/" "${url}"`;

  try {
    const result = execSync(curlCommand, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: 30000,
    });
    return result;
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error}`);
  }
}

function parseThreeSize(text: string): { bust: number | null; waist: number | null; hip: number | null; cup: string | null } {
  // "163cm - B87(E) - W60 - H84" のような形式をパース
  const result = { bust: null as number | null, waist: null as number | null, hip: null as number | null, cup: null as string | null };

  // バスト
  const bustMatch = text.match(/B(\d+)/);
  if (bustMatch) {
    result.bust = parseInt(bustMatch[1], 10);
  }

  // カップサイズ
  const cupMatch = text.match(/\(([A-Z]+)\)/);
  if (cupMatch) {
    result.cup = cupMatch[1];
  }

  // ウエスト
  const waistMatch = text.match(/W(\d+)/);
  if (waistMatch) {
    result.waist = parseInt(waistMatch[1], 10);
  }

  // ヒップ
  const hipMatch = text.match(/H(\d+)/);
  if (hipMatch) {
    result.hip = parseInt(hipMatch[1], 10);
  }

  return result;
}

function parseHeight(text: string): number | null {
  const match = text.match(/(\d+)cm/);
  return match ? parseInt(match[1], 10) : null;
}

function parseBirthday(text: string): string | null {
  // "35歳（1990年8月25日生まれ）" のような形式
  const match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

function parseDebutDate(text: string): string | null {
  // "2011年1月" のような形式
  const match = text.match(/(\d{4})年(\d{1,2})月/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    return `${year}-${month}`;
  }
  return null;
}

async function parseProfilePage(html: string, url: string): Promise<PerformerProfile | null> {
  const $ = cheerio.load(html);

  // テーブルからプロフィール情報を取得
  const profileTable = $('table').first();
  if (profileTable.length === 0) {
    console.log('Profile table not found');
    return null;
  }

  const profile: PerformerProfile = {
    name: '',
    nameKana: null,
    aliases: [],
    nameEn: null,
    height: null,
    bust: null,
    waist: null,
    hip: null,
    cup: null,
    birthday: null,
    bloodType: null,
    birthplace: null,
    debutDate: null,
    twitterId: null,
    instagramId: null,
    sourceUrl: url,
    profileSlug: url.replace(BASE_URL + '/profile/', '').replace(/\/$/, ''),
  };

  // テーブルの行を走査
  profileTable.find('tr').each((_, row) => {
    const th = $(row).find('th').text().trim();
    const td = $(row).find('td').text().trim();

    switch (th) {
      case '女優名':
        profile.name = td;
        break;
      case 'ふりがな':
        profile.nameKana = td || null;
        break;
      case '他の活動名':
        if (td) {
          profile.aliases = td.split(/[、,]/).map(s => s.trim()).filter(s => s);
        }
        break;
      case 'Name':
        profile.nameEn = td || null;
        break;
      case '身長・スリーサイズ': {
        profile.height = parseHeight(td);
        const sizes = parseThreeSize(td);
        profile.bust = sizes.bust;
        profile.waist = sizes.waist;
        profile.hip = sizes.hip;
        profile.cup = sizes.cup;
        break;
      }
      case '年齢・生年月日':
        profile.birthday = parseBirthday(td);
        break;
      case 'デビュー':
        profile.debutDate = parseDebutDate(td);
        break;
      case '血液型':
        profile.bloodType = td.replace('型', '') || null;
        break;
      case '出身':
        profile.birthplace = td || null;
        break;
      case 'X (Twitter)':
        profile.twitterId = td.replace('@', '') || null;
        break;
      case 'instagram':
        profile.instagramId = td.replace('@', '') || null;
        break;
    }
  });

  if (!profile.name) {
    console.log('Could not extract performer name');
    return null;
  }

  return profile;
}

function getPerformerLinks(listPageUrl: string): string[] {
  const html = fetchPage(listPageUrl);
  const $ = cheerio.load(html);

  const links: string[] = [];

  // /profile/ へのリンクを抽出
  $('a[href*="/profile/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.includes('/profile/shinjin/')) {
      // 相対URLを絶対URLに変換
      const fullUrl = href.startsWith('http') ? href : BASE_URL + href;
      if (!links.includes(fullUrl)) {
        links.push(fullUrl);
      }
    }
  });

  return links;
}

async function savePerformerToDb(profile: PerformerProfile): Promise<void> {
  // 既存のperformerを検索（名前で）
  const existing = await db
    .select()
    .from(performers)
    .where(eq(performers.name, profile.name))
    .limit(1);

  // デビュー年を抽出
  let debutYear: number | null = null;
  if (profile.debutDate) {
    const match = profile.debutDate.match(/^(\d{4})/);
    if (match) {
      debutYear = parseInt(match[1], 10);
    }
  }

  if (existing.length > 0) {
    // 既存のperformerを更新（既存のデータがnullの場合のみ更新）
    const performer = existing[0];
    const updates: Record<string, unknown> = {};

    if (!performer.nameKana && profile.nameKana) updates.nameKana = profile.nameKana;
    if (!performer.nameEn && profile.nameEn) updates.nameEn = profile.nameEn;
    if (!performer.height && profile.height) updates.height = profile.height;
    if (!performer.bust && profile.bust) updates.bust = profile.bust;
    if (!performer.waist && profile.waist) updates.waist = profile.waist;
    if (!performer.hip && profile.hip) updates.hip = profile.hip;
    if (!performer.cup && profile.cup) updates.cup = profile.cup;
    if (!performer.birthday && profile.birthday) updates.birthday = profile.birthday;
    if (!performer.bloodType && profile.bloodType) updates.bloodType = profile.bloodType;
    if (!performer.birthplace && profile.birthplace) updates.birthplace = profile.birthplace;
    if (!performer.twitterId && profile.twitterId) updates.twitterId = profile.twitterId;
    if (!performer.instagramId && profile.instagramId) updates.instagramId = profile.instagramId;
    if (!performer.debutYear && debutYear) updates.debutYear = debutYear;

    if (Object.keys(updates).length > 0) {
      await db
        .update(performers)
        .set(updates)
        .where(eq(performers.id, performer.id));
      console.log(`  Updated: ${profile.name} (${Object.keys(updates).join(', ')})`);
    } else {
      console.log(`  Skipped (no new data): ${profile.name}`);
    }

    // 別名を追加
    for (const alias of profile.aliases) {
      await db
        .insert(performerAliases)
        .values({
          performerId: performer.id,
          aliasName: alias,
          source: 'gravurefit',
        })
        .onConflictDoNothing();
    }

    // 外部IDを保存
    await db
      .insert(performerExternalIds)
      .values({
        performerId: performer.id,
        provider: 'gravurefit',
        externalId: profile.profileSlug,
        profileUrl: profile.sourceUrl,
      })
      .onConflictDoNothing();
  } else {
    // 新規performer作成
    const [newPerformer] = await db
      .insert(performers)
      .values({
        name: profile.name,
        nameKana: profile.nameKana,
        nameEn: profile.nameEn,
        height: profile.height,
        bust: profile.bust,
        waist: profile.waist,
        hip: profile.hip,
        cup: profile.cup,
        birthday: profile.birthday,
        bloodType: profile.bloodType,
        birthplace: profile.birthplace,
        twitterId: profile.twitterId,
        instagramId: profile.instagramId,
        debutYear: debutYear,
      })
      .returning({ id: performers.id });

    console.log(`  Created: ${profile.name}`);

    // 別名を追加
    for (const alias of profile.aliases) {
      await db
        .insert(performerAliases)
        .values({
          performerId: newPerformer.id,
          aliasName: alias,
          source: 'gravurefit',
        })
        .onConflictDoNothing();
    }

    // 外部IDを保存
    await db
      .insert(performerExternalIds)
      .values({
        performerId: newPerformer.id,
        provider: 'gravurefit',
        externalId: profile.profileSlug,
        profileUrl: profile.sourceUrl,
      })
      .onConflictDoNothing();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

  console.log('=== gravurefit.com 女優情報クローラー ===\n');
  console.log(`Limit: ${limit}`);

  // 女優一覧ページからリンクを取得
  console.log('\nFetching performer list...');
  const listUrl = `${BASE_URL}/women/list/`;
  const performerUrls = await getPerformerLinks(listUrl);

  console.log(`Found ${performerUrls.length} performer links`);

  // 既にクロール済みのperformerをスキップ
  const crawledSlugs = await db
    .select({ externalId: performerExternalIds.externalId })
    .from(performerExternalIds)
    .where(eq(performerExternalIds.provider, 'gravurefit'));

  const crawledSet = new Set(crawledSlugs.map(r => r.externalId));

  const urlsToCrawl = performerUrls
    .filter(url => {
      const slug = url.replace(BASE_URL + '/profile/', '').replace(/\/$/, '');
      return !crawledSet.has(slug);
    })
    .slice(0, limit);

  console.log(`URLs to crawl: ${urlsToCrawl.length} (skipping ${performerUrls.length - urlsToCrawl.length} already crawled)`);

  let crawled = 0;
  let errors = 0;

  for (const url of urlsToCrawl) {
    try {
      console.log(`\nCrawling: ${url}`);
      const html = await fetchPage(url);
      const profile = await parseProfilePage(html, url);

      if (profile) {
        await savePerformerToDb(profile);
        crawled++;
      } else {
        console.log(`  Failed to parse profile`);
        errors++;
      }

      // レート制限
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    } catch (error) {
      console.error(`  Error: ${error}`);
      errors++;
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`Crawled: ${crawled}, Errors: ${errors}`);

  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
