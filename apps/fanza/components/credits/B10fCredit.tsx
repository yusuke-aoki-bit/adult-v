/**
 * B10F.jp クレジット表記コンポーネント
 */

interface B10fCreditProps {
  className?: string;
}

export function B10fCredit({ className = '' }: B10fCreditProps) {
  return (
    <a
      href="https://b10f.jp/create_account_2.php?all=1&atv=12556_UClTcALL_12_9"
      target="_blank"
      rel="noopener"
      className={`inline-block ${className}`}
      aria-label="B10F.jp"
    >
      {}
      <img
        src="https://ads.b10f.jp/images/btn_member.png"
        alt="B10F.jp"
        width={180}
        height={50}
        loading="lazy"
        className="block h-[50px] w-auto max-w-[180px] object-contain"
        style={{ aspectRatio: '180/50' }}
      />
    </a>
  );
}
