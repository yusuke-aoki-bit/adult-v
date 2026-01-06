/**
 * SOKMIL Actor API クローラー
 *
 * 機能:
 * - SOKMIL Actor APIから出演者データを取得
 * - 身長、スリーサイズ、カップ数、誕生日などのプロフィール情報を取得
 * - performersテーブルを更新
 *
 * 使い方:
 * npx tsx scripts/crawlers/crawl-sokmil-actors.ts [--limit 100] [--offset 0] [--initial あ]
 */

import { getDb } from '../../lib/db';
import { performers } from '../../lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { RateLimiter, crawlerLog } from '../../lib/crawler';

const SOKMIL_API_KEY = process.env['SOKMIL_API_KEY'] || '52c5a783bce2839f841b887f8ab3d90a';
const SOKMIL_AFFILIATE_ID = '47418-001';
const SOKMIL_API_BASE = 'https://sokmil-ad.com/api/v1';

/**
 * SOKMIL Actor API レスポンスの型定義
 */
interface SokmilActorApiResponse {
  result: {
    status: string;
    result_count: string;
    total_count: string;
    first_position: string;
    actor: SokmilActorData[];
  };
}

interface SokmilActorData {
  id: string;
  name: string;
  ruby?: string;
  birthday?: string;
  blood?: string;
  bust?: string;
  waist?: string;
  hip?: string;
  height?: string;
  cup?: string;
  hobby?: string;
  skill?: string;
  URL?: string;
  imageURL?: {
    list?: string;
    small?: string;
    large?: string;
  };
  iteminfo?: {
    genre?: Array<{ id: string; name: string }>;
  };
}

interface CrawlStats {
  totalFetched: number;
  newPerformers: number;
  updatedPerformers: number;
  skipped: number;
  errors: number;
}

/**
 * Sokmil Actor APIを直接呼び出す
 */
async function fetchSokmilActors(params: {
  hits?: number;
  offset?: number;
  initial?: string;
  keyword?: string;
  gender?: 'f' | 'm';
  category?: 'av' | 'idol';
  sort?: 'price' | '-price' | 'date';
}): Promise<SokmilActorApiResponse> {
  const searchParams = new URLSearchParams({
    affiliate_id: SOKMIL_AFFILIATE_ID,
    api_key: SOKMIL_API_KEY,
    output: 'json',
    gender: params.gender || 'f',
    category: params.category || 'av',
  });

  if (params.hits) searchParams.set('hits', String(params.hits));
  if (params.offset) searchParams.set('offset', String(params.offset));
  if (params.initial) searchParams.set('initial', params.initial);
  if (params.keyword) searchParams.set('keyword', params.keyword);
  if (params.sort) searchParams.set('sort', params.sort);

  const url = `${SOKMIL_API_BASE}/Actor?${searchParams.toString()}`;
  crawlerLog.info(`Fetching: ${url}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Sokmil-Actor-Crawler/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response['status']} ${response.statusText}`);
  }

  return response.json();
}

/**
 * 日付文字列をパース (yyyymmdd形式)
 */
function parseBirthday(birthday: string | undefined): Date | null {
  if (!birthday || birthday.length !== 8) return null;

  const year = parseInt(birthday.substring(0, 4), 10);
  const month = parseInt(birthday.substring(4, 6), 10) - 1;
  const day = parseInt(birthday.substring(6, 8), 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;

  return date;
}

/**
 * 数値文字列をパース
 */
function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const offsetArg = args.find(arg => arg.startsWith('--offset='));
  const initialArg = args.find(arg => arg.startsWith('--initial='));

  const limit = limitArg ? parseInt(limitArg.split('=')[1] ?? '100', 10) : 100;
  const startOffset = offsetArg ? parseInt(offsetArg.split('=')[1] ?? '1', 10) : 1;
  const initial = initialArg ? initialArg.split('=')[1] : undefined;

  console.log('========================================');
  console.log('=== SOKMIL Actor API クローラー ===');
  console.log('========================================');
  console.log(`取得件数: ${limit}`);
  console.log(`開始位置: ${startOffset}`);
  if (initial) console.log(`イニシャル: ${initial}`);
  console.log('========================================\n');

  const db = getDb();
  const rateLimiter = new RateLimiter({ minDelayMs: 1500, addJitter: true, jitterRange: 500 });

  const stats: CrawlStats = {
    totalFetched: 0,
    newPerformers: 0,
    updatedPerformers: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    const pageSize = Math.min(limit, 100);
    let offset = startOffset;
    let totalCount = 0;
    let fetched = 0;

    // ページネーションループ
    while (fetched < limit) {
      await rateLimiter.wait();

      try {
        const response = await fetchSokmilActors({
          hits: pageSize,
          offset,
          ...(initial && { initial }),
          gender: 'f',
          category: 'av',
        });

        if (response.result['status'] !== '200') {
          crawlerLog.error(`API エラー: status=${response.result['status']}`);
          break;
        }

        const actors = response.result.actor || [];
        totalCount = parseInt(response.result.total_count || '0', 10);

        if (actors.length === 0) {
          crawlerLog.info('これ以上のデータはありません');
          break;
        }

        crawlerLog.info(`取得: ${actors.length}件 (累計: ${fetched + actors.length}/${totalCount}件)`);

        // 各出演者を処理
        for (const actor of actors) {
          try {
            stats.totalFetched++;

            // 名前が空の場合はスキップ
            if (!actor.name || actor.name.trim() === '') {
              stats.skipped++;
              continue;
            }

            // 既存のperformerを検索（名前で完全一致）
            const existingPerformer = await db
              .select()
              .from(performers)
              .where(eq(performers['name'], actor.name.trim()))
              .limit(1);

            // プロフィールデータを準備
            const birthdayDate = parseBirthday(actor.birthday);
            const profileData = {
              nameKana: actor.ruby || null,
              height: parseNumber(actor.height),
              bust: parseNumber(actor.bust),
              waist: parseNumber(actor.waist),
              hip: parseNumber(actor.hip),
              cup: actor.cup?.toUpperCase() || null,
              bloodType: actor.blood || null,
              birthday: birthdayDate ? birthdayDate.toISOString().split('T')[0] : null,
              hobbies: actor.hobby || null,
              profileImageUrl: actor.imageURL?.large || actor.imageURL?.small || null,
            };

            if (existingPerformer.length > 0) {
              // 既存のperformerを更新（プロフィール情報がnullの場合のみ更新）
              const existing = existingPerformer[0]!;
              const updateData: Record<string, unknown> = {};

              // null または空の場合のみ更新
              if (!existing.nameKana && profileData.nameKana) updateData['nameKana'] = profileData.nameKana;
              if (!existing.height && profileData.height) updateData['height'] = profileData.height;
              if (!existing.bust && profileData.bust) updateData['bust'] = profileData.bust;
              if (!existing.waist && profileData.waist) updateData['waist'] = profileData.waist;
              if (!existing.hip && profileData.hip) updateData['hip'] = profileData.hip;
              if (!existing.cup && profileData.cup) updateData['cup'] = profileData.cup;
              if (!existing.bloodType && profileData.bloodType) updateData['bloodType'] = profileData.bloodType;
              if (!existing.birthday && profileData.birthday) updateData['birthday'] = profileData.birthday;
              if (!existing.profileImageUrl && profileData.profileImageUrl) updateData['profileImageUrl'] = profileData.profileImageUrl;

              if (Object.keys(updateData).length > 0) {
                await db
                  .update(performers)
                  .set(updateData)
                  .where(eq(performers['id'], existing.id));
                stats.updatedPerformers++;
                crawlerLog.info(`更新: ${actor.name} (ID: ${existing.id})`);
              } else {
                stats.skipped++;
              }
            } else {
              // 新規performerを作成
              await db['insert'](performers).values({
                name: actor.name.trim(),
                ...profileData,
                createdAt: new Date(),
              });
              stats.newPerformers++;
              crawlerLog.info(`新規作成: ${actor.name}`);
            }
          } catch (err) {
            stats.errors++;
            crawlerLog.error(`処理エラー: ${actor.name}`, err);
          }
        }

        fetched += actors.length;
        offset += actors.length;

        // 全件取得完了チェック
        if (offset >= totalCount) {
          crawlerLog.info('全件取得完了');
          break;
        }

      } catch (err) {
        crawlerLog.error('API呼び出しエラー', err);
        stats.errors++;
        // リトライのため少し待つ
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

  } catch (err) {
    crawlerLog.error('致命的エラー', err);
  }

  // 統計を出力
  console.log('\n========================================');
  console.log('=== 処理結果 ===');
  console.log('========================================');
  console.log(`取得件数: ${stats.totalFetched}`);
  console.log(`新規作成: ${stats.newPerformers}`);
  console.log(`更新: ${stats.updatedPerformers}`);
  console.log(`スキップ: ${stats.skipped}`);
  console.log(`エラー: ${stats.errors}`);
  console.log('========================================');
}

// メイン実行
main().catch(console.error);
