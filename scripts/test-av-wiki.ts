/**
 * av-wiki.net検索テスト
 */

import * as cheerio from 'cheerio';

interface SearchResult {
  found: boolean;
  performers: string[];
  totalResults: number;
}

async function searchAvWiki(name: string): Promise<SearchResult> {
  try {
    // av-wikiはWordPress検索を使用
    const url = `https://av-wiki.net/?s=${encodeURIComponent(name)}`;
    console.log(`  URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });

    console.log(`  Status: ${response.status}`);

    if (!response.ok) {
      return { found: false, performers: [], totalResults: 0 };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('title').text().trim();
    console.log(`  Title: ${title}`);

    // 検索結果から女優名を抽出
    const performers: string[] = [];

    // 記事タイトルから抽出 (h2.entry-title a)
    $('h2.entry-title a, .entry-title a, article h2 a').each((_, el) => {
      const text = $(el).text().trim();
      // 女優名として妥当なものをフィルタ
      if (text &&
          text.length >= 2 &&
          text.length <= 30 &&
          /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\sA-Za-z]+$/.test(text) &&
          !text.includes('検索') &&
          !text.includes('一覧') &&
          !text.includes('ページ')) {
        performers.push(text);
      }
    });

    // 完全一致を優先
    const exactMatch = performers.find(p => p === name);
    if (exactMatch) {
      console.log(`  → 完全一致: ${exactMatch}`);
      return { found: true, performers: [exactMatch], totalResults: performers.length };
    }

    // 結果数によるフィルタリング
    const uniquePerformers = [...new Set(performers)];
    console.log(`  → 結果数: ${uniquePerformers.length}`);

    return {
      found: uniquePerformers.length > 0,
      performers: uniquePerformers.slice(0, 5),
      totalResults: uniquePerformers.length
    };
  } catch (e) {
    console.log(`  Error: ${e}`);
    return { found: false, performers: [], totalResults: 0 };
  }
}

async function main() {
  // フルネームと短い名前両方でテスト
  const names = ['上原亜衣', '椎名そら', 'いくこ', 'まりな', 'まゆみ', 'あいり', '宮崎まゆみ'];

  console.log('=== av-wiki.net検索テスト（WordPress検索使用） ===\n');
  console.log('サイト説明: シロウト女優、キカタン（企画単体）AV女優名のまとめサイト\n');

  for (const name of names) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`検索: ${name}`);
    console.log('='.repeat(50));

    const result = await searchAvWiki(name);

    if (result.found) {
      if (result.totalResults === 1) {
        console.log(`✅ 一致: ${result.performers[0]}`);
      } else {
        console.log(`✅ 発見 (${result.totalResults}件): ${result.performers.join(', ')}`);
      }
    } else {
      console.log(`❌ 該当なし`);
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  // G-AREA商品タイトルでもテスト
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('=== G-AREA商品タイトル検索テスト ===');
  console.log('='.repeat(60));

  const titles = [
    'G-AREA いくこ',
    'Tokyo247 まゆみ',
    'S-Cute yukino',
  ];

  for (const title of titles) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`タイトル: ${title}`);
    console.log('='.repeat(50));

    // タイトルから名前を抽出して検索
    const nameMatch = title.match(/(?:G[-]?AREA|Tokyo247|S-Cute)\s+([^\s【】（）\(\)]+)/i);
    if (nameMatch) {
      const extractedName = nameMatch[1];
      console.log(`  抽出した名前: ${extractedName}`);

      const result = await searchAvWiki(extractedName);

      if (result.found) {
        console.log(`✅ 発見 (${result.totalResults}件): ${result.performers.join(', ')}`);
      } else {
        console.log(`❌ 該当なし`);
      }
    } else {
      console.log(`  ⚠️ 名前を抽出できず`);
    }

    await new Promise(r => setTimeout(r, 1500));
  }
}

main().catch(console.error);
