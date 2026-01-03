'use client';

import { ReactNode } from 'react';

export interface SelectableCardProps {
  children: ReactNode;
  isSelected: boolean;
  isSelectionMode: boolean;
  onToggle: () => void;
  theme?: 'dark' | 'light';
}

export function SelectableCard({
  children,
  isSelected,
  isSelectionMode,
  onToggle,
  theme = 'dark',
}: SelectableCardProps) {
  const isDark = theme === 'dark';

  if (!isSelectionMode) {
    return <>{children}</>;
  }

  return (
    <div
      className={`relative cursor-pointer transition-all ${
        isSelected
          ? isDark
            ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900 rounded-lg'
            : 'ring-2 ring-pink-500 ring-offset-2 ring-offset-white rounded-lg'
          : ''
      }`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      {/* チェックボックス */}
      <div
        className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
          isSelected
            ? isDark
              ? 'bg-blue-600 text-white'
              : 'bg-pink-600 text-white'
            : isDark
              ? 'bg-gray-800/80 border-2 border-gray-600 text-transparent hover:border-gray-500'
              : 'bg-white/80 border-2 border-gray-300 text-transparent hover:border-gray-400'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      {/* オーバーレイ（選択時） */}
      {isSelected && (
        <div
          className={`absolute inset-0 rounded-lg pointer-events-none ${
            isDark ? 'bg-blue-500/10' : 'bg-pink-500/10'
          }`}
        />
      )}

      {/* ポインターイベントを無効化してカード内部のクリックを防止 */}
      <div className="pointer-events-none">{children}</div>
    </div>
  );
}

export default SelectableCard;
