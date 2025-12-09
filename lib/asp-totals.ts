/**
 * ASP別商品総数取得ライブラリ
 *
 * 各ASPのAPI/公式サイトから正確な商品総数を取得
 * 管理APIおよびクローラから利用可能
 */

import { getDugaClient } from './providers/duga-client';
import { getSokmilClient } from './providers/sokmil-client';

export interface ASPTotal {
  asp: string;
  apiTotal: number | null;
  source: string;
  error?: string;
}

// キャッシュ (1時間)
let cachedTotals: ASPTotal[] | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1時間

/**
 * DUGA API経由で総数を取得
 */
export async function getDUGATotal(): Promise<ASPTotal> {
  try {
    const dugaClient = getDugaClient();
    const response = await dugaClient.getNewReleases(1, 0);
    return {
      asp: 'DUGA',
      apiTotal: response.count,
      source: 'DUGA API (count)'
    };
  } catch (e) {
    return {
      asp: 'DUGA',
      apiTotal: null,
      source: 'エラー',
      error: String(e)
    };
  }
}

/**
 * SOKMIL API経由で総数を取得
 */
export async function getSOKMILTotal(): Promise<ASPTotal> {
  try {
    const sokmilClient = getSokmilClient();
    // hits=1で最小限のデータ取得、totalCountのみ必要
    const response = await sokmilClient.searchItems({ hits: 1, category: 'av' });
    // APIエラー時はtotalCountが0になることがある
    if (response.totalCount > 0) {
      return {
        asp: 'SOKMIL',
        apiTotal: response.totalCount,
        source: 'SOKMIL API (total_count)'
      };
    }
    // APIエラーまたは無効な応答時はフォールバック
    return {
      asp: 'SOKMIL',
      apiTotal: 150000, // 推定値
      source: 'sokmil.com (推定値)'
    };
  } catch (e) {
    return {
      asp: 'SOKMIL',
      apiTotal: 150000, // 推定値
      source: 'sokmil.com (推定値)',
      error: String(e)
    };
  }
}

/**
 * b10f CSVから行数を取得
 */
export async function getB10FTotal(): Promise<ASPTotal> {
  try {
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
    const apiTotal = lines.length - 1;

    return {
      asp: 'b10f',
      apiTotal,
      source: `b10f.jp CSV (${apiTotal.toLocaleString()}行)`
    };
  } catch (e) {
    return {
      asp: 'b10f',
      apiTotal: null,
      source: 'エラー',
      error: String(e)
    };
  }
}

/**
 * HEYZO HTMLから最大IDを取得
 */
export async function getHEYZOTotal(): Promise<ASPTotal> {
  try {
    const response = await fetch('https://www.heyzo.com/listpages/all_1.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    const html = await response.text();

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
        source: `heyzo.com (最大ID: ${maxId})`
      };
    }

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
      source: `heyzo.com (${maxPage}ページ x 12件)`
    };
  } catch (e) {
    return {
      asp: 'HEYZO',
      apiTotal: null,
      source: 'エラー',
      error: String(e)
    };
  }
}

/**
 * MGS HTMLからページネーション推定
 */
export async function getMGSTotal(): Promise<ASPTotal> {
  try {
    const response = await fetch('https://www.mgstage.com/search/cSearch.php?search_word=&sort=new&list_cnt=30', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'adc=1',
      },
    });
    const html = await response.text();

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
        if (total > 10000) {
          return {
            asp: 'MGS',
            apiTotal: total,
            source: 'mgstage.com (検索結果)'
          };
        }
      }
    }

    const lastPageMatch = html.match(/page=(\d+)[^>]*>\s*(?:最後|Last|»)/i);
    if (lastPageMatch) {
      const lastPage = parseInt(lastPageMatch[1]);
      const itemsPerPage = 120;
      const apiTotal = lastPage * itemsPerPage;
      return {
        asp: 'MGS',
        apiTotal,
        source: `mgstage.com (${lastPage}ページ x ${itemsPerPage}件)`
      };
    }

    return {
      asp: 'MGS',
      apiTotal: null,
      source: 'mgstage.com (パターン不一致)'
    };
  } catch (e) {
    return {
      asp: 'MGS',
      apiTotal: null,
      source: 'エラー',
      error: String(e)
    };
  }
}

/**
 * Japanska HTMLから最大IDを取得
 */
export async function getJapanskaTotal(): Promise<ASPTotal> {
  // 推定値として約37,000件（2024年末時点の推定）
  const FALLBACK_ESTIMATE = 37000;

  try {
    // タイムアウト付きでfetch
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト

    const homeRes = await fetch('https://www.japanska-xxx.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const setCookie = homeRes.headers.get('set-cookie');
    const termidMatch = setCookie?.match(/termid=([^;]+)/);
    const termid = termidMatch ? termidMatch[1] : '';

    const controller2 = new AbortController();
    const timeout2 = setTimeout(() => controller2.abort(), 10000);

    const response = await fetch('https://www.japanska-xxx.com/category/list_0.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': `termid=${termid}`,
        'Referer': 'https://www.japanska-xxx.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
      signal: controller2.signal,
    });
    clearTimeout(timeout2);

    if (!response.ok) {
      return {
        asp: 'Japanska',
        apiTotal: FALLBACK_ESTIMATE,
        source: `japanska-xxx.com (推定値, HTTP ${response.status})`
      };
    }

    const html = await response.text();

    // 動画IDパターン（より柔軟に）
    const movieMatches = html.matchAll(/movie\/detail_(\d+)\.html/g);
    let maxId = 0;
    for (const match of movieMatches) {
      const id = parseInt(match[1]);
      if (id > maxId) maxId = id;
    }

    // 最大IDが見つかった場合（より緩い条件）
    if (maxId > 1000) {
      return {
        asp: 'Japanska',
        apiTotal: maxId,
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

    // ページ数から推定（より緩い条件）
    if (maxPage > 10) {
      const apiTotal = maxPage * 30;
      return {
        asp: 'Japanska',
        apiTotal,
        source: `japanska-xxx.com (${maxPage}ページ x 30件)`
      };
    }

    // パターン不一致でも推定値を返す
    return {
      asp: 'Japanska',
      apiTotal: FALLBACK_ESTIMATE,
      source: 'japanska-xxx.com (推定値)'
    };
  } catch (e) {
    // エラー時も推定値を返す
    return {
      asp: 'Japanska',
      apiTotal: FALLBACK_ESTIMATE,
      source: 'japanska-xxx.com (推定値)',
      error: String(e)
    };
  }
}

/**
 * カリビアンコム HTMLから最大IDを取得
 */
export async function getCaribbeancomTotal(): Promise<ASPTotal> {
  try {
    const response = await fetch('https://www.caribbeancom.com/listpages/all1.htm', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return {
        asp: 'カリビアンコム',
        apiTotal: null,
        source: `HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    const movieMatches = html.matchAll(/\/moviepages\/(\d{6}_\d{3})\//g);
    let maxId = 0;
    for (const match of movieMatches) {
      const id = parseInt(match[1].replace('_', ''));
      if (id > maxId) maxId = id;
    }

    if (maxId > 100) {
      return {
        asp: 'カリビアンコム',
        apiTotal: maxId,
        source: `caribbeancom.com (最大ID: ${maxId})`
      };
    }

    return {
      asp: 'カリビアンコム',
      apiTotal: null,
      source: 'caribbeancom.com (パターン不一致)'
    };
  } catch (e) {
    return {
      asp: 'カリビアンコム',
      apiTotal: null,
      source: 'エラー',
      error: String(e)
    };
  }
}

/**
 * 一本道 meta descriptionからスクレイピング
 */
export async function get1PondoTotal(): Promise<ASPTotal> {
  try {
    const response = await fetch('https://www.1pondo.tv/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return { asp: '一本道', apiTotal: 3000, source: '1pondo.tv (推定値)' };
    }

    const html = await response.text();

    const descMatch = html.match(/content="[^"]*?(\d{1,5}),?(\d{3})?本[^"]*"/i);
    if (descMatch) {
      const totalStr = descMatch[2] ? descMatch[1] + descMatch[2] : descMatch[1];
      const total = parseInt(totalStr.replace(/,/g, ''));
      if (total > 100) {
        return {
          asp: '一本道',
          apiTotal: total,
          source: `1pondo.tv (HTML: ${total}本)`
        };
      }
    }

    const bodyMatch = html.match(/(\d{1,5}),?(\d{3})?本(?:以上|公開)/);
    if (bodyMatch) {
      const totalStr = bodyMatch[2] ? bodyMatch[1] + bodyMatch[2] : bodyMatch[1];
      const total = parseInt(totalStr.replace(/,/g, ''));
      if (total > 100) {
        return {
          asp: '一本道',
          apiTotal: total,
          source: `1pondo.tv (HTML: ${total}本)`
        };
      }
    }

    return { asp: '一本道', apiTotal: 3000, source: '1pondo.tv (推定値)' };
  } catch (e) {
    return { asp: '一本道', apiTotal: 3000, source: '1pondo.tv (推定値)' };
  }
}

/**
 * 推定値を返すDTIサイト用のヘルパー
 */
function createEstimateTotal(asp: string, estimate: number, site: string): ASPTotal {
  return {
    asp,
    apiTotal: estimate,
    source: `${site} (推定値)`
  };
}

/**
 * 全ASPの総数を取得（キャッシュあり）
 */
export async function getAllASPTotals(forceRefresh = false): Promise<ASPTotal[]> {
  const now = Date.now();

  if (!forceRefresh && cachedTotals && now - cacheTime < CACHE_TTL) {
    return cachedTotals;
  }

  // 並列で取得可能なものを取得
  const [duga, b10f, heyzo, mgs, japanska, caribbeancom, onepondo, sokmil] = await Promise.all([
    getDUGATotal(),
    getB10FTotal(),
    getHEYZOTotal(),
    getMGSTotal(),
    getJapanskaTotal(),
    getCaribbeancomTotal(),
    get1PondoTotal(),
    getSOKMILTotal(),
  ]);

  // 推定値のみのサイト
  const estimates: ASPTotal[] = [
    createEstimateTotal('カリビアンコムプレミアム', 6000, 'caribbeancompr.com'),
    createEstimateTotal('天然むすめ', 3500, '10musume.com'),
    createEstimateTotal('パコパコママ', 3000, 'pacopacomama.com'),
    createEstimateTotal('人妻斬り', 1500, 'hitozuma-giri.com'),
    createEstimateTotal('エッチな4610', 3000, 'h4610.com'),
    createEstimateTotal('エッチな0930', 4000, 'h0930.com'),
    createEstimateTotal('ムラムラってくる素人', 2500, 'muramura.tv'),
    createEstimateTotal('Hey動画', 50000, 'heydouga.com'),
    createEstimateTotal('FC2', 500000, 'fc2.com'),
  ];

  cachedTotals = [duga, b10f, heyzo, mgs, japanska, caribbeancom, onepondo, sokmil, ...estimates];
  cacheTime = now;

  return cachedTotals;
}

/**
 * ASP名から推定総数を取得
 */
export async function getASPEstimate(aspName: string): Promise<number | null> {
  const totals = await getAllASPTotals();

  // DTI形式の変換
  const normalizedName = aspName.replace('DTI: ', '');

  const found = totals.find(t =>
    t.asp === aspName ||
    t.asp === normalizedName ||
    t.asp.toLowerCase() === normalizedName.toLowerCase()
  );

  return found?.apiTotal ?? null;
}

/**
 * ASP名とDB名のマッピング
 */
export function mapDBNameToASPName(dbName: string): string {
  // DTI: プレフィックスを処理
  if (dbName.startsWith('DTI: ')) {
    const subService = dbName.replace('DTI: ', '');
    // サブサービス名をマッピング
    const mapping: Record<string, string> = {
      'HEYZO': 'HEYZO',
      'カリビアンコムプレミアム': 'カリビアンコムプレミアム',
      'カリビアンコム': 'カリビアンコム',
      '一本道': '一本道',
      '天然むすめ': '天然むすめ',
      'パコパコママ': 'パコパコママ',
      '人妻斬り': '人妻斬り',
      'エッチな4610': 'エッチな4610',
      'エッチな0930': 'エッチな0930',
      'ムラムラってくる素人': 'ムラムラってくる素人',
      'Hey動画': 'Hey動画',
    };
    return mapping[subService] || subService;
  }
  return dbName;
}
