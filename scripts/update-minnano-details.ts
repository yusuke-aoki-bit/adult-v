/**
 * 詳細情報未取得のperformerに対してminnano-avから詳細を取得して更新
 */
import { db } from '../packages/crawlers/src/lib/db';
import { performers, performerExternalIds } from '../packages/crawlers/src/lib/db/schema';
import { eq, sql, and, isNull, or } from 'drizzle-orm';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.minnano-av.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const DELAY_MS = 2000;

interface PerformerDetail {
  birthday: string | null;
  bloodType: string | null;
  height: number | null;
  bust: number | null;
  waist: number | null;
  hip: number | null;
  cup: string | null;
  birthplace: string | null;
  // 画像URLは著作権の問題があるため収集しない
}

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

async function fetchActressDetail(url: string): Promise<PerformerDetail | null> {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const detail: PerformerDetail = {
      birthday: null,
      bloodType: null,
      height: null,
      bust: null,
      waist: null,
      hip: null,
      cup: null,
      birthplace: null,
    };

    // 画像URLは著作権の問題があるため収集しない

    // プロフィールテーブルから情報を取得
    $('table tr').each((_, row) => {
      const th = $(row).find('th').text().trim();
      const td = $(row).find('td').text().trim();

      if (th.includes('生年月日') && td) {
        const match = td.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (match) {
          detail.birthday = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        }
      }
      if (th.includes('血液型') && td) {
        const match = td.match(/([ABO]|AB)型?/);
        if (match) detail.bloodType = match[1];
      }
      if (th.includes('身長') && td) {
        const match = td.match(/(\d{2,3})\s*cm/);
        if (match) detail.height = parseInt(match[1]);
      }
      if (th.includes('スリーサイズ') && td) {
        const match = td.match(/B(\d{2,3}).*W(\d{2,3}).*H(\d{2,3})/);
        if (match) {
          detail.bust = parseInt(match[1]);
          detail.waist = parseInt(match[2]);
          detail.hip = parseInt(match[3]);
        }
      }
      if (th.includes('カップ') && td) {
        const match = td.match(/([A-Z])カップ?/i);
        if (match) detail.cup = match[1].toUpperCase();
      }
      if (th.includes('出身地') && td) {
        detail.birthplace = td;
      }
    });

    return detail;
  } catch (e) {
    console.error(`  詳細取得エラー: ${e}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 1000;
  const offsetArg = args.find(a => a.startsWith('--offset='));
  const offset = offsetArg ? parseInt(offsetArg.split('=')[1], 10) : 0;

  console.log('=== minnano-av 詳細情報更新 ===');
  console.log(`Limit: ${limit}, Offset: ${offset}\n`);

  // 詳細情報が未取得でexternal_idがあるperformerを取得
  // JOINが重いため、2段階クエリに分割
  console.log('対象performer取得中...');

  // Step 1: minnano-avのexternal_idを持つperformer_idを取得
  const externalIds = await db.execute(sql`
    SELECT performer_id, external_id, external_url
    FROM performer_external_ids
    WHERE provider = 'minnano-av'
    ORDER BY performer_id
  `);

  const externalIdMap = new Map<number, { externalId: string; externalUrl: string | null }>();
  for (const row of externalIds.rows as any[]) {
    externalIdMap.set(row.performer_id, {
      externalId: row.external_id,
      externalUrl: row.external_url,
    });
  }
  console.log(`minnano-av external_id: ${externalIdMap.size}件`);

  // Step 2: 詳細未取得のperformerを取得（JOINなし）
  const performers_result = await db.execute(sql`
    SELECT id, name
    FROM performers
    WHERE birthday IS NULL AND height IS NULL AND bust IS NULL
    ORDER BY id
  `);

  // フィルタ: external_idを持つもののみ
  const targetPerformers = {
    rows: (performers_result.rows as any[])
      .filter(p => externalIdMap.has(p.id))
      .map(p => ({
        ...p,
        external_id: externalIdMap.get(p.id)!.externalId,
        external_url: externalIdMap.get(p.id)!.externalUrl,
      }))
      .slice(offset, offset + limit)
  };

  console.log(`対象performer: ${targetPerformers.rows.length}件\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of targetPerformers.rows as any[]) {
    const profileUrl = row.external_url || `${BASE_URL}/actress${row.external_id}.html`;

    try {
      console.log(`[${updated + skipped + errors + 1}/${targetPerformers.rows.length}] ${row.name}`);

      const detail = await fetchActressDetail(profileUrl);

      if (!detail) {
        skipped++;
        continue;
      }

      const updates: any = {};
      if (detail.birthday) updates.birthday = detail.birthday;
      if (detail.bloodType) updates.bloodType = detail.bloodType;
      if (detail.height) updates.height = detail.height;
      if (detail.bust) updates.bust = detail.bust;
      if (detail.waist) updates.waist = detail.waist;
      if (detail.hip) updates.hip = detail.hip;
      if (detail.cup) updates.cup = detail.cup;
      if (detail.birthplace) updates.birthplace = detail.birthplace;
      // 画像URLは著作権の問題があるため収集しない

      if (Object.keys(updates).length > 0) {
        await db
          .update(performers)
          .set(updates)
          .where(eq(performers.id, row.id));
        console.log(`  ✓ 更新: ${Object.keys(updates).join(', ')}`);
        updated++;
      } else {
        console.log(`  - データなし`);
        skipped++;
      }

      await new Promise(r => setTimeout(r, DELAY_MS));
    } catch (e) {
      console.error(`  ✗ エラー: ${e}`);
      errors++;
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`更新: ${updated}, スキップ: ${skipped}, エラー: ${errors}`);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
