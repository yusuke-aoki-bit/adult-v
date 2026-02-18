/**
 * 演者プロフィール自動補充 API ハンドラー
 *
 * SOKMIL Actor API を活用して演者の身体情報・誕生日・画像を補充
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest, unauthorizedResponse } from '../lib/cron-auth';
import type { SQL } from 'drizzle-orm';

export interface BackfillPerformerProfilesDeps {
  getDb: () => {
    execute: (sql: SQL) => Promise<{ rows: unknown[] }>;
  };
  sql: typeof import('drizzle-orm').sql;
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
  imageURL?: {
    list?: string;
    small?: string;
    large?: string;
  };
}

interface SokmilActorApiResponse {
  result: {
    status: string;
    result_count: string;
    total_count: string;
    actor: SokmilActorData[];
  };
}

interface BackfillStats {
  performersChecked: number;
  profilesUpdated: number;
  imagesUpdated: number;
  heightUpdated: number;
  birthdayUpdated: number;
  errors: number;
}

const SOKMIL_API_KEY = process.env['SOKMIL_API_KEY'] || '52c5a783bce2839f841b887f8ab3d90a';
const SOKMIL_AFFILIATE_ID = '47418-001';
const SOKMIL_API_BASE = 'https://sokmil-ad.com/api/v1';

async function fetchSokmilActorByName(name: string): Promise<SokmilActorData | null> {
  try {
    const params = new URLSearchParams({
      affiliate_id: SOKMIL_AFFILIATE_ID,
      api_key: SOKMIL_API_KEY,
      output: 'json',
      gender: 'f',
      category: 'av',
      keyword: name,
      hits: '5',
    });

    const url = `${SOKMIL_API_BASE}/Actor?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'ProfileBackfill/1.0',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: SokmilActorApiResponse = await response.json();

    if (data.result?.actor?.length > 0) {
      // 完全一致を優先、なければ部分一致
      const exactMatch = data.result.actor.find((a) => a.name === name);
      return exactMatch || data.result.actor[0] || null;
    }

    return null;
  } catch {
    return null;
  }
}

function parseBirthday(birthday: string | undefined): string | null {
  if (!birthday) return null;

  // "1990年1月1日" or "1990-01-01" 形式に対応
  const match = birthday.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (match && match[1] && match[2] && match[3]) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ISO形式
  if (/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
    return birthday;
  }

  return null;
}

export function createBackfillPerformerProfilesHandler(deps: BackfillPerformerProfilesDeps) {
  const { getDb, sql } = deps;

  return async function GET(request: NextRequest) {
    if (!verifyCronRequest(request)) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request['url']);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const minProducts = parseInt(searchParams.get('minProducts') || '5', 10);

    const db = getDb();
    const startTime = Date.now();
    const TIME_LIMIT = 240_000; // 240秒（maxDuration 300秒の80%）

    const stats: BackfillStats = {
      performersChecked: 0,
      profilesUpdated: 0,
      imagesUpdated: 0,
      heightUpdated: 0,
      birthdayUpdated: 0,
      errors: 0,
    };

    try {
      console.log(`[backfill-performer-profiles] Starting with limit=${limit}, minProducts=${minProducts}`);

      // プロフィール情報が不足している演者を取得（作品数が多い順）
      const performers = await db.execute(sql`
        SELECT
          pf.id,
          pf.name,
          pf.profile_image_url,
          pf.height,
          pf.birthday,
          pf.bust,
          pf.waist,
          pf.hip,
          pf.cup,
          COUNT(DISTINCT pp.product_id)::int as product_count
        FROM performers pf
        INNER JOIN product_performers pp ON pf.id = pp.performer_id
        WHERE (
          pf.profile_image_url IS NULL
          OR pf.height IS NULL
          OR pf.birthday IS NULL
        )
        GROUP BY pf.id
        HAVING COUNT(DISTINCT pp.product_id) >= ${minProducts}
        ORDER BY COUNT(DISTINCT pp.product_id) DESC
        LIMIT ${limit}
      `);

      console.log(`  Found ${performers.rows.length} performers to process`);

      for (const row of performers.rows as unknown as Array<{
        id: number;
        name: string;
        profile_image_url: string | null;
        height: number | null;
        birthday: string | null;
        bust: number | null;
        waist: number | null;
        hip: number | null;
        cup: string | null;
        product_count: number;
      }>) {
        if (Date.now() - startTime > TIME_LIMIT) {
          console.log(`[backfill-performer-profiles] Time limit reached, processed ${stats.performersChecked}/${performers.rows.length}`);
          break;
        }
        stats.performersChecked++;

        try {
          // SOKMIL APIから演者情報を取得
          const sokmilData = await fetchSokmilActorByName(row['name']);

          if (!sokmilData) {
            continue;
          }

          const updates: string[] = [];
          const updateValues: Record<string, unknown> = {};

          // 画像URLの更新
          if (!row.profile_image_url && sokmilData.imageURL?.large) {
            updateValues['profile_image_url'] = sokmilData.imageURL.large;
            updates.push('image');
            stats.imagesUpdated++;
          }

          // 身長の更新
          if (!row['height'] && sokmilData.height) {
            const height = parseInt(sokmilData.height, 10);
            if (height > 100 && height < 200) {
              updateValues['height'] = height;
              updates.push('height');
              stats.heightUpdated++;
            }
          }

          // 誕生日の更新
          if (!row['birthday'] && sokmilData.birthday) {
            const birthday = parseBirthday(sokmilData.birthday);
            if (birthday) {
              updateValues['birthday'] = birthday;
              updates.push('birthday');
              stats.birthdayUpdated++;
            }
          }

          // スリーサイズの更新
          if (!row['bust'] && sokmilData.bust) {
            const bust = parseInt(sokmilData.bust, 10);
            if (bust > 60 && bust < 150) {
              updateValues['bust'] = bust;
              updates.push('bust');
            }
          }

          if (!row['waist'] && sokmilData.waist) {
            const waist = parseInt(sokmilData.waist, 10);
            if (waist > 40 && waist < 100) {
              updateValues['waist'] = waist;
              updates.push('waist');
            }
          }

          if (!row['hip'] && sokmilData.hip) {
            const hip = parseInt(sokmilData.hip, 10);
            if (hip > 60 && hip < 150) {
              updateValues['hip'] = hip;
              updates.push('hip');
            }
          }

          // カップサイズの更新
          if (!row['cup'] && sokmilData.cup) {
            updateValues['cup'] = sokmilData.cup;
            updates.push('cup');
          }

          // 読み仮名の更新
          if (sokmilData.ruby) {
            updateValues['name_kana'] = sokmilData.ruby;
            updates.push('nameKana');
          }

          // 更新実行
          if (Object.keys(updateValues).length > 0) {
            // 個別にUPDATEを実行
            if (updateValues['profile_image_url']) {
              await db.execute(sql`
                UPDATE performers
                SET profile_image_url = ${updateValues['profile_image_url'] as string}
                WHERE id = ${row['id']}
              `);
            }
            if (updateValues['height']) {
              await db.execute(sql`
                UPDATE performers
                SET height = ${updateValues['height'] as number}
                WHERE id = ${row['id']}
              `);
            }
            if (updateValues['birthday']) {
              await db.execute(sql`
                UPDATE performers
                SET birthday = ${updateValues['birthday'] as string}
                WHERE id = ${row['id']}
              `);
            }
            if (updateValues['bust']) {
              await db.execute(sql`
                UPDATE performers
                SET bust = ${updateValues['bust'] as number}
                WHERE id = ${row['id']}
              `);
            }
            if (updateValues['waist']) {
              await db.execute(sql`
                UPDATE performers
                SET waist = ${updateValues['waist'] as number}
                WHERE id = ${row['id']}
              `);
            }
            if (updateValues['hip']) {
              await db.execute(sql`
                UPDATE performers
                SET hip = ${updateValues['hip'] as number}
                WHERE id = ${row['id']}
              `);
            }
            if (updateValues['cup']) {
              await db.execute(sql`
                UPDATE performers
                SET cup = ${updateValues['cup'] as string}
                WHERE id = ${row['id']}
              `);
            }
            if (updateValues['name_kana']) {
              await db.execute(sql`
                UPDATE performers
                SET name_kana = ${updateValues['name_kana'] as string}
                WHERE id = ${row['id']} AND name_kana IS NULL
              `);
            }

            stats.profilesUpdated++;
            console.log(`  Updated ${row['name']}: ${updates.join(', ')}`);
          }

          // レートリミット対策（SOKMIL APIは1秒1リクエスト推奨）
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          stats.errors++;
          console.error(`  Error processing ${row['name']}: ${error}`);
        }
      }

      console.log(`[backfill-performer-profiles] Complete`);
      console.log(`  Checked: ${stats.performersChecked}`);
      console.log(`  Updated: ${stats.profilesUpdated}`);
      console.log(`  Images: ${stats.imagesUpdated}, Heights: ${stats.heightUpdated}, Birthdays: ${stats.birthdayUpdated}`);
      console.log(`  Errors: ${stats.errors}`);

      return NextResponse.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('[backfill-performer-profiles] Error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          stats,
        },
        { status: 500 }
      );
    }
  };
}
