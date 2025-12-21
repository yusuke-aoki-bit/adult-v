'use client';

import { useState, useCallback, memo, ReactNode } from 'react';
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
  /** トグル時のコールバック（遅延フェッチ用） */
  onToggle?: (isOpen: boolean) => void;
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
 * テーマはCSSクラス変数（theme-*）で制御
 */
function AccordionSection({
  icon,
  title,
  itemCount,
  defaultOpen = false,
  showClear = false,
  clearLabel = 'クリア',
  onClear,
  onToggle,
  iconColorClass = 'text-rose-500',
  bgClass,
  children,
  className = '',
}: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = useCallback(() => {
    setIsOpen(prev => {
      const newState = !prev;
      onToggle?.(newState);
      return newState;
    });
  }, [onToggle]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear && window.confirm('すべてクリアしますか？')) {
      onClear();
    }
  }, [onClear]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleToggle();
    }
  }, [handleToggle]);

  // デフォルトの背景クラス（テーマ対応）
  const defaultBgClass = bgClass || 'theme-accordion-bg';

  return (
    <div className={`${defaultBgClass} rounded-lg theme-accordion-border ${className}`}>
      {/* アコーディオンヘッダー */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className="w-full flex items-center justify-between py-3 px-4 theme-accordion-hover rounded-lg transition-colors cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <span className={iconColorClass}>{icon}</span>
          <h2 className="text-sm sm:text-base font-bold theme-text">{title}</h2>
          {typeof itemCount === 'number' && (
            <span className="text-xs sm:text-sm theme-text-muted">({itemCount})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showClear && isOpen && onClear && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs theme-text-muted hover:text-red-500 px-2 py-1 rounded theme-accordion-clear-hover transition-colors"
              aria-label={clearLabel}
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {isOpen ? (
            <ChevronUp className="w-5 h-5 theme-text-muted" />
          ) : (
            <ChevronDown className="w-5 h-5 theme-text-muted" />
          )}
        </div>
      </div>

      {/* アコーディオンコンテンツ */}
      {isOpen && (
        <div className="px-4 pb-4 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

export default memo(AccordionSection);
