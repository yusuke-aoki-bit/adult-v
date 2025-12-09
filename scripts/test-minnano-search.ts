/**
 * minnano-avの女優検索テスト (修正版)
 */

import * as cheerio from 'cheerio';

async function searchMinnaNoAVByActress(actressName: string): Promise<string[]> {
  try {
    const searchUrl = `https://www.minnano-av.com/search_result.php?search_word=${encodeURIComponent(actressName)}&search_scope=actress`;
    console.log(`Searching: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      console.log(`Request failed: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    console.log('Title:', $('title').text());
    console.log('H1:', $('h1').text().trim());

    // 検索結果から女優名を抽出
    // リンク形式: actressXXXXXX.html?女優名
    const performers: string[] = [];

    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      // 女優ページへのリンク（actressXXXXXX.html形式）
      // ナビゲーションリンク（actress_list.phpなど）を除外
      if (href.match(/^actress\d+\.html/) && text) {
        // 基本的なフィルタリングのみ（検索サイトがすでにフィルタリング済み）
        if (text.length >= 2 &&
            text.length < 30 &&
            /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\sA-Za-z]+$/.test(text) &&
            !text.includes('評価') &&
            !text.includes('女優') &&
            !text.includes('一覧')) {
          console.log(`  ✓ Found: ${text} -> ${href}`);
          performers.push(text);
        }
      }
    });

    return [...new Set(performers)];
  } catch (e) {
    console.error('Error:', e);
    return [];
  }
}

async function main() {
  const names = ['いくこ', 'まゆみ', 'yukino', '上原亜衣'];

  for (const name of names) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Testing: ${name}`);
    console.log('='.repeat(50));
    const results = await searchMinnaNoAVByActress(name);
    console.log(`\n✅ Final Results (${results.length}): ${results.slice(0, 10).join(', ')}${results.length > 10 ? '...' : ''}`);

    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }
}

main().catch(console.error);
