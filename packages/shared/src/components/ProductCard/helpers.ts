/**
 * ProductCard Helper Functions
 */

/**
 * MGS商品IDを正規化（ハイフンがない場合は適切な位置に挿入）
 */
export function normalizeMgsProductId(productId: string): string {
  if (productId.includes('-')) return productId;
  const prefixMatch = productId.match(/^(\d+)([A-Z]+)(\d+)$/i);
  if (prefixMatch) return `${prefixMatch[1]}${prefixMatch[2]}-${prefixMatch[3]}`;
  const simpleMatch = productId.match(/^([A-Z]+)(\d+)$/i);
  if (simpleMatch) return `${simpleMatch[1]}-${simpleMatch[2]}`;
  return productId;
}

/**
 * MGSウィジェットコードから実際の商品ページURLを抽出
 */
export function extractMgsProductUrl(widgetCode: string): string | null {
  const productIdMatch = widgetCode.match(/[?&]p=([^&"']+)/);
  const affCodeMatch = widgetCode.match(/[?&]c=([^&"']+)/);
  if (productIdMatch) {
    const productId = normalizeMgsProductId(productIdMatch[1]);
    const affCode = affCodeMatch ? affCodeMatch[1] : '';
    const affParam = affCode ? `?aff=${affCode}` : '';
    return `https://www.mgstage.com/product/product_detail/${productId}/${affParam}`;
  }
  return null;
}

/**
 * FANZAのアフィリエイトURLを直リンクに変換
 */
export function convertFanzaToDirectUrl(affiliateUrl: string): string {
  // すでに直リンクの場合はそのまま返す
  if (affiliateUrl.includes('www.dmm.co.jp') && !affiliateUrl.includes('al.dmm.co.jp')) {
    return affiliateUrl;
  }

  // lurl パラメータから直リンクを抽出 (https://al.dmm.co.jp/?lurl=...&af_id=... 形式)
  const lurlMatch = affiliateUrl.match(/[?&]lurl=([^&]+)/);
  if (lurlMatch) {
    try {
      return decodeURIComponent(lurlMatch[1]);
    } catch {
      // デコードに失敗
    }
  }

  // _url パラメータから直リンクを抽出 (旧形式)
  const urlMatch = affiliateUrl.match(/[?&]_url=([^&]+)/);
  if (urlMatch) {
    try {
      return decodeURIComponent(urlMatch[1]);
    } catch {
      // デコードに失敗
    }
  }

  // _link パラメータからcidを抽出してDMM直リンクを生成
  const linkMatch = affiliateUrl.match(/[?&]_link=([^&]+)/);
  if (linkMatch) {
    try {
      const decodedLink = decodeURIComponent(linkMatch[1]);
      if (decodedLink.includes('dmm.co.jp')) {
        return decodedLink;
      }
    } catch {
      // デコードに失敗
    }
  }

  return affiliateUrl;
}

export interface GetAffiliateUrlOptions {
  /** FANZAアフィリエイトURLを直リンクに変換するか */
  convertFanzaUrls?: boolean;
}

/**
 * アフィリエイトURLを取得（MGSウィジェット・FANZAアフィリエイトの場合は変換）
 */
export function getAffiliateUrl(
  affiliateUrl: string | undefined | null,
  options: GetAffiliateUrlOptions = {}
): string | null {
  if (!affiliateUrl) return null;

  // MGSウィジェットの場合
  if (affiliateUrl.includes('mgs_Widget_affiliate')) {
    return extractMgsProductUrl(affiliateUrl);
  }

  // FANZAアフィリエイトURLを直リンクに変換（オプション）
  if (options.convertFanzaUrls) {
    if (affiliateUrl.includes('al.dmm.co.jp') || affiliateUrl.includes('dmm.co.jp')) {
      return convertFanzaToDirectUrl(affiliateUrl);
    }
  }

  if (affiliateUrl.startsWith('http://') || affiliateUrl.startsWith('https://')) {
    return affiliateUrl;
  }

  return null;
}
