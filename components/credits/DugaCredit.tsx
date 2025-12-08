/**
 * DUGA API利用時のクレジット表記コンポーネント
 *
 * 利用規約: https://duga.jp/aff/member/html/api-credit.html
 * 必須: ウェブサービスAPIを利用する全てのサイト・アプリに表示が必要
 */

interface DugaCreditProps {
  className?: string;
}

export function DugaCredit({ className = '' }: DugaCreditProps) {
  return (
    <a
      href="https://click.duga.jp/aff/api/48611-01"
      target="_blank"
      rel="nofollow noopener noreferrer"
      className={`inline-block ${className}`}
      aria-label="DUGAウェブサービス"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://ad.duga.jp/img/webservice_88.gif"
        alt="DUGAウェブサービス"
        width="88"
        height="31"
        loading="lazy"
        className="block w-[88px] h-[31px]"
        style={{ aspectRatio: '88/31' }}
      />
    </a>
  );
}
