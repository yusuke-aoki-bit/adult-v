'use client';

const FANZA_SITE_URL = 'https://www.f.adult-v.com';

interface FanzaCrossLinkProps {
  /** 商品ID（apps/fanza経由でリンク） */
  productId?: string | number | null;
  /** ロケール */
  locale?: string;
  /** ボタンのラベル（デフォルト: FANZAで見る） */
  label?: string;
  /** クラス名 */
  className?: string;
  /** @deprecated FANZAへの直リンクは規約違反のため使用禁止 */
  fanzaUrl?: string | null;
}

/**
 * FANZAサイト（f.adult-v.com）経由でFANZA商品を見るボタン
 * apps/webからFANZAへの直接リンクは規約違反のため、apps/fanza経由でリンク
 * リファラーにapps/webが乗らないようにするため
 */
export default function FanzaCrossLink({
  productId,
  locale = 'ja',
  label = 'FANZAで見る',
  className = '',
  fanzaUrl, // 互換性のため残すが使用しない
}: FanzaCrossLinkProps) {
  // 商品IDがない場合は表示しない（fanzaUrlは直リンクなので使用しない）
  if (!productId && !fanzaUrl) {
    return null;
  }

  // apps/fanza経由のURL（直接FANZAではなく自社サイト経由）
  const url = productId
    ? `${FANZA_SITE_URL}/${locale}/products/${productId}`
    : null;

  // URLがない場合は表示しない
  if (!url) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg ${className}`}
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
      {label}
    </a>
  );
}

interface FanzaSiteLinkProps {
  /** FANZAサイト（f.adult-v.com）内のパス（例: /ja/actress/123） */
  path: string;
  /** ボタンのラベル */
  label?: string;
  /** ロケール */
  locale?: string;
  /** クラス名 */
  className?: string;
  /** コンパクト表示（バッジ風） */
  compact?: boolean;
}

/**
 * FANZAサイト（f.adult-v.com）へのクロスリンク
 * Adult-Vサイトから自社FANZAサイトへの導線
 */
export function FanzaSiteLink({
  path,
  label = 'FANZAサイトで見る',
  locale = 'ja',
  className = '',
  compact = false,
}: FanzaSiteLinkProps) {
  // パスにロケールが含まれていない場合は追加
  const fullPath = path.startsWith(`/${locale}`) ? path : `/${locale}${path.startsWith('/') ? path : `/${path}`}`;
  const url = `${FANZA_SITE_URL}${fullPath}`;

  if (compact) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs font-medium rounded transition-all ${className}`}
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        {label}
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg ${className}`}
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
      {label}
    </a>
  );
}
