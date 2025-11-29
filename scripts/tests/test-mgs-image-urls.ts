/**
 * Playwrightで画像URLの存在確認をテスト
 * HEADリクエストではなく、ブラウザで実際にアクセスして確認
 */
import { getBrowser, closeBrowser } from '../lib/browser-utils';

interface ImageTestResult {
  url: string;
  exists: boolean;
  statusCode?: number;
  error?: string;
}

async function testImageUrl(url: string): Promise<ImageTestResult> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  try {
    // 画像URLに直接アクセス
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    const statusCode = response?.status();
    const exists = statusCode === 200;

    await context.close();

    return {
      url,
      exists,
      statusCode,
    };
  } catch (error) {
    await context.close();
    return {
      url,
      exists: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log('=== MGS画像URL存在確認テスト ===\n');

  // テスト対象のURL（curlで成功したもの）
  const testUrls = [
    {
      name: '300MIUM-1000 (Prestige Premium)',
      url: 'https://image.mgstage.com/images/prestigepremium/300mium/1000/pb_e_300mium-1000.jpg',
    },
    {
      name: '812MMC-020 (Momoco)',
      url: 'https://image.mgstage.com/images/momoco/812mmc/020/pb_e_812mmc-020.jpg',
    },
    {
      name: 'DDH-362 (Doc)',
      url: 'https://image.mgstage.com/images/doc/ddh/362/pb_e_ddh-362.jpg',
    },
    {
      name: '107SDHS-044 (SOD Create - プレフィックスあり)',
      url: 'https://image.mgstage.com/images/sodcreate/107sdhs/044/pb_e_107sdhs-044.jpg',
    },
    {
      name: 'STARS-1000 → 107STARS-1000 (SOD Create - プレフィックス追加)',
      url: 'https://image.mgstage.com/images/sodcreate/107stars/1000/pb_e_107stars-1000.jpg',
    },
  ];

  for (const test of testUrls) {
    console.log(`Testing: ${test.name}`);
    console.log(`URL: ${test.url}`);

    const result = await testImageUrl(test.url);

    if (result.exists) {
      console.log(`✅ 存在確認: HTTP ${result.statusCode}\n`);
    } else {
      console.log(`❌ アクセス失敗: ${result.statusCode || result.error}\n`);
    }

    // レート制限対策
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  await closeBrowser();
  console.log('=== テスト完了 ===');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  closeBrowser();
  process.exit(1);
});
