import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

const BASE_URL = 'https://www.mgstage.com';

interface CheckResult {
  productId: string;
  url: string;
  status: number;
  isDeleted: boolean;
  title?: string;
}

async function checkProductExists(productId: string): Promise<CheckResult> {
  const url = `${BASE_URL}/product/product_detail/${productId}/`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'adc=1',
      },
      redirect: 'follow',
    });

    const html = await response.text();

    // 削除済み判定
    const isDeleted =
      response.status === 404 ||
      html.includes('お探しのページは見つかりませんでした') ||
      html.includes('ページが見つかりません') ||
      html.includes('この商品は取り扱いを終了しました') ||
      html.includes('現在この商品は販売されておりません') ||
      // トップページにリダイレクトされた場合
      (html.includes('MGS動画＜プレステージ グループ＞') && !html.includes('product_detail'));

    // タイトル抽出
    const titleMatch = html.match(/<h1[^>]*class="tag"[^>]*>([^<]+)<\/h1>/);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    return {
      productId,
      url,
      status: response.status,
      isDeleted,
      title,
    };
  } catch (error) {
    return {
      productId,
      url,
      status: 0,
      isDeleted: true,
    };
  }
}

async function main() {
  console.log('=== MGS 削除済み商品チェック ===\n');

  // ランダムに50件サンプリング
  const samples = await db.execute(sql`
    SELECT ps.original_product_id, p.title, p.created_at
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS'
    ORDER BY RANDOM()
    LIMIT 50
  `);

  console.log(`チェック対象: ${samples.rows.length}件\n`);

  const results: CheckResult[] = [];
  let deletedCount = 0;

  for (let i = 0; i < samples.rows.length; i++) {
    const row = samples.rows[i];
    const productId = row.original_product_id as string;

    process.stdout.write(`[${i + 1}/${samples.rows.length}] ${productId}... `);

    const result = await checkProductExists(productId);
    results.push(result);

    if (result.isDeleted) {
      deletedCount++;
      console.log(`❌ 削除済み (status: ${result.status})`);
    } else {
      console.log(`✅ 存在 (${result.title?.slice(0, 30)}...)`);
    }

    // レート制限
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 結果サマリー
  console.log('\n=== 結果サマリー ===');
  console.log(`チェック数: ${samples.rows.length}`);
  console.log(`存在: ${samples.rows.length - deletedCount}`);
  console.log(`削除済み: ${deletedCount}`);
  console.log(`削除率: ${((deletedCount / samples.rows.length) * 100).toFixed(1)}%`);

  // 削除済み商品のリスト
  const deletedProducts = results.filter(r => r.isDeleted);
  if (deletedProducts.length > 0) {
    console.log('\n=== 削除済み商品リスト ===');
    for (const p of deletedProducts) {
      console.log(`  ${p.productId}: ${p.url}`);
    }
  }

  // 推定される全体の削除済み商品数
  const totalMgs = await db.execute(sql`
    SELECT COUNT(*) as count FROM product_sources WHERE asp_name = 'MGS'
  `);
  const totalCount = Number(totalMgs.rows[0].count);
  const estimatedDeleted = Math.round(totalCount * (deletedCount / samples.rows.length));

  console.log('\n=== 推定 ===');
  console.log(`MGS総商品数: ${totalCount}`);
  console.log(`推定削除済み数: ~${estimatedDeleted} (${((deletedCount / samples.rows.length) * 100).toFixed(1)}%)`);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
