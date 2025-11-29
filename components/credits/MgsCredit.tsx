/**
 * MGS クレジット表記コンポーネント
 */

interface MgsCreditProps {
  className?: string;
}

export function MgsCredit({ className = '' }: MgsCreditProps) {
  return (
    <a
      href="https://www.mgstage.com/ppv/?aff_id=6CS5PGEBQDUYPZLHYEM33TBZFJ"
      target="_blank"
      rel="noopener"
      className={`inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-pink-600 to-red-600 text-white font-bold rounded hover:from-pink-700 hover:to-red-700 transition-all ${className}`}
      aria-label="MGS動画"
    >
      MGS動画
    </a>
  );
}
