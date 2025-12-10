/**
 * DTI (一本道、カリビアンコム等) クレジット表記コンポーネント
 */

interface DtiCreditProps {
  className?: string;
}

export function DtiCredit({ className = '' }: DtiCreditProps) {
  return (
    <a
      href="https://clear-tv.com/Click190/1006200-6-239360"
      target="_blank"
      rel="noopener"
      className={`inline-block ${className}`}
      aria-label="カリビアンコム"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://pixelarchivenow.com/image/carib/3day_900_250.jpg"
        alt="カリビアンコム"
        width={900}
        height={250}
        loading="lazy"
        className="block w-auto h-[50px] max-w-[180px] object-contain"
        style={{ aspectRatio: '900/250' }}
      />
    </a>
  );
}
