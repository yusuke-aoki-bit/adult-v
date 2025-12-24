'use client';

type ThemeMode = 'dark' | 'light';

interface WatchLaterButtonProps {
  productId: number | string;
  title: string;
  thumbnail?: string;
  provider?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  theme?: ThemeMode;
  isAdded: boolean;
  isLoaded: boolean;
  onToggle: () => void;
  labels?: {
    addToWatchLater: string;
    removeFromWatchLater: string;
    loading: string;
  };
}

export default function WatchLaterButton({
  size = 'md',
  className = '',
  theme = 'dark',
  isAdded,
  isLoaded,
  onToggle,
  labels = {
    addToWatchLater: '後で見る',
    removeFromWatchLater: '後で見るから削除',
    loading: '読み込み中...',
  },
}: WatchLaterButtonProps) {
  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  // テーマに応じたスタイル
  const getButtonStyles = () => {
    if (theme === 'dark') {
      if (!isLoaded) {
        return 'bg-gray-700 text-gray-500 cursor-not-allowed';
      }
      return isAdded
        ? 'bg-blue-600 text-white hover:bg-blue-500'
        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white';
    } else {
      if (!isLoaded) {
        return 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200';
      }
      return isAdded
        ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600'
        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900 border';
    }
  };

  if (!isLoaded) {
    return (
      <button
        className={`${sizeClasses[size]} rounded-lg ${getButtonStyles()} ${className}`}
        disabled
        title={labels.loading}
      >
        <svg className={`${iconSizes[size]} animate-pulse`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={onToggle}
      className={`${sizeClasses[size]} rounded-lg transition-all ${getButtonStyles()} ${className}`}
      title={isAdded ? labels.removeFromWatchLater : labels.addToWatchLater}
    >
      <svg className={iconSizes[size]} fill={isAdded ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  );
}
