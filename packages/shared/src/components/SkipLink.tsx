'use client';

interface SkipLinkProps {
  /** スキップ先のID（#なし） */
  targetId?: string;
  /** 表示テキスト */
  label?: string;
}

/**
 * スキップリンク - アクセシビリティ対応
 * キーボードユーザーがナビゲーションをスキップしてメインコンテンツに移動できる
 * 通常は非表示で、フォーカス時のみ表示される
 */
export function SkipLink({
  targetId = 'main-content',
  label = 'Skip to main content',
}: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-gray-900 focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
    >
      {label}
    </a>
  );
}

export default SkipLink;
