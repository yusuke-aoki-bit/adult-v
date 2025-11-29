/**
 * MGS画像URLパターン生成のテスト
 */

/**
 * MGS商品IDから画像URLを生成
 */
function generateImageUrls(productId: string): string[] {
  const images: string[] = [];

  // 商品IDを解析（例: "300MIUM-1150" -> series="300mium", number="1150"）
  const match = productId.match(/^([A-Z0-9]+)-?(\d+)$/i);
  if (!match) {
    return [];
  }

  const series = match[1].toLowerCase();
  const number = match[2];

  // シリーズ名のマッピング（MGSのディレクトリ構造に合わせる）
  const seriesMapping: Record<string, string> = {
    '300mium': 'prestigepremium',
    '300maan': 'prestigepremium',
    '300ntk': 'prestigepremium',
    'siro': 'shirouto',
    'abp': 'prestige',
    'abw': 'prestige',
    'stars': 'prestige',
    'cawd': 'prestige',
    '259luxu': 'luxutv',
    'mfcs': 'prestige',
  };

  const directory = seriesMapping[series] || 'prestige';

  // 基本URLパターン
  const baseUrl = `https://image.mgstage.com/images/${directory}/${series}/${number}`;

  // パッケージ画像
  images.push(`${baseUrl}/pb_e_${series}-${number}.jpg`);

  // サンプル画像（通常1-10枚程度）
  for (let i = 1; i <= 10; i++) {
    images.push(`${baseUrl}/cap_e_${i}_${series}-${number}.jpg`);
  }

  return images;
}

/**
 * 画像URLが存在するか確認（HEADリクエスト）
 */
async function checkImageExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function testPatternGeneration() {
  // テスト用の商品ID（既知の画像URLと照合）
  const testCases = [
    {
      productId: '300MIUM-1150',
      expectedPackage: 'https://image.mgstage.com/images/prestigepremium/300mium/1150/pb_e_300mium-1150.jpg',
    },
    {
      productId: 'SIRO-4000',
      expectedPackage: 'https://image.mgstage.com/images/shirouto/siro/4000/pb_e_siro-4000.jpg',
    },
    {
      productId: 'STARS-862',
      expectedPackage: 'https://image.mgstage.com/images/prestige/stars/862/pb_e_stars-862.jpg',
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${testCase.productId}`);
    console.log('='.repeat(80));

    const generatedUrls = generateImageUrls(testCase.productId);
    console.log(`\nGenerated ${generatedUrls.length} URLs`);
    console.log(`\nPackage image: ${generatedUrls[0]}`);
    console.log(`Expected:      ${testCase.expectedPackage}`);
    console.log(`Match: ${generatedUrls[0] === testCase.expectedPackage ? '✅' : '❌'}`);

    // 実際の存在確認（最初の3枚のみ）
    console.log('\n🔍 Checking image existence (first 3):');
    for (let i = 0; i < Math.min(3, generatedUrls.length); i++) {
      const url = generatedUrls[i];
      const exists = await checkImageExists(url);
      console.log(`  ${exists ? '✅' : '❌'} ${url}`);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  console.log('\n\n✅ Pattern generation test completed');
}

testPatternGeneration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
