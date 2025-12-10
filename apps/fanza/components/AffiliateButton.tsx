'use client';

interface AffiliateButtonProps {
  affiliateUrl: string;
  providerLabel: string;
  aspName?: string;
  price?: number;
  salePrice?: number;
  discount?: number;
}

/**
 * MGS商品IDを正規化（ハイフンがない場合は適切な位置に挿入）
 * 例: 259LUXU1010 → 259LUXU-1010, CAWD157 → CAWD-157
 */
function normalizeMgsProductId(productId: string): string {
  // 既にハイフンがある場合はそのまま返す
  if (productId.includes('-')) {
    return productId;
  }

  // パターン: 数字プレフィックス + 英字 + 数字（例: 259LUXU1010）
  const prefixMatch = productId.match(/^(\d+)([A-Z]+)(\d+)$/i);
  if (prefixMatch) {
    return `${prefixMatch[1]}${prefixMatch[2]}-${prefixMatch[3]}`;
  }

  // パターン: 英字 + 数字（例: CAWD157）
  const simpleMatch = productId.match(/^([A-Z]+)(\d+)$/i);
  if (simpleMatch) {
    return `${simpleMatch[1]}-${simpleMatch[2]}`;
  }

  return productId;
}

/**
 * MGSウィジェットからパラメータを抽出してMGS商品ページURLを生成
 * nakiny.com形式: agef=1で年齢確認スキップ、aff=でアフィリエイト追跡
 */
function extractMgsProductUrl(widgetCode: string): string | null {
  const productIdMatch = widgetCode.match(/[?&]p=([^&"']+)/);
  const affCodeMatch = widgetCode.match(/[?&]c=([^&"']+)/);

  if (productIdMatch) {
    const rawProductId = productIdMatch[1];
    const productId = normalizeMgsProductId(rawProductId);
    const affCode = affCodeMatch ? affCodeMatch[1] : '';
    // agef=1 で年齢確認をスキップ、aff= でアフィリエイトコードを付与
    const affParam = affCode ? `&aff=${affCode}` : '';
    return `https://www.mgstage.com/product/product_detail/${productId}/?agef=1${affParam}`;
  }
  return null;
}

/**
 * アフィリエイトボタンコンポーネント
 * MGSの場合は商品ページへのリンク、それ以外は通常のリンクとして表示
 */
export default function AffiliateButton({
  affiliateUrl,
  providerLabel,
  price,
  salePrice,
  discount,
}: AffiliateButtonProps) {
  const isMgsWidget = affiliateUrl.includes('mgs_Widget_affiliate');

  // MGSウィジェットの場合、商品ページURLを抽出
  let finalUrl = affiliateUrl;
  if (isMgsWidget) {
    const mgsUrl = extractMgsProductUrl(affiliateUrl);
    if (mgsUrl) {
      finalUrl = mgsUrl;
    } else {
      return null;
    }
  }

  // URLが正常なリンクかどうかを確認
  const isValidUrl = finalUrl.startsWith('http://') || finalUrl.startsWith('https://');
  if (!isValidUrl) {
    return null;
  }

  const hasSale = salePrice && price && salePrice < price;

  return (
    <div className="pt-4 space-y-3">
      {/* セール価格の強調表示 */}
      {hasSale && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-red-600 font-bold text-lg">🔥 セール中</span>
            {discount && (
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                {discount}%OFF
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-2xl font-bold text-red-600">¥{salePrice.toLocaleString()}</span>
            <span className="text-sm text-gray-500 line-through">¥{price.toLocaleString()}</span>
          </div>
        </div>
      )}
      <a
        href={finalUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={`flex items-center justify-center gap-2 w-full text-white text-center py-4 px-6 rounded-lg font-semibold transition-colors ${
          hasSale
            ? 'bg-red-600 hover:bg-red-700 animate-pulse'
            : 'bg-rose-600 hover:bg-rose-700'
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        {providerLabel}で{hasSale ? '今すぐ' : ''}購入
      </a>
    </div>
  );
}
