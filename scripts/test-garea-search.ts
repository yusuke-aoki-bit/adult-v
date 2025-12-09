/**
 * G-AREAタイトルからの検索テスト
 */

import * as cheerio from 'cheerio';

// タイトルから出演者名候補を抽出
function extractPerformerFromTitle(title: string): string[] {
  const candidates: string[] = [];

  // G-AREA形式: "G-AREA いくこ" or "GAREA いくこ"
  const gareaMatch = title.match(/G[-]?AREA\s+([^\s【】（）\(\)]+)/i);
  if (gareaMatch) {
    candidates.push(gareaMatch[1]);
  }

  // 一般的なパターン: ひらがな・カタカナの名前を抽出（2-6文字）
  const nameMatches = title.match(/[\u3040-\u309F\u30A0-\u30FF]{2,6}(?=\s|$|【|\d|歳)/g);
  if (nameMatches) {
    for (const name of nameMatches) {
      if (!['はじめて', 'すべて', 'ひとり', 'ふたり', 'みんな', 'おとな', 'こども'].includes(name)) {
        candidates.push(name);
      }
    }
  }

  return [...new Set(candidates)];
}

// みんなのAVで女優名検索（完全一致優先）
async function searchMinnaNoAVByActress(actressName: string): Promise<{ exactMatch: string | null; partialMatches: string[] }> {
  try {
    const searchUrl = `https://www.minnano-av.com/search_result.php?search_word=${encodeURIComponent(actressName)}&search_scope=actress`;
    console.log(`  検索URL: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) return { exactMatch: null, partialMatches: [] };

    const html = await response.text();
    const $ = cheerio.load(html);

    let exactMatch: string | null = null;
    const partialMatches: string[] = [];

    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      if (href.match(/^actress\d+\.html/) && text) {
        if (text.length >= 2 &&
            text.length < 30 &&
            /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\sA-Za-z]+$/.test(text) &&
            !text.includes('評価') &&
            !text.includes('女優') &&
            !text.includes('一覧')) {
          // 完全一致を優先
          if (text === actressName) {
            exactMatch = text;
          } else {
            partialMatches.push(text);
          }
        }
      }
    });

    return { exactMatch, partialMatches: [...new Set(partialMatches)] };
  } catch {
    return { exactMatch: null, partialMatches: [] };
  }
}

// erodougazoで作品タイトル検索
async function searchErodougazo(title: string): Promise<{ performers: string[]; productTitle: string | null }> {
  try {
    const searchUrl = `https://erodougazo.com/?s=${encodeURIComponent(title)}`;
    console.log(`  erodougazo検索URL: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      console.log(`  → erodougazo: HTTPエラー ${response.status}`);
      return { performers: [], productTitle: null };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 検索結果から作品リンクを取得
    const articles: { title: string; href: string }[] = [];
    $('article a, .entry-title a, h2 a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (href.includes('erodougazo.com') && text && text.length > 5) {
        articles.push({ title: text, href });
      }
    });

    if (articles.length === 0) {
      console.log(`  → erodougazo: 検索結果なし`);
      return { performers: [], productTitle: null };
    }

    console.log(`  → erodougazo: ${articles.length}件ヒット: ${articles[0].title.substring(0, 30)}...`);

    // 最初の作品ページから出演者を取得
    const productResponse = await fetch(articles[0].href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!productResponse.ok) return { performers: [], productTitle: articles[0].title };

    const productHtml = await productResponse.text();
    const $product = cheerio.load(productHtml);

    // 出演者を抽出（タグやメタ情報から）
    const performers: string[] = [];

    // タグから抽出
    $product('a[rel="tag"], .tag a, .tags a').each((_, el) => {
      const text = $product(el).text().trim();
      if (text.length >= 2 &&
          text.length <= 20 &&
          /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(text) &&
          !['素人', '美少女', '巨乳', 'お姉さん', 'OL', '人妻', '熟女', 'ギャル', 'JK', 'JD'].includes(text)) {
        performers.push(text);
      }
    });

    // 本文から名前パターン抽出
    const bodyText = $product('.entry-content, .post-content, article').text();
    const nameMatch = bodyText.match(/出演[：:]\s*([^\s\n]+)/);
    if (nameMatch && nameMatch[1].length >= 2 && nameMatch[1].length <= 20) {
      performers.push(nameMatch[1]);
    }

    return { performers: [...new Set(performers)], productTitle: articles[0].title };
  } catch (e) {
    console.log(`  erodougazoエラー: ${e}`);
    return { performers: [], productTitle: null };
  }
}

// Seesaa Wikiで女優名検索（タイトルから抽出した名前で検索）
async function searchSeesaaWikiByName(actressName: string): Promise<{ found: boolean; url: string | null }> {
  try {
    // 女優ページに直接アクセス
    const pageUrl = `https://seesaawiki.jp/av_neme/d/${encodeURIComponent(actressName)}`;
    console.log(`  seesaawiki直接アクセス: ${pageUrl}`);

    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    // 404なら存在しない
    if (response.status === 404) {
      console.log(`  → seesaawiki: ページ存在せず`);
      return { found: false, url: null };
    }

    if (!response.ok) {
      console.log(`  → seesaawiki: HTTPエラー ${response.status}`);
      return { found: false, url: null };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // ページタイトルが女優名と一致するか確認
    const pageTitle = $('h2').first().text().trim().replace(/\s*編集する?\s*/g, '').trim();

    if (pageTitle && pageTitle.length >= 2) {
      console.log(`  → seesaawiki: ページ発見 "${pageTitle}"`);
      return { found: true, url: pageUrl };
    }

    return { found: false, url: null };
  } catch (e) {
    console.log(`  seesaawikiエラー: ${e}`);
    return { found: false, url: null };
  }
}

// Seesaa Wikiで作品タイトル検索
async function searchSeesaaWiki(title: string): Promise<{ performers: string[]; productTitle: string | null }> {
  try {
    const searchUrl = `https://seesaawiki.jp/av_neme/search?keywords=${encodeURIComponent(title)}`;
    console.log(`  seesaawiki検索URL: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      console.log(`  → seesaawiki: HTTPエラー ${response.status}`);
      return { performers: [], productTitle: null };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 検索結果から女優ページリンクを取得
    const results: { title: string; href: string }[] = [];
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      // 女優ページへのリンク
      if (href.includes('/av_neme/d/') && text && text.length >= 2 && text.length <= 20) {
        results.push({ title: text, href });
      }
    });

    if (results.length === 0) {
      console.log(`  → seesaawiki: 検索結果なし`);
      return { performers: [], productTitle: null };
    }

    console.log(`  → seesaawiki: ${results.length}件ヒット: ${results.slice(0, 3).map(r => r.title).join(', ')}`);

    // 女優名をそのまま返す
    const performers = results.map(r => r.title).filter(name =>
      /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(name)
    );

    return { performers: [...new Set(performers)].slice(0, 3), productTitle: title };
  } catch (e) {
    console.log(`  seesaawikiエラー: ${e}`);
    return { performers: [], productTitle: null };
  }
}

// タイトルからWiki検索（完全一致優先）
async function searchWikiByTitle(title: string) {
  const candidates = extractPerformerFromTitle(title);

  if (candidates.length === 0) {
    console.log('  候補なし');
    return null;
  }

  console.log(`  タイトルから抽出した候補: ${candidates.join(', ')}`);

  for (const candidate of candidates) {
    const result = await searchMinnaNoAVByActress(candidate);
    const totalCount = (result.exactMatch ? 1 : 0) + result.partialMatches.length;

    if (totalCount === 0) {
      console.log(`  → "${candidate}": 検索結果なし`);
      continue;
    }

    // 完全一致があれば採用
    if (result.exactMatch) {
      console.log(`  → "${candidate}": 完全一致ヒット ✓ ${result.exactMatch} (他${result.partialMatches.length}件)`);
      return { performers: [result.exactMatch], source: 'msin' };
    }

    // 完全一致なし
    console.log(`  → "${candidate}": 完全一致なし（部分一致${result.partialMatches.length}件）: ${result.partialMatches.slice(0, 5).join(', ')}...`);
    await new Promise(r => setTimeout(r, 2000));
  }

  return null;
}

async function main() {
  const testTitles = [
    'G-AREA いくこ',
    'G-AREA まりな',
    'G-AREA 上原亜衣',       // フルネーム
    'G-AREA 椎名そら',       // フルネーム
    'Tokyo247 宮崎まゆみ',   // Tokyo247形式
    'S-Cute yukino',         // 英語名
    '【初撮り】美人OL あいり 25歳',
  ];

  for (const title of testTitles) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`タイトル: ${title}`);
    console.log('='.repeat(60));

    // 方法1: 女優名検索（完全一致優先）
    console.log('\n【方法1: minnano-av女優名検索】');
    const result = await searchWikiByTitle(title);

    if (result) {
      console.log(`✅ 女優名検索: ${result.performers.join(', ')}`);
    } else {
      console.log(`❌ 女優名検索: 特定不可`);
    }

    await new Promise(r => setTimeout(r, 1500));

    // 方法2: erodougazoで作品タイトル検索
    console.log('\n【方法2: erodougazo作品検索】');
    const erodougazoResult = await searchErodougazo(title);

    if (erodougazoResult.performers.length > 0) {
      console.log(`✅ erodougazo: ${erodougazoResult.performers.join(', ')} (作品: ${erodougazoResult.productTitle?.substring(0, 30)}...)`);
    } else {
      console.log(`❌ erodougazo: 該当なし`);
    }

    await new Promise(r => setTimeout(r, 2000));

    // 方法3: seesaawikiで女優名直接検索
    console.log('\n【方法3: seesaawiki女優名直接検索】');
    const candidates = extractPerformerFromTitle(title);
    let seesaaFound = false;
    for (const candidate of candidates) {
      const seesaaResult = await searchSeesaaWikiByName(candidate);
      if (seesaaResult.found) {
        console.log(`✅ seesaawiki: "${candidate}" ページ存在`);
        seesaaFound = true;
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!seesaaFound) {
      console.log(`❌ seesaawiki: 該当なし (候補: ${candidates.join(', ')})`);
    }

    await new Promise(r => setTimeout(r, 2000));
  }
}

main().catch(console.error);
