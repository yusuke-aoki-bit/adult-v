/**
 * ソクミル API利用時のクレジット表記コンポーネント
 *
 * 必須: ソクミルウェブサービスAPIを利用する全てのサイト・アプリに表示が必要
 */

interface SokmilCreditProps {
  variant?: '88x31' | '135x18';
  className?: string;
}

export function SokmilCredit({ variant = '88x31', className = '' }: SokmilCreditProps) {
  const imageUrl = variant === '88x31'
    ? 'https://sokmil-ad.com/api/credit/88x31.gif'
    : 'https://sokmil-ad.com/api/credit/135x18.gif';

  const dimensions = variant === '88x31'
    ? { width: 88, height: 31 }
    : { width: 135, height: 18 };

  return (
    <a
      href="https://sokmil-ad.com/"
      target="_blank"
      rel="nofollow noopener noreferrer"
      className={`inline-block ${className}`}
      aria-label="WEB SERVICE BY SOKMIL"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="WEB SERVICE BY SOKMIL"
        width={dimensions.width}
        height={dimensions.height}
        loading="lazy"
        className={`block ${variant === '88x31' ? 'w-auto h-[50px] max-w-[180px] object-contain' : 'w-[135px] h-[18px]'}`}
        style={{ aspectRatio: `${dimensions.width}/${dimensions.height}` }}
      />
    </a>
  );
}
