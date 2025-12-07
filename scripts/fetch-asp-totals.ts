/**
 * 各ASPのAPI/公式サイトから正確な商品総数を取得
 *
 * 使用方法: npx tsx scripts/fetch-asp-totals.ts
 */

import { getDugaClient } from '../lib/providers/duga-client';
import { getSokmilClient } from '../lib/providers/sokmil-client';
import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import puppeteer, { Browser } from 'puppeteer';

let browserInstance: Browser | null = null;

/**
 * Puppeteerブラウザインスタンスを取得（シングルトン）
 */
async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserInstance;
}

/**
 * ブラウザを閉じる
 */
async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Puppeteerを使ってSPAサイトから「XX本」パターンを抽出
 */
async function extractTotalWithPuppeteer(
  aspName: string,
  url: string
): Promise<ASPTotal | null> {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // ページ読み込み（最大30秒待機）
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // ページのテキスト全体を取得
    const content = await page.evaluate(() => document.body.innerText);
    await page.close();

    // 「XX本以上」「XX本公開」パターンを探す
    const patterns = [
      /(\d{1,2}),?(\d{3})本以上/,
      /(\d{1,2}),?(\d{3})本公開/,
      /(\d{1,2}),?(\d{3})本配信/,
      /作品数[：:]\s*(\d{1,2}),?(\d{3})/,
      /総数[：:]\s*(\d{1,2}),?(\d{3})/,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const totalStr = match[2] ? match[1] + match[2] : match[1];
        const total = parseInt(totalStr.replace(/,/g, ''));
        if (total > 100) {
          return {
            asp: aspName,
            apiTotal: total,
            dbCount: 0,
            coverage: '',
            source: `${url} (Puppeteer: ${total}本)`
          };
        }
      }
    }

    return null;
  } catch (e) {
    console.error(`Puppeteer error for ${aspName}:`, e);
    return null;
  }
}

interface ASPTotal {
  asp: string;
  apiTotal: number | null;
  dbCount: number;
  coverage: string;
  source: string;
  error?: string;
}

async function getDUGATotal(): Promise<ASPTotal> {
  try {
    const dugaClient = getDugaClient();
    const response = await dugaClient.getNewReleases(1, 0);
    const apiTotal = response.count;

    return {
      asp: 'DUGA',
      apiTotal,
      dbCount: 0,
      coverage: '',
      source: 'DUGA API (count)'
    };
  } catch (e) {
    return {
      asp: 'DUGA',
      apiTotal: null,
      dbCount: 0,
      coverage: '',
      source: 'エラー',
      error: String(e)
    };
  }
}

async function getSOKMILTotal(): Promise<ASPTotal> {
  try {
    const sokmilClient = getSokmilClient();
    const response = await sokmilClient.getNewReleases(1, 1);
    const apiTotal = response.totalCount || null;

    return {
      asp: 'SOKMIL',
      apiTotal,
      dbCount: 0,
      coverage: '',
      source: 'SOKMIL API (totalCount)'
    };
  } catch (e) {
    return {
      asp: 'SOKMIL',
      apiTotal: null,
      dbCount: 0,
      coverage: '',
      source: 'エラー',
      error: String(e)
    };
  }
}

async function getHEYZOTotal(): Promise<ASPTotal> {
  try {
    // HEYZOは連番IDで0001から開始
    // 最新のページを取得して、現在の最大番号を推定
    const response = await fetch('https://www.heyzo.com/listpages/all_1.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    const html = await response.text();

    // "movies/XXXX" 形式のリンクから最大ID番号を取得
    const movieMatches = html.matchAll(/\/moviepages\/(\d+)\//g);
    let maxId = 0;
    for (const match of movieMatches) {
      const id = parseInt(match[1]);
      if (id > maxId) maxId = id;
    }

    if (maxId > 0) {
      return {
        asp: 'HEYZO',
        apiTotal: maxId,
        dbCount: 0,
        coverage: '',
        source: `heyzo.com (最大ID: ${maxId})`
      };
    }

    // フォールバック: ページネーションから推定
    const pageMatches = html.matchAll(/all_(\d+)\.html/g);
    let maxPage = 1;
    for (const match of pageMatches) {
      const page = parseInt(match[1]);
      if (page > maxPage) maxPage = page;
    }
    const apiTotal = maxPage * 12;

    return {
      asp: 'HEYZO',
      apiTotal,
      dbCount: 0,
      coverage: '',
      source: `heyzo.com (${maxPage}ページ x 12件)`
    };
  } catch (e) {
    return {
      asp: 'HEYZO',
      apiTotal: null,
      dbCount: 0,
      coverage: '',
      source: 'エラー',
      error: String(e)
    };
  }
}

async function getCaribbeancomPremiumTotal(): Promise<ASPTotal> {
  // カリビアンコムプレミアムはリージョン制限があるため、DBのmax original_product_idから推定
  // ID形式: MMDDYY_NNN (例: 122024_001)
  // 2007年頃から開始、月10-15本程度のリリースとして約6000本程度と推定
  return {
    asp: 'カリビアンコムプレミアム',
    apiTotal: 6000, // 推定値
    dbCount: 0,
    coverage: '',
    source: '推定 (リージョン制限あり)'
  };
}

async function getB10FTotal(): Promise<ASPTotal> {
  try {
    // b10fはCSVをダウンロードして行数をカウント
    const B10F_AFFILIATE_ID = process.env.B10F_AFFILIATE_ID || '11209';
    const url = `https://b10f.jp/csv_home.php?all=1&atype=${B10F_AFFILIATE_ID}&nosep=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const csv = await response.text();
    const lines = csv.split('\n').filter(line => line.trim().length > 0);
    const apiTotal = lines.length - 1; // ヘッダー行を除く

    return {
      asp: 'b10f',
      apiTotal,
      dbCount: 0,
      coverage: '',
      source: `b10f.jp CSV (${apiTotal.toLocaleString()}行)`
    };
  } catch (e) {
    return {
      asp: 'b10f',
      apiTotal: null,
      dbCount: 0,
      coverage: '',
      source: 'エラー',
      error: String(e)
    };
  }
}

async function getMGSTotal(): Promise<ASPTotal> {
  try {
    // MGS一覧ページから総件数を取得
    const response = await fetch('https://www.mgstage.com/search/cSearch.php?search_word=&sort=new&list_cnt=30', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'adc=1', // 年齢確認Cookie
      },
    });
    const html = await response.text();

    // 総件数パターン: "全XX件" または "約XX件" または "XX件"
    const patterns = [
      /全\s*([\d,]+)\s*件/,
      /約\s*([\d,]+)\s*件/,
      /([\d,]+)\s*件の商品/,
      /検索結果[：:]\s*([\d,]+)/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        const total = parseInt(match[1].replace(/,/g, ''));
        if (total > 10000) { // 妥当性チェック
          return {
            asp: 'MGS',
            apiTotal: total,
            dbCount: 0,
            coverage: '',
            source: 'mgstage.com (検索結果)'
          };
        }
      }
    }

    // ページネーションから最終ページを取得して推定
    const lastPageMatch = html.match(/page=(\d+)[^>]*>\s*(?:最後|Last|»)/i);
    if (lastPageMatch) {
      const lastPage = parseInt(lastPageMatch[1]);
      const itemsPerPage = 120; // MGSのデフォルト
      const apiTotal = lastPage * itemsPerPage;
      return {
        asp: 'MGS',
        apiTotal,
        dbCount: 0,
        coverage: '',
        source: `mgstage.com (${lastPage}ページ x ${itemsPerPage}件)`
      };
    }

    return {
      asp: 'MGS',
      apiTotal: null,
      dbCount: 0,
      coverage: '',
      source: 'mgstage.com (パターン不一致)'
    };
  } catch (e) {
    return {
      asp: 'MGS',
      apiTotal: null,
      dbCount: 0,
      coverage: '',
      source: 'エラー',
      error: String(e)
    };
  }
}

async function getJapanskaTotal(): Promise<ASPTotal> {
  try {
    // Step 1: トップページからtermid cookieを取得
    const homeRes = await fetch('https://www.japanska-xxx.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    const setCookie = homeRes.headers.get('set-cookie');
    const termidMatch = setCookie?.match(/termid=([^;]+)/);
    const termid = termidMatch ? termidMatch[1] : '';

    // Step 2: termidを使って一覧ページにアクセス
    const response = await fetch('https://www.japanska-xxx.com/category/list_0.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': `termid=${termid}`,
        'Referer': 'https://www.japanska-xxx.com/',
      },
    });
    const html = await response.text();

    // 動画URLから最大IDを取得 movie/detail_XXXXX.html 形式
    const movieMatches = html.matchAll(/movie\/detail_(\d+)\.html/g);
    let maxId = 0;
    for (const match of movieMatches) {
      const id = parseInt(match[1]);
      if (id > maxId) maxId = id;
    }

    if (maxId > 30000) { // 妥当性チェック (少なくとも3万以上)
      return {
        asp: 'Japanska',
        apiTotal: maxId,
        dbCount: 0,
        coverage: '',
        source: `japanska-xxx.com (最大ID: ${maxId})`
      };
    }

    // ページネーションから推定
    const pageMatches = html.matchAll(/list_(\d+)\.html/g);
    let maxPage = 0;
    for (const match of pageMatches) {
      const page = parseInt(match[1]);
      if (page > maxPage) maxPage = page;
    }

    if (maxPage > 100) {
      const apiTotal = maxPage * 30; // 1ページ約30件と仮定
      return {
        asp: 'Japanska',
        apiTotal,
        dbCount: 0,
        coverage: '',
        source: `japanska-xxx.com (${maxPage}ページ x 30件)`
      };
    }

    return {
      asp: 'Japanska',
      apiTotal: null,
      dbCount: 0,
      coverage: '',
      source: 'japanska-xxx.com (パターン不一致)'
    };
  } catch (e) {
    return {
      asp: 'Japanska',
      apiTotal: null,
      dbCount: 0,
      coverage: '',
      source: 'エラー',
      error: String(e)
    };
  }
}

// ==================================================================
// DTI系サイト (Site ID: 6, 18, 21, 262, 286, 292, 318, 320, 352, 363, 365, 372, 507, 520, 522, 523)
// ==================================================================

/**
 * DTIサイト共通: 最大IDまたはページネーションから総数を取得
 */
async function getDTISiteTotal(
  aspName: string,
  baseUrl: string,
  listPath: string,
  movieIdPattern: RegExp,
  pagePattern?: RegExp
): Promise<ASPTotal> {
  try {
    const response = await fetch(`${baseUrl}${listPath}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return {
        asp: aspName,
        apiTotal: null,
        dbCount: 0,
        coverage: '',
        source: `HTTP ${response.status}`,
      };
    }

    const html = await response.text();

    // 最大IDを探す
    const movieMatches = html.matchAll(movieIdPattern);
    let maxId = 0;
    for (const match of movieMatches) {
      const id = parseInt(match[1]);
      if (id > maxId) maxId = id;
    }

    if (maxId > 100) {
      return {
        asp: aspName,
        apiTotal: maxId,
        dbCount: 0,
        coverage: '',
        source: `${baseUrl} (最大ID: ${maxId})`
      };
    }

    // ページネーションから推定
    if (pagePattern) {
      const pageMatches = html.matchAll(pagePattern);
      let maxPage = 0;
      for (const match of pageMatches) {
        const page = parseInt(match[1]);
        if (page > maxPage) maxPage = page;
      }
      if (maxPage > 10) {
        const apiTotal = maxPage * 20; // 1ページ約20件と仮定
        return {
          asp: aspName,
          apiTotal,
          dbCount: 0,
          coverage: '',
          source: `${baseUrl} (${maxPage}ページ x 20件)`
        };
      }
    }

    return {
      asp: aspName,
      apiTotal: null,
      dbCount: 0,
      coverage: '',
      source: `${baseUrl} (パターン不一致)`
    };
  } catch (e) {
    return {
      asp: aspName,
      apiTotal: null,
      dbCount: 0,
      coverage: '',
      source: 'エラー',
      error: String(e)
    };
  }
}

// カリビアンコム (Site ID: 6)
async function getCaribbeancomTotal(): Promise<ASPTotal> {
  return getDTISiteTotal(
    'カリビアンコム',
    'https://www.caribbeancom.com',
    '/listpages/all1.htm',
    /\/moviepages\/(\d{6}_\d{3})\//g,
    /all(\d+)\.htm/g
  );
}

/**
 * HTMLからmeta descriptionの「XX本」パターンを抽出
 */
async function extractTotalFromMetaDescription(
  aspName: string,
  url: string
): Promise<ASPTotal | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // meta descriptionから「XX本」パターンを探す
    const descMatch = html.match(/content="[^"]*?(\d{1,5}),?(\d{3})?本[^"]*"/i);
    if (descMatch) {
      // 「3,000本」や「3000本」のパターンに対応
      const totalStr = descMatch[2] ? descMatch[1] + descMatch[2] : descMatch[1];
      const total = parseInt(totalStr.replace(/,/g, ''));
      if (total > 100) {
        return {
          asp: aspName,
          apiTotal: total,
          dbCount: 0,
          coverage: '',
          source: `${url} (meta description: ${total}本)`
        };
      }
    }

    // HTML全体から「XX本以上」「XX本公開」パターンを探す
    const bodyMatch = html.match(/(\d{1,5}),?(\d{3})?本(?:以上|公開)/);
    if (bodyMatch) {
      const totalStr = bodyMatch[2] ? bodyMatch[1] + bodyMatch[2] : bodyMatch[1];
      const total = parseInt(totalStr.replace(/,/g, ''));
      if (total > 100) {
        return {
          asp: aspName,
          apiTotal: total,
          dbCount: 0,
          coverage: '',
          source: `${url} (HTML: ${total}本)`
        };
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

// 一本道 (Site ID: 18) - meta descriptionまたはPuppeteerからスクレイピング
async function get1PondoTotal(): Promise<ASPTotal> {
  // まず単純なfetchを試す（1pondoは初期HTMLにmeta descriptionがある）
  const simpleScrape = await extractTotalFromMetaDescription('一本道', 'https://www.1pondo.tv/');
  if (simpleScrape) {
    return simpleScrape;
  }

  // Puppeteerでスクレイピング
  const scraped = await extractTotalWithPuppeteer('一本道', 'https://www.1pondo.tv/');
  if (scraped) {
    return scraped;
  }

  // フォールバック: 推定値
  return {
    asp: '一本道',
    apiTotal: 3000,
    dbCount: 0,
    coverage: '',
    source: '1pondo.tv (推定値)'
  };
}

// 天然むすめ (Site ID: 292) - Puppeteerでスクレイピング
async function get10MusumeTotal(): Promise<ASPTotal> {
  // Puppeteerでスクレイピング（SPA対応）
  const scraped = await extractTotalWithPuppeteer('天然むすめ', 'https://www.10musume.com/');
  if (scraped) {
    return scraped;
  }

  return {
    asp: '天然むすめ',
    apiTotal: 3500,
    dbCount: 0,
    coverage: '',
    source: '10musume.com (推定値)'
  };
}

// パコパコママ (Site ID: 320) - Puppeteerでスクレイピング
async function getPacopacomamaTotal(): Promise<ASPTotal> {
  const scraped = await extractTotalWithPuppeteer('パコパコママ', 'https://www.pacopacomama.com/');
  if (scraped) {
    return scraped;
  }

  return {
    asp: 'パコパコママ',
    apiTotal: 3000,
    dbCount: 0,
    coverage: '',
    source: 'pacopacomama.com (推定値)'
  };
}

// 人妻斬り (Site ID: 318) - Puppeteerでスクレイピング
async function getHitozumagiriTotal(): Promise<ASPTotal> {
  const scraped = await extractTotalWithPuppeteer('人妻斬り', 'https://www.hitozuma-giri.com/');
  if (scraped) {
    return scraped;
  }

  return {
    asp: '人妻斬り',
    apiTotal: 1500,
    dbCount: 0,
    coverage: '',
    source: 'hitozuma-giri.com (推定値)'
  };
}

// エッチな4610 (Site ID: 262) - Puppeteerでスクレイピング
async function get4610Total(): Promise<ASPTotal> {
  const scraped = await extractTotalWithPuppeteer('エッチな4610', 'https://www.h4610.com/');
  if (scraped) {
    return scraped;
  }

  return {
    asp: 'エッチな4610',
    apiTotal: 3000,
    dbCount: 0,
    coverage: '',
    source: 'h4610.com (推定値)'
  };
}

// エッチな0930 (Site ID: 286) - Puppeteerでスクレイピング
async function get0930Total(): Promise<ASPTotal> {
  const scraped = await extractTotalWithPuppeteer('エッチな0930', 'https://www.h0930.com/');
  if (scraped) {
    return scraped;
  }

  return {
    asp: 'エッチな0930',
    apiTotal: 4000,
    dbCount: 0,
    coverage: '',
    source: 'h0930.com (推定値)'
  };
}

// av9898 (Site ID: 363) - 統合サイトのためHey動画経由
async function getAv9898Total(): Promise<ASPTotal> {
  // av9898は現在Hey動画に統合されている
  return {
    asp: 'av9898',
    apiTotal: null,
    dbCount: 0,
    coverage: '',
    source: 'Hey動画に統合'
  };
}

// Hey動画 (Site ID: 352) - 特殊なプラットフォーム
async function getHeyDoTotal(): Promise<ASPTotal> {
  // Hey動画は複数サイトのアグリゲーターなので総数を直接取得困難
  // 推定値を使用
  return {
    asp: 'Hey動画',
    apiTotal: 50000, // 多数のサイトからのアグリゲーション
    dbCount: 0,
    coverage: '',
    source: 'heydouga.com (推定値 - アグリゲーター)'
  };
}

// ムラムラってくる素人 (Site ID: 365) - Puppeteerでスクレイピング
async function getMuramuraTotal(): Promise<ASPTotal> {
  const scraped = await extractTotalWithPuppeteer('ムラムラってくる素人', 'https://www.muramura.tv/');
  if (scraped) {
    return scraped;
  }

  return {
    asp: 'ムラムラってくる素人',
    apiTotal: 2500,
    dbCount: 0,
    coverage: '',
    source: 'muramura.tv (推定値)'
  };
}

// X-Gallery (Site ID: 21), どこでも動画 (Site ID: 372), 新作アダルト見放題プラン (Site ID: 507),
// Hey動画見放題プラン (Site ID: 520), Pikkur (Site ID: 522), アボッド単品購入 (Site ID: 523)
// これらはサブスクや特殊サービスのため個別取得は難しい
async function getOtherDTISitesEstimates(): Promise<ASPTotal[]> {
  return [
    {
      asp: 'X-Gallery',
      apiTotal: null,
      dbCount: 0,
      coverage: '',
      source: '個別サイト(総数取得困難)'
    },
    {
      asp: 'どこでも動画',
      apiTotal: null,
      dbCount: 0,
      coverage: '',
      source: 'サブスクサービス'
    },
    {
      asp: '新作アダルト見放題プラン',
      apiTotal: null,
      dbCount: 0,
      coverage: '',
      source: 'サブスクサービス'
    },
    {
      asp: 'Hey動画見放題プラン',
      apiTotal: null,
      dbCount: 0,
      coverage: '',
      source: 'サブスクサービス'
    },
    {
      asp: 'Pikkur',
      apiTotal: null,
      dbCount: 0,
      coverage: '',
      source: '個別サイト(総数取得困難)'
    },
    {
      asp: 'アボッド単品購入',
      apiTotal: null,
      dbCount: 0,
      coverage: '',
      source: '個別サイト(総数取得困難)'
    },
  ];
}

async function main() {
  console.log('=== 各ASP商品総数の取得中... ===\n');

  // 既存ASP + DTI系サイトから総数を取得
  const [
    duga, sokmil, heyzo, caribpr, b10f, mgs, japanska,
    // DTI系サイト
    caribbeancom, onepondo, tenmusume, pacopacomama, hitozumagiri,
    h4610, h0930, av9898, heydouga, muramura
  ] = await Promise.all([
    getDUGATotal(),
    getSOKMILTotal(),
    getHEYZOTotal(),
    getCaribbeancomPremiumTotal(),
    getB10FTotal(),
    getMGSTotal(),
    getJapanskaTotal(),
    // DTI系サイト
    getCaribbeancomTotal(),
    get1PondoTotal(),
    get10MusumeTotal(),
    getPacopacomamaTotal(),
    getHitozumagiriTotal(),
    get4610Total(),
    get0930Total(),
    getAv9898Total(),
    getHeyDoTotal(),
    getMuramuraTotal(),
  ]);

  // その他DTIサービス(サブスク等)
  const otherDTISites = await getOtherDTISitesEstimates();

  const results = [
    duga, sokmil, heyzo, caribpr, b10f, mgs, japanska,
    caribbeancom, onepondo, tenmusume, pacopacomama, hitozumagiri,
    h4610, h0930, av9898, heydouga, muramura,
    ...otherDTISites
  ];

  // DBの件数を取得
  const db = getDb();
  const dbStats = await db.execute(sql`
    SELECT
      asp_name,
      COUNT(*)::int as db_count
    FROM product_sources
    GROUP BY asp_name
  `);

  const dbCounts: Record<string, number> = {};
  for (const row of dbStats.rows) {
    const r = row as { asp_name: string; db_count: number };
    dbCounts[r.asp_name] = r.db_count;
  }

  // 結果にDB件数を追加
  for (const result of results) {
    result.dbCount = dbCounts[result.asp] || 0;
    if (result.apiTotal !== null && result.apiTotal > 0) {
      const pct = (result.dbCount / result.apiTotal * 100).toFixed(1);
      result.coverage = `${pct}%`;
    } else {
      result.coverage = '-';
    }
  }

  // テーブル出力
  console.log('| ASP | API総数 | DB件数 | 充足率 | ソース |');
  console.log('|-----|---------|--------|--------|--------|');

  for (const result of results) {
    const apiStr = result.apiTotal !== null ? result.apiTotal.toLocaleString() : '-';
    const dbStr = result.dbCount.toLocaleString();
    const note = result.error ? ` (${result.error.slice(0, 30)})` : '';
    console.log(
      `| ${result.asp.padEnd(20)} | ${apiStr.padStart(8)} | ${dbStr.padStart(8)} | ${result.coverage.padStart(6)} | ${result.source}${note} |`
    );
  }

  // JSON出力
  console.log('\n=== JSON ===');
  console.log(JSON.stringify(results, null, 2));

  // ブラウザをクリーンアップ
  await closeBrowser();

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
