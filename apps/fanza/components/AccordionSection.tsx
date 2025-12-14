'use client';

import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

interface AccordionSectionProps {
  /** アイコン（lucide-react コンポーネント） */
  icon: ReactNode;
  /** タイトル */
  title: string;
  /** アイテム数（バッジ表示用） */
  itemCount?: number;
  /** デフォルトで開いた状態にするか */
  defaultOpen?: boolean;
  /** クリア機能を表示するか */
  showClear?: boolean;
  /** クリアボタンのラベル */
  clearLabel?: string;
  /** クリア時のコールバック */
  onClear?: () => void;
  /** アイコンの色クラス */
  iconColorClass?: string;
  /** 背景グラデーションクラス */
  bgClass?: string;
  /** コンテンツ */
  children: ReactNode;
  /** 追加のクラス */
  className?: string;
}

/**
 * 共通アコーディオンセクションコンポーネント
 * TOPページのセール、最近見た作品、あなたへのおすすめで使用
 */
export default function AccordionSection({
  icon,
  title,
  itemCount,
  defaultOpen = false,
  showClear = false,
  clearLabel = 'クリア',
  onClear,
  iconColorClass = 'text-rose-500',
  bgClass = 'bg-white/50',
  children,
  className = '',
}: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear && window.confirm('すべてクリアしますか？')) {
      onClear();
    }
  };

  return (
    <div className={`${bgClass} rounded-lg border border-gray-200 ${className}`}>
      {/* アコーディオンヘッダー */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 rounded-lg transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <span className={iconColorClass}>{icon}</span>
          <h2 className="text-sm sm:text-base font-bold text-gray-800">{title}</h2>
          {typeof itemCount === 'number' && (
            <span className="text-xs sm:text-sm text-gray-500">({itemCount})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showClear && isOpen && onClear && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
              aria-label={clearLabel}
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* アコーディオンコンテンツ */}
      {isOpen && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}
