/**
 * Image URL utility functions
 */

const PLACEHOLDER_URL = 'https://placehold.co/400x520/052e16/ffffff?text=No+Image';

/**
 * Extract image URL from broken HTML string (e.g., containing <img src="...">)
 * @param url - The potentially malformed URL string
 * @returns Extracted URL or null if not found
 */
function extractImageUrlFromHtml(url: string): string | null {
  // Pattern to extract src attribute from img tag
  const srcMatch = url.match(/src=["']([^"']+)["']/);
  if (srcMatch && srcMatch[1]) {
    return srcMatch[1];
  }
  return null;
}

/**
 * Check if URL is valid (not containing HTML tags or invalid format)
 * @param url - The URL to validate
 * @returns true if URL is valid
 */
function isValidUrl(url: string): boolean {
  // Reject URLs containing HTML tags
  if (url.includes('<') || url.includes('>')) {
    return false;
  }
  // Basic URL format check
  try {
    const parsed = new URL(url.startsWith('//') ? `https:${url}` : url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalize protocol-relative URLs to absolute URLs
 * Converts URLs starting with "//" to "https://"
 * Also validates URLs and returns placeholder for invalid ones
 * @param url - The URL to normalize (can be null or undefined)
 * @returns Normalized URL or fallback placeholder
 */
export function normalizeImageUrl(url: string | null | undefined): string {
  // Return placeholder if URL is missing
  if (!url || url.trim() === '') {
    return PLACEHOLDER_URL;
  }

  let processedUrl = url;

  // Try to extract URL from HTML tags if present (e.g., broken crawler data)
  if (url.includes('<') || url.includes('>')) {
    const extracted = extractImageUrlFromHtml(url);
    if (extracted && isValidUrl(extracted)) {
      processedUrl = extracted;
    } else {
      return PLACEHOLDER_URL;
    }
  }

  // Return placeholder if URL is invalid
  if (!isValidUrl(processedUrl)) {
    return PLACEHOLDER_URL;
  }

  // Convert protocol-relative URLs (//domain.com/path) to absolute URLs (https://domain.com/path)
  if (processedUrl.startsWith('//')) {
    return `https:${processedUrl}`;
  }

  // Return URL as-is if already absolute
  return processedUrl;
}

/**
 * Get a fallback image URL for product cards
 * @returns Placeholder image URL
 */
export function getFallbackImageUrl(): string {
  return 'https://placehold.co/400x520/052e16/ffffff?text=No+Image';
}

/**
 * Convert thumbnail URL to full-size image URL
 * Supports all ASPs: DUGA, MGS, DMM/FANZA, Sokmil, DTI系(カリビアンコム、一本道、HEYZO等), b10f, Japanska, FC2
 * @param thumbnailUrl - The thumbnail URL
 * @returns Full-size image URL or original URL if conversion not possible
 */
export function getFullSizeImageUrl(thumbnailUrl: string): string {
  if (!thumbnailUrl) return thumbnailUrl;

  // ========== DUGA ==========
  // e.g., https://pic.duga.jp/unsecure/xxx-t.jpg -> https://pic.duga.jp/unsecure/xxx-l.jpg
  // scap (screen capture thumbnail) -> sample (high-res sample)
  // e.g., https://pic.duga.jp/unsecure/switch/1014/noauth/scap/0001.jpg -> .../sample/0001.jpg
  // e.g., https://pic.duga.jp/unsecure/mbm/1360/noauth/240x180.jpg -> 480x360.jpg (2x) or 640x480.jpg
  if (thumbnailUrl.includes('duga.jp')) {
    return thumbnailUrl
      .replace(/\/scap\//, '/sample/') // scap -> sample (高解像度サンプル画像)
      .replace(/\/240x180\.jpg$/, '/640x480.jpg') // サムネイル → 大きいサイズ
      .replace(/\/noauth\/240x180\.jpg/, '/noauth/640x480.jpg') // noauthパス含む場合
      .replace(/-t\./, '-l.')
      .replace(/_t\./, '_l.')
      .replace(/\/t\//, '/l/')
      .replace(/-s\./, '-l.')
      .replace(/_s\./, '_l.');
  }

  // ========== MGS動画 ==========
  // e.g., https://image.mgstage.com/images/xxx/pb_t1_xxx.jpg -> https://image.mgstage.com/images/xxx/pb_e_xxx.jpg
  if (thumbnailUrl.includes('mgstage.com')) {
    return thumbnailUrl
      .replace(/pb_t1_/, 'pb_e_')
      .replace(/pb_t_/, 'pb_e_')
      .replace(/_t\./, '.')
      .replace(/\/t\//, '/l/');
  }

  // ========== DMM/FANZA ==========
  // e.g., https://pics.dmm.co.jp/xxx/xxx-ps.jpg -> https://pics.dmm.co.jp/xxx/xxx-pl.jpg
  if (thumbnailUrl.includes('dmm.co.jp') || thumbnailUrl.includes('dmm.com')) {
    return thumbnailUrl
      .replace(/-ps\./, '-pl.')
      .replace(/-pt\./, '-pl.')
      .replace(/ps\.jpg/, 'pl.jpg')
      .replace(/pt\.jpg/, 'pl.jpg')
      .replace(/_s\./, '_l.')
      .replace(/\/s\//, '/l/');
  }

  // ========== Sokmil ==========
  // e.g., https://img.sokmil.com/xxx/s/xxx.jpg -> https://img.sokmil.com/xxx/l/xxx.jpg
  // e.g., pef_tak1656_01_100x142_xxx.jpg -> pef_tak1656_01_250x356_xxx.jpg (フルサイズ)
  if (thumbnailUrl.includes('sokmil.com')) {
    return thumbnailUrl
      .replace(/_s\./, '_l.')
      .replace(/-s\./, '-l.')
      .replace(/\/s\//, '/l/')
      .replace(/\/small\//, '/large/')
      .replace(/\/thumb\//, '/large/')
      .replace(/_100x142_/, '_250x356_') // サムネイル→フルサイズ
      .replace(/_200x284_/, '_250x356_'); // 中間サイズ→フルサイズ
  }

  // ========== b10f.jp ==========
  // e.g., https://b10f.jp/xxx/thumb/xxx.jpg -> https://b10f.jp/xxx/large/xxx.jpg
  // e.g., https://ads.b10f.jp/images/100-tfd-001/1s.jpg -> https://ads.b10f.jp/images/100-tfd-001/1.jpg
  // 注意: 1l.jpg はプレースホルダー（500バイト程度）なので使用不可。1.jpg が正しいフルサイズ（240KB程度）
  if (thumbnailUrl.includes('b10f.jp') || thumbnailUrl.includes('ads.b10f.jp')) {
    return thumbnailUrl
      .replace(/\/thumb\//, '/large/')
      .replace(/\/small\//, '/large/')
      .replace(/_s\./, '_l.')
      .replace(/-s\./, '-l.')
      .replace(/\/s\//, '/l/')
      .replace(/\/(\d+)s\.jpg$/, '/$1.jpg'); // 1s.jpg -> 1.jpg (1l.jpgはプレースホルダーなので使わない)
  }

  // ========== Japanska ==========
  // e.g., https://img01.japanska-xxx.com/xxx/s/xxx.jpg -> https://img01.japanska-xxx.com/xxx/l/xxx.jpg
  if (thumbnailUrl.includes('japanska-xxx.com') || thumbnailUrl.includes('japanska.com')) {
    return thumbnailUrl
      .replace(/\/s\//, '/l/')
      .replace(/_s\./, '_l.')
      .replace(/-s\./, '-l.')
      .replace(/\/thumb\//, '/large/')
      .replace(/\/small\//, '/large/');
  }

  // ========== FC2 ==========
  // サイズ指定のURLパラメータを除去して元画像を取得
  if (thumbnailUrl.includes('fc2.com') || thumbnailUrl.includes('contents.fc2.com')) {
    return thumbnailUrl
      .replace(/[?&]w=\d+/g, '')
      .replace(/[?&]h=\d+/g, '')
      .replace(/\/s\//, '/l/')
      .replace(/_s\./, '_l.')
      .replace(/\/thumb\//, '/large/');
  }

  // ========== DTI系サイト ==========
  // カリビアンコム (caribbeancom.com)
  if (thumbnailUrl.includes('caribbeancom.com') && !thumbnailUrl.includes('caribbeancompr')) {
    return thumbnailUrl
      .replace(/\/s\//, '/l/')
      .replace(/_s\./, '_l.')
      .replace(/-s\./, '-l.')
      .replace(/\/images\//, '/images/l/')
      .replace(/\/small\//, '/large/');
  }

  // カリビアンコムプレミアム (caribbeancompr.com)
  if (thumbnailUrl.includes('caribbeancompr.com')) {
    return thumbnailUrl
      .replace(/\/s\//, '/l/')
      .replace(/_s\./, '_l.')
      .replace(/-s\./, '-l.')
      .replace(/\/small\//, '/large/');
  }

  // 一本道 (1pondo.tv)
  if (thumbnailUrl.includes('1pondo.tv')) {
    return thumbnailUrl
      .replace(/\/s\//, '/l/')
      .replace(/_s\./, '_l.')
      .replace(/-s\./, '-l.')
      .replace(/\/small\//, '/large/');
  }

  // HEYZO (heyzo.com)
  if (thumbnailUrl.includes('heyzo.com')) {
    return thumbnailUrl
      .replace(/_s\./, '_l.')
      .replace(/\/s\//, '/l/')
      .replace(/-s\./, '-l.')
      .replace(/\/small\//, '/large/');
  }

  // 天然むすめ (10musume.com)
  if (thumbnailUrl.includes('10musume.com')) {
    return thumbnailUrl
      .replace(/\/s\//, '/l/')
      .replace(/_s\./, '_l.')
      .replace(/-s\./, '-l.')
      .replace(/\/small\//, '/large/');
  }

  // パコパコママ (pacopacomama.com)
  if (thumbnailUrl.includes('pacopacomama.com')) {
    return thumbnailUrl
      .replace(/\/s\//, '/l/')
      .replace(/_s\./, '_l.')
      .replace(/-s\./, '-l.')
      .replace(/\/small\//, '/large/');
  }

  // 人妻斬り (hitozuma-giri.com)
  if (thumbnailUrl.includes('hitozuma-giri.com')) {
    return thumbnailUrl.replace(/\/s\//, '/l/').replace(/_s\./, '_l.').replace(/-s\./, '-l.');
  }

  // 女体のしんぴ (nyoshin.com)
  if (thumbnailUrl.includes('nyoshin.com')) {
    return thumbnailUrl.replace(/\/s\//, '/l/').replace(/_s\./, '_l.').replace(/-s\./, '-l.');
  }

  // うんこたれ (unkotare.com)
  if (thumbnailUrl.includes('unkotare.com')) {
    return thumbnailUrl.replace(/\/s\//, '/l/').replace(/_s\./, '_l.').replace(/-s\./, '-l.');
  }

  // AV-4610 (av-4610.com)
  if (thumbnailUrl.includes('av-4610.com')) {
    return thumbnailUrl.replace(/\/s\//, '/l/').replace(/_s\./, '_l.').replace(/-s\./, '-l.');
  }

  // H0230 (av-0230.com)
  if (thumbnailUrl.includes('av-0230.com')) {
    return thumbnailUrl.replace(/\/s\//, '/l/').replace(/_s\./, '_l.').replace(/-s\./, '-l.');
  }

  // E-BODY (av-e-body.com)
  if (thumbnailUrl.includes('av-e-body.com')) {
    return thumbnailUrl.replace(/\/s\//, '/l/').replace(/_s\./, '_l.').replace(/-s\./, '-l.');
  }

  // 金8天国 (kin8tengoku.com)
  if (thumbnailUrl.includes('kin8tengoku.com')) {
    return thumbnailUrl
      .replace(/\/s\//, '/l/')
      .replace(/_s\./, '_l.')
      .replace(/-s\./, '-l.')
      .replace(/\/small\//, '/large/');
  }

  // NOZOX (nozox.com)
  if (thumbnailUrl.includes('nozox.com')) {
    return thumbnailUrl.replace(/\/s\//, '/l/').replace(/_s\./, '_l.').replace(/-s\./, '-l.');
  }

  // 3D-EROS (3d-eros.net)
  if (thumbnailUrl.includes('3d-eros.net')) {
    return thumbnailUrl.replace(/\/s\//, '/l/').replace(/_s\./, '_l.').replace(/-s\./, '-l.');
  }

  // Pikkur (pikkur.com)
  if (thumbnailUrl.includes('pikkur.com')) {
    return thumbnailUrl.replace(/\/s\//, '/l/').replace(/_s\./, '_l.').replace(/-s\./, '-l.');
  }

  // JAV Holic (javholic.com)
  if (thumbnailUrl.includes('javholic.com')) {
    return thumbnailUrl.replace(/\/s\//, '/l/').replace(/_s\./, '_l.').replace(/-s\./, '-l.');
  }

  // DTI共通ドメイン (pics.dtiserv, smovie.1pondo.tv等)
  if (thumbnailUrl.includes('dtiserv') || thumbnailUrl.includes('smovie.')) {
    return thumbnailUrl.replace(/\/s\//, '/l/').replace(/_s\./, '_l.').replace(/-s\./, '-l.');
  }

  // ========== TOKYO-HOT / TVDEAV ==========
  // e.g., https://my.tokyo-hot.com/media/xxxx/cap/0001.jpg -> https://my.tokyo-hot.com/media/xxxx/cap/0001_h.jpg
  // e.g., https://my.tokyo-hot.com/media/xxxx/jacket.jpg -> https://my.tokyo-hot.com/media/xxxx/jacket_h.jpg
  if (thumbnailUrl.includes('tokyo-hot.com') || thumbnailUrl.includes('tvdeav.com')) {
    return thumbnailUrl
      .replace(/\/cap\/(\d+)\.jpg$/, '/cap/$1_h.jpg') // cap/0001.jpg -> cap/0001_h.jpg
      .replace(/\/jacket\.jpg$/, '/jacket_h.jpg') // jacket.jpg -> jacket_h.jpg
      .replace(/\/(\d+)\.jpg$/, '/$1_h.jpg') // 番号.jpg -> 番号_h.jpg
      .replace(/\/s\//, '/l/')
      .replace(/_s\./, '_l.')
      .replace(/-s\./, '-l.')
      .replace(/\/thumb\//, '/large/')
      .replace(/\/small\//, '/large/');
  }

  // ========== 汎用パターン（最後のフォールバック） ==========
  // 一般的なサムネイルパターンを試す
  const result = thumbnailUrl
    .replace(/\/thumb\//, '/large/')
    .replace(/\/small\//, '/large/')
    .replace(/\/thumbnail\//, '/original/')
    .replace(/_thumb\./, '.')
    .replace(/_small\./, '.')
    .replace(/-thumb\./, '.')
    .replace(/-small\./, '.');

  // 変更があった場合はそれを返す
  if (result !== thumbnailUrl) {
    return result;
  }

  // Return original if no pattern matched
  return thumbnailUrl;
}

/**
 * DTI系無修正サイト（月額制サイト）のドメインリスト
 * これらのサイトは無修正コンテンツのためブラーを適用
 */
const DTI_SUBSCRIPTION_DOMAINS = [
  'caribbeancom.com', // カリビアンコム
  'caribbeancompr.com', // カリビアンコムプレミアム
  '1pondo.tv', // 一本道
  'heyzo.com', // HEYZO
  '10musume.com', // 天然むすめ
  'pacopacomama.com', // パコパコママ
  'hitozuma-giri.com', // 人妻斬り
  'nyoshin.com', // 女体のしんぴ
  'unkotare.com', // うんこたれ
  'av-4610.com', // AV-4610
  'av-0230.com', // H0230
  'av-e-body.com', // E-BODY
  'kin8tengoku.com', // 金8天国
  'nozox.com', // NOZOX
  '3d-eros.net', // 3D-EROS
  'pikkur.com', // Pikkur
  'javholic.com', // JAV Holic
  'dtiserv', // DTI共通ドメイン
  'smovie.', // smovie系
  'japanska', // Japanska
];

export function isDtiUncensoredSite(url: string): boolean {
  if (!url) return false;
  return DTI_SUBSCRIPTION_DOMAINS.some((domain) => url.includes(domain));
}

/**
 * サムネイルURLが無修正サイトのものかどうかを判定
 * ActressCardなどでブラー適用に使用
 * @param url - サムネイルURL
 * @returns 無修正サイトの場合はtrue
 */
export function isUncensoredThumbnail(url: string | null | undefined): boolean {
  if (!url) return false;
  return isDtiUncensoredSite(url);
}

/**
 * 月額制サイトかどうかを判定（providerで判定）
 * @param provider - プロバイダー名
 * @returns 月額制サイトの場合はtrue
 */
export function isSubscriptionSite(provider: string): boolean {
  if (!provider) return false;
  // 月額制サイト（カリビアンコムプレミアムは単品購入なので除外）
  const subscriptionProviders = [
    'dti',
    'japanska',
    'caribbeancom',
    '1pondo',
    'heyzo',
    '10musume',
    'pacopacomama',
    'muramura',
    'tokyohot',
    // 注: caribbeancompr（カリビアンコムプレミアム）は単品購入サイトなので含めない
  ];
  return subscriptionProviders.includes(provider);
}

/**
 * サムネイルURLからDTI系サービスを判別する
 * @param url - サムネイルURL
 * @returns DTI系サービス名（caribbeancom, 1pondo等）またはnull
 */
export function getDtiServiceFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // ドメインでサービスを判別
  if (url.includes('caribbeancompr.com')) return 'caribbeancompr';
  if (url.includes('caribbeancom.com')) return 'caribbeancom';
  if (url.includes('1pondo.tv')) return '1pondo';
  if (url.includes('heyzo.com')) return 'heyzo';
  if (url.includes('10musume.com')) return '10musume';
  if (url.includes('pacopacomama.com')) return 'pacopacomama';
  if (url.includes('muramura.tv')) return 'muramura';
  if (url.includes('tokyo-hot.com')) return 'tokyohot';

  // その他のDTI系（個別サービスが不明な場合）
  if (url.includes('dtiserv') || url.includes('smovie.')) return 'dti';

  return null;
}
