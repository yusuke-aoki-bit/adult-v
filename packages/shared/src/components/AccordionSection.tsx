'use client';

import { useState, useCallback, useEffect, useRef, memo, ReactNode } from 'react';
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
  /** クリア確認メッセージ */
  clearConfirmMessage?: string;
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
  clearLabel,
  clearConfirmMessage,
  onClear,
  onToggle,
  iconColorClass = 'text-rose-500',
  bgClass,
  children,
  className = '',
}: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isFirstRender = useRef(true);

  // onToggleをレンダリング外で呼び出す（setState in render警告を回避）
  useEffect(() => {
    // 初回レンダリング時はスキップ（defaultOpenの場合のみ通知が必要な場合は条件変更）
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onToggle?.(isOpen);
  }, [isOpen, onToggle]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // confirmメッセージが指定されていない場合は確認なしで実行
      if (onClear && (!clearConfirmMessage || window.confirm(clearConfirmMessage))) {
        onClear();
      }
    },
    [onClear, clearConfirmMessage],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleToggle();
      }
    },
    [handleToggle],
  );

  // デフォルトの背景クラス（テーマ対応）
  const defaultBgClass = bgClass || 'theme-accordion-bg';

  return (
    <div className={`${defaultBgClass} theme-accordion-border rounded-lg ${className}`}>
      {/* アコーディオンヘッダー */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className="theme-accordion-hover flex w-full cursor-pointer items-center justify-between rounded-lg px-4 py-3 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <span className={iconColorClass}>{icon}</span>
          <h2 className="theme-text text-sm font-bold sm:text-base">{title}</h2>
          {typeof itemCount === 'number' && <span className="theme-text-muted text-xs sm:text-sm">({itemCount})</span>}
        </div>
        <div className="flex items-center gap-2">
          {showClear && isOpen && onClear && (
            <button
              type="button"
              onClick={handleClear}
              className="theme-text-muted theme-accordion-clear-hover rounded px-2 py-1 text-xs transition-colors hover:text-red-500"
              aria-label={clearLabel}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {isOpen ? (
            <ChevronUp className="theme-text-muted h-5 w-5" />
          ) : (
            <ChevronDown className="theme-text-muted h-5 w-5" />
          )}
        </div>
      </div>

      {/* アコーディオンコンテンツ */}
      {isOpen && <div className="animate-fade-in px-4 pb-4">{children}</div>}
    </div>
  );
}

export default memo(AccordionSection);
