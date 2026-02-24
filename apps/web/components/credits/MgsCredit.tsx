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
      className={`inline-flex h-[50px] items-center justify-center rounded bg-linear-to-r from-fuchsia-600 to-red-600 px-6 py-3 text-sm font-bold text-white transition-all hover:from-fuchsia-700 hover:to-red-700 ${className}`}
      aria-label="MGS動画"
    >
      MGS動画
    </a>
  );
}
