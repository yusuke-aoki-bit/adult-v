'use client';

interface AffiliateButtonProps {
  affiliateUrl: string;
  providerLabel: string;
  aspName?: string;
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

  return (
    <div className="pt-4">
      <a
        href={finalUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block w-full bg-rose-600 text-white text-center py-3 px-6 rounded-lg font-semibold hover:bg-rose-700 transition-colors"
      >
        {providerLabel}で購入
      </a>
    </div>
  );
}
