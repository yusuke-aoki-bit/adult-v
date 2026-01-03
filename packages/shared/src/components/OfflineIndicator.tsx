'use client';

import { useOnlineStatus } from '../hooks/useOnlineStatus';

const translations = {
  ja: {
    offline: 'オフラインです',
    reconnecting: '再接続中...',
    backOnline: 'オンラインに復帰しました',
  },
  en: {
    offline: "You're offline",
    reconnecting: 'Reconnecting...',
    backOnline: 'Back online',
  },
  zh: {
    offline: '您已离线',
    reconnecting: '重新连接中...',
    backOnline: '已恢复在线',
  },
  ko: {
    offline: '오프라인 상태입니다',
    reconnecting: '재연결 중...',
    backOnline: '온라인으로 복귀했습니다',
  },
} as const;

// SVGアイコン（バンドルサイズ削減）
const WifiOffIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
    <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

interface OfflineIndicatorProps {
  locale?: string;
}

export function OfflineIndicator({ locale = 'ja' }: OfflineIndicatorProps) {
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const { isOnline, offlineDuration } = useOnlineStatus();

  // オンラインの場合は何も表示しない
  if (isOnline) {
    return null;
  }

  // オフライン時間をフォーマット
  const formatDuration = (seconds: number | null): string => {
    if (seconds === null || seconds < 5) return '';
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分`;
    const hours = Math.floor(minutes / 60);
    return `${hours}時間${minutes % 60}分`;
  };

  const durationText = formatDuration(offlineDuration);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] bg-amber-600 text-white py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2 animate-slide-down"
      role="alert"
      aria-live="assertive"
    >
      <WifiOffIcon />
      <span>{t.offline}</span>
      {durationText && (
        <span className="text-amber-200">({durationText})</span>
      )}
    </div>
  );
}
