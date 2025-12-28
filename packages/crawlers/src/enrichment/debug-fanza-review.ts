/**
 * FANZAのレビュー・評価構造をデバッグするスクリプト
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function main() {
  console.log('🔍 FANZAレビュー構造の調査');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // 年齢確認Cookieを設定
    await page.setCookie({
      name: 'age_check_done',
      value: '1',
      domain: '.dmm.co.jp',
    });

    // サンプル商品ページ（レビューがありそうなもの）
    const testUrls = [
      'https://www.dmm.co.jp/digital/videoa/-/detail/=/cid=ipx00559/',
      'https://www.dmm.co.jp/digital/videoa/-/detail/=/cid=ssis00001/',
    ];

    for (const url of testUrls) {
      console.log(`\n📄 ${url}`);

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        const html = await page.content();

        // JSON-LD確認
        const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
        if (jsonLdMatch) {
          console.log('\n📋 JSON-LD found:');
          for (const match of jsonLdMatch) {
            const content = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
            try {
              const data = JSON.parse(content);
              if (data.aggregateRating) {
                console.log('  aggregateRating:', JSON.stringify(data.aggregateRating));
              }
              if (data['@type']) {
                console.log('  @type:', data['@type']);
              }
            } catch {
              console.log('  (parse error)');
            }
          }
        } else {
          console.log('\n❌ No JSON-LD found');
        }

        // レビュー関連のHTML確認
        console.log('\n🔍 レビュー関連パターン:');

        // 平均評価
        const ratingPatterns = [
          /平均評価[：:][^<]*<[^>]*>?\s*([0-9.]+)/i,
          /data-rating="([0-9.]+)"/i,
          /評価[：:]?\s*([0-9.]+)/i,
          /review.*rating.*?([0-9.]+)/i,
          /★+/g,
        ];

        for (const pattern of ratingPatterns) {
          const match = html.match(pattern);
          if (match) {
            console.log(`  ${pattern}: ${match[0].substring(0, 100)}`);
          }
        }

        // レビュー件数
        const countPatterns = [
          /(\d+)\s*件のレビュー/i,
          /レビュー[：:]?\s*(\d+)/i,
          /review.*count.*?(\d+)/i,
        ];

        for (const pattern of countPatterns) {
          const match = html.match(pattern);
          if (match) {
            console.log(`  ${pattern}: ${match[0]}`);
          }
        }

        // レビューセクション
        const reviewSection = html.match(/review|レビュー/gi);
        console.log(`  "review"/"レビュー" occurrences: ${reviewSection?.length || 0}`);

        // レビュー要素のclass確認
        const reviewClasses = html.match(/class="[^"]*review[^"]*"/gi);
        if (reviewClasses) {
          console.log('  Review classes:', [...new Set(reviewClasses)].slice(0, 5));
        }

      } catch (error) {
        console.error(`  Error: ${error}`);
      }
    }

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
