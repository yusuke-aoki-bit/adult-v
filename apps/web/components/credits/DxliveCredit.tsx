/**
 * DXLIVE クレジット表記コンポーネント
 * DTI CASHアフィリエイト経由
 *
 * アフィリエイトID: 239360
 * バナー形式: iframe ウィジェット
 */

interface DxliveCreditProps {
  className?: string;
  /**
   * 表示バリアント
   * - 'small': フッター用小型バナー（テキストリンク）
   * - 'widget': サイドバー等用のiframeウィジェット（370x700）
   * - 'banner': 中型バナー（300x250等）
   */
  variant?: 'small' | 'widget' | 'banner';
}

// DTI CASHで取得したアフィリエイトID
const DXLIVE_AFFILIATE_ID = '239360';

export function DxliveCredit({ className = '', variant = 'small' }: DxliveCreditProps) {
  // フッター用小型バナー（テキスト + アイコン）
  if (variant === 'small') {
    return (
      <a
        href={`https://www.dxlive.com/?affid=${DXLIVE_AFFILIATE_ID}`}
        target="_blank"
        rel="noopener sponsored"
        className={`inline-block ${className}`}
        aria-label="DXLIVE ライブチャット"
      >
        <div className="min-w-[120px] rounded bg-gradient-to-r from-pink-600 to-purple-600 px-3 py-2 text-center text-sm font-bold text-white transition-all hover:from-pink-500 hover:to-purple-500">
          <div className="text-[10px] opacity-80">Live Chat</div>
          <div>DXLIVE</div>
        </div>
      </a>
    );
  }

  // iframeウィジェット（サイドバー等用）
  if (variant === 'widget') {
    return (
      <div className={className}>
        <iframe
          src={`https://bn.dxlive.com/affiliate/hanamaru/1?affid=${DXLIVE_AFFILIATE_ID}`}
          width="370"
          height="700"
          frameBorder="0"
          scrolling="auto"
          title="DXLIVE ライブチャット"
          loading="lazy"
        />
      </div>
    );
  }

  // 中型バナー
  return (
    <a
      href={`https://www.dxlive.com/?affid=${DXLIVE_AFFILIATE_ID}`}
      target="_blank"
      rel="noopener sponsored"
      className={`inline-block ${className}`}
      aria-label="DXLIVE ライブチャット"
    >
      <div className="rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 p-4 text-center text-white transition-all hover:from-pink-500 hover:to-purple-500">
        <div className="mb-1 text-xs opacity-80">アダルトライブチャット</div>
        <div className="text-xl font-bold">DXLIVE</div>
        <div className="mt-2 text-xs opacity-90">無料登録で$15相当のポイント付与</div>
      </div>
    </a>
  );
}
