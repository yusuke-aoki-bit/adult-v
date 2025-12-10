/**
 * Japanska クレジット表記コンポーネント
 */

interface JapanskaCreditProps {
  className?: string;
}

export function JapanskaCredit({ className = '' }: JapanskaCreditProps) {
  return (
    <a
      href="https://wlink.golden-gateway.com/id/9094-10035-001-1d55/"
      target="_blank"
      rel="noopener"
      className={`inline-block ${className}`}
      aria-label="JAPANSKA-ヤパンスカ"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://wimg2.golden-gateway.com/ad/10035_01.jpg"
        alt="無修正アダルト動画 JAPANSKA-ヤパンスカ"
        width="468"
        height="60"
        loading="lazy"
        className="block w-auto h-[50px] max-w-[180px] object-contain"
        style={{ aspectRatio: '468/60' }}
      />
    </a>
  );
}
