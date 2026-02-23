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
    processedUrl = `https:${processedUrl}`;
  }

  // Convert awsimgsrc.dmm.co.jp to pics.dmm.co.jp
  // awsimgsrc.dmm.co.jp returns 405 for HEAD requests and causes Next.js image optimization issues
  // pics.dmm.co.jp properly handles HEAD requests and redirects deleted images to now_printing.jpg
  if (processedUrl.includes('awsimgsrc.dmm.co.jp')) {
    processedUrl = processedUrl
      .replace('awsimgsrc.dmm.co.jp/pics_dig/', 'pics.dmm.co.jp/')
      .replace('awsimgsrc.dmm.co.jp/pics/', 'pics.dmm.co.jp/');
  }

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
 *
 * ⚠️ ASP規約遵守のため、この関数は廃止されました。
 * 各ASPは「提供されたサンプル画像・HTMLのみ使用可」としており、
 * URL改変による画像取得は規約違反となる可能性があります。
 *
 * この関数は互換性のため残されていますが、元のURLをそのまま返します。
 * サムネイル画像のみを使用してください。
 *
 * @param thumbnailUrl - The thumbnail URL
 * @returns Original URL (no conversion for ASP compliance)
 * @deprecated ASP規約遵守のため、画像URL変換は廃止されました
 */
export function getFullSizeImageUrl(thumbnailUrl: string): string {
  // ASP規約遵守: URL改変による画像取得は行わない
  // 各ASPの提供するサムネイル画像をそのまま使用
  if (!thumbnailUrl) return thumbnailUrl;

  // DMM/FANZAのみ、ドメイン正規化は許可（awsimgsrc → pics変換）
  // これはASP規約で許可されている標準的なドメイン変換
  if (thumbnailUrl.includes('awsimgsrc.dmm.co.jp')) {
    return thumbnailUrl
      .replace('awsimgsrc.dmm.co.jp/pics_dig/', 'pics.dmm.co.jp/')
      .replace('awsimgsrc.dmm.co.jp/pics/', 'pics.dmm.co.jp/');
  }

  // pics.dmm.com も pics.dmm.co.jp に統一（ドメイン正規化のみ）
  if (thumbnailUrl.includes('pics.dmm.com')) {
    return thumbnailUrl.replace('pics.dmm.com', 'pics.dmm.co.jp');
  }

  // その他のASPは元のURLをそのまま返す
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
