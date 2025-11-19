/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * APEX商品URLから画像URLが取得できるか確認するスクリプト
 * Usage: node scripts/check-apex-images.js
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// テスト用の商品URL（APEXのCSVから取得）
const testUrls = [
  'http://duga.jp/ppv/100hame-0002/',
  'http://duga.jp/ppv/100hame-0003/',
  'http://duga.jp/ppv/100hame-0004/',
];

/**
 * HTMLから画像URLを抽出
 */
function extractImageUrls(html, baseUrl) {
  const imageUrls = [];
  
  // og:image メタタグを探す
  const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  if (ogImageMatch) {
    imageUrls.push(ogImageMatch[1]);
  }
  
  // img タグから画像URLを抽出
  const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
  for (const match of imgMatches) {
    const src = match[1];
    // サムネイル画像らしいものを優先
    if (src.includes('thumb') || src.includes('sample') || src.includes('image') || src.includes('jpg') || src.includes('png')) {
      const absoluteUrl = new URL(src, baseUrl).href;
      if (!imageUrls.includes(absoluteUrl)) {
        imageUrls.push(absoluteUrl);
      }
    }
  }
  
  return imageUrls;
}

/**
 * URLからHTMLを取得
 */
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000,
    };
    
    const req = client.request(options, (res) => {
      // リダイレクトを処理
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).href;
        return resolve(fetchHtml(redirectUrl));
      }
      
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

/**
 * メイン処理
 */
async function main() {
  console.log('APEX商品ページから画像URLを取得できるか確認中...\n');
  
  for (const url of testUrls) {
    try {
      console.log(`[確認中] ${url}`);
      const html = await fetchHtml(url);
      const imageUrls = extractImageUrls(html, url);
      
      if (imageUrls.length > 0) {
        console.log(`  ✓ 画像URLが見つかりました (${imageUrls.length}件):`);
        imageUrls.slice(0, 3).forEach((imgUrl, idx) => {
          console.log(`    ${idx + 1}. ${imgUrl}`);
        });
      } else {
        console.log('  ✗ 画像URLが見つかりませんでした');
      }
      console.log('');
    } catch (error) {
      console.log(`  ✗ エラー: ${error.message}`);
      console.log('');
    }
  }
  
  console.log('\n確認完了。');
  console.log('\n注意: 実際の画像取得には以下を考慮してください:');
  console.log('1. 利用規約の確認');
  console.log('2. レート制限の遵守');
  console.log('3. 画像のホスティング方法（CDN、S3等）');
}

main().catch(console.error);

