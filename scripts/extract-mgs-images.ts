/**
 * MGSページから実際の画像URLを抽出
 */

async function extractImages(productId: string) {
  const url = `https://www.mgstage.com/product/product_detail/${productId}/`;

  console.log(`Testing: ${url}\n`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'coc=1; adc=1',
      },
    });

    console.log(`Status: ${response.status}`);
    const html = await response.text();

    // image.mgstage.com のURLを抽出
    const imagePattern = /https?:\/\/image\.mgstage\.com\/[^\s"'<>]+/gi;
    const imageUrls = html.match(imagePattern) || [];

    console.log(`\n=== Found ${imageUrls.length} image.mgstage.com URLs ===\n`);

    // ユニークなURLのみ抽出して表示
    const uniqueUrls = [...new Set(imageUrls)];
    uniqueUrls.forEach((url, index) => {
      console.log(`[${index + 1}] ${url}`);
    });

    // URLパターンを分析
    console.log('\n=== URL Pattern Analysis ===\n');

    const packageImages = uniqueUrls.filter(url => url.includes('pb_e_') || url.includes('pf_e_') || url.includes('pb_o_'));
    const sampleImages = uniqueUrls.filter(url => url.includes('cap_e_') || url.includes('cap_o_'));

    console.log(`Package images (pb_e_, pf_e_, pb_o_): ${packageImages.length}`);
    packageImages.forEach(url => console.log(`  ${url}`));

    console.log(`\nSample images (cap_e_, cap_o_): ${sampleImages.length}`);
    sampleImages.slice(0, 5).forEach(url => console.log(`  ${url}`));
    if (sampleImages.length > 5) {
      console.log(`  ... and ${sampleImages.length - 5} more`);
    }

  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

// テストする商品IDリスト
const testProducts = [
  'GNI-007',      // ユーザーが指定
  'SIRO-4000',    // 現在失敗している
  'STARS-862',    // 現在失敗している
  '300MIUM-1150', // 現在失敗している
  '259LUXU-1006', // 成功している
  'ABP-862',      // 現在失敗している
  'CAWD-500',     // 現在失敗している
];

async function runTests() {
  for (const productId of testProducts) {
    await extractImages(productId);
    console.log('\n' + '='.repeat(80) + '\n');
    // レート制限対策
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
