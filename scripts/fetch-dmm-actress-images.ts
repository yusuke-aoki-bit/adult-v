/**
 * DMM Web API 女優検索を使って演者の公式画像URLを取得
 * https://affiliate.dmm.com/api/v3/actresssearch.html
 *
 * 利用条件: DMMアフィリエイト登録が必要（APIで取得した画像は利用可能）
 */
import { db } from '../packages/crawlers/src/lib/db';
import { performers } from '../packages/crawlers/src/lib/db/schema';
import { eq, sql, isNull, and } from 'drizzle-orm';

const DMM_API_ID = process.env.DMM_API_ID;
const DMM_AFFILIATE_ID = process.env.DMM_AFFILIATE_ID || process.env.NEXT_PUBLIC_DMM_AFFILIATE_ID;
const BASE_URL = 'https://api.dmm.com/affiliate/v3/ActressSearch';
const DELAY_MS = 1000; // APIレート制限対策

interface DMMActress {
  id: string;
  name: string;
  ruby?: string;
  bust?: string;
  cup?: string;
  waist?: string;
  hip?: string;
  height?: string;
  birthday?: string;
  blood_type?: string;
  hobby?: string;
  prefectures?: string;
  imageURL?: {
    small?: string;
    large?: string;
  };
  listURL?: {
    digital?: string;
    monthly?: string;
    ppm?: string;
    mono?: string;
    rental?: string;
  };
}

interface DMMActressSearchResponse {
  request: {
    parameters: Record<string, string>;
  };
  result: {
    status: number;
    result_count: number;
    total_count: number;
    first_position: number;
    actress: DMMActress[];
  };
}

async function searchActress(name: string): Promise<DMMActress | null> {
  if (!DMM_API_ID || !DMM_AFFILIATE_ID) {
    throw new Error('DMM_API_ID and DMM_AFFILIATE_ID must be set');
  }

  const params = new URLSearchParams({
    api_id: DMM_API_ID,
    affiliate_id: DMM_AFFILIATE_ID,
    keyword: name,
    hits: '10',
    output: 'json',
  });

  const url = `${BASE_URL}?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: DMMActressSearchResponse = await response.json();

    if (data.result.status !== 200 || data.result.result_count === 0) {
      return null;
    }

    // 完全一致を優先
    const exactMatch = data.result.actress.find(
      a => a.name === name || a.name.replace(/\s/g, '') === name.replace(/\s/g, '')
    );

    return exactMatch || data.result.actress[0];
  } catch (e) {
    console.error(`  API error: ${e}`);
    return null;
  }
}

async function main() {
  if (!DMM_API_ID || !DMM_AFFILIATE_ID) {
    console.error('Error: DMM_API_ID and DMM_AFFILIATE_ID environment variables must be set');
    console.error('Please set them in .env.local or as environment variables');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100;
  const offsetArg = args.find(a => a.startsWith('--offset='));
  const offset = offsetArg ? parseInt(offsetArg.split('=')[1], 10) : 0;

  console.log('=== DMM API 女優画像取得 ===');
  console.log(`API ID: ${DMM_API_ID.substring(0, 5)}...`);
  console.log(`Affiliate ID: ${DMM_AFFILIATE_ID}`);
  console.log(`Limit: ${limit}, Offset: ${offset}\n`);

  // 画像URLがないperformerを取得
  const targetPerformers = await db.execute(sql`
    SELECT id, name
    FROM performers
    WHERE image_url IS NULL
    ORDER BY id
    LIMIT ${limit} OFFSET ${offset}
  `);

  console.log(`対象performer: ${targetPerformers.rows.length}件\n`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const row of targetPerformers.rows as any[]) {
    try {
      console.log(`[${updated + notFound + errors + 1}/${targetPerformers.rows.length}] ${row.name}`);

      const actress = await searchActress(row.name);

      if (!actress) {
        console.log(`  - DMM未登録`);
        notFound++;
        await new Promise(r => setTimeout(r, DELAY_MS));
        continue;
      }

      const imageUrl = actress.imageURL?.large || actress.imageURL?.small;

      if (!imageUrl) {
        console.log(`  - 画像なし`);
        notFound++;
        await new Promise(r => setTimeout(r, DELAY_MS));
        continue;
      }

      // 画像URLを保存
      await db
        .update(performers)
        .set({ imageUrl })
        .where(eq(performers.id, row.id));

      console.log(`  ✓ 画像取得: ${imageUrl.substring(0, 60)}...`);
      updated++;

      await new Promise(r => setTimeout(r, DELAY_MS));
    } catch (e) {
      console.error(`  ✗ エラー: ${e}`);
      errors++;
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`更新: ${updated}, 未登録: ${notFound}, エラー: ${errors}`);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
