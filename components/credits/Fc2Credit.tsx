/**
 * FC2動画 クレジット表記コンポーネント
 */

interface Fc2CreditProps {
  className?: string;
}

export function Fc2Credit({ className = '' }: Fc2CreditProps) {
  return (
    <a
      href="https://cnt.affiliate.fc2.com/cgi-bin/click.cgi?aff_userid=355464&aff_siteid=347884&aff_shopid=146"
      target="_blank"
      rel="noopener"
      className={`inline-block ${className}`}
      aria-label="FC2動画"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://cnt.affiliate.fc2.com/cgi-bin/banner.cgi?aff_siteid=347884&bid=20831&uid=355464"
        alt="FC2動画"
        width="320"
        height="50"
        loading="lazy"
        className="block h-auto"
        style={{ maxHeight: '50px' }}
      />
    </a>
  );
}
