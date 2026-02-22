'use client';

import { ReactNode, memo } from 'react';
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useSiteTheme } from '../../contexts/SiteThemeContext';

export interface TopPageMenuItemProps {
  /** アイコン（lucide-react コンポーネント） */
  icon: ReactNode;
  /** タイトル */
  title: string;
  /** サブタイトル（オプション） */
  subtitle?: string;
  /** テーマ */
  theme?: 'light' | 'dark';
  /** 追加のクラス */
  className?: string;
}

export interface LinkMenuItemProps extends TopPageMenuItemProps {
  /** リンク先URL */
  href: string;
  /** バッジ（件数など） */
  badge?: string | number;
}

export interface AccordionMenuItemProps extends TopPageMenuItemProps {
  /** 展開状態 */
  isExpanded: boolean;
  /** トグルハンドラー */
  onToggle: () => void;
  /** キーダウンハンドラー */
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /** コンテンツ */
  children: ReactNode;
}

const MENU_HEIGHT = 'h-16 sm:h-18';

/**
 * 遷移メニューアイテム（リンク）
 */
function LinkMenuItemComponent({
  icon,
  title,
  subtitle,
  href,
  badge,
  theme: themeProp,
  className = '',
}: LinkMenuItemProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const isDark = theme === 'dark';

  return (
    <Link
      href={href}
      className={`
        flex items-center justify-between ${MENU_HEIGHT} px-4
        rounded-lg border transition-colors
        ${isDark
          ? 'bg-gray-800/50 border-gray-700 hover:border-blue-500 hover:bg-gray-800'
          : 'bg-white border-gray-200 hover:border-pink-500 hover:bg-gray-50'
        }
        ${className}
      `}
    >
      <div className="flex items-center gap-3">
        <span className={isDark ? 'text-blue-400' : 'text-pink-500'}>{icon}</span>
        <div>
          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </span>
          {subtitle && (
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {subtitle}
            </p>
          )}
        </div>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
          }`}>
            {badge}
          </span>
        )}
      </div>
      <ChevronRight className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
    </Link>
  );
}

/**
 * 展開メニューアイテム（アコーディオン）
 */
function AccordionMenuItemComponent({
  icon,
  title,
  subtitle,
  isExpanded,
  onToggle,
  onKeyDown,
  children,
  theme: themeProp2,
  className = '',
}: AccordionMenuItemProps) {
  const { theme: contextTheme2 } = useSiteTheme();
  const theme = themeProp2 ?? contextTheme2;
  const isDark = theme === 'dark';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
    onKeyDown?.(e);
  };

  return (
    <div className={`
      rounded-lg border overflow-hidden
      ${isDark
        ? 'bg-gray-800/50 border-gray-700'
        : 'bg-white border-gray-200'
      }
      ${className}
    `}>
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        className={`
          flex items-center justify-between ${MENU_HEIGHT} px-4
          cursor-pointer transition-colors
          ${isDark
            ? 'hover:bg-gray-700/50'
            : 'hover:bg-gray-50'
          }
        `}
      >
        <div className="flex items-center gap-3">
          <span className={isDark ? 'text-purple-400' : 'text-purple-500'}>{icon}</span>
          <div>
            <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {title}
            </span>
            {subtitle && (
              <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
        ) : (
          <ChevronDown className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className={`px-4 pb-4 ${isDark ? 'border-t border-gray-700' : 'border-t border-gray-200'}`}>
          {children}
        </div>
      )}
    </div>
  );
}

export const LinkMenuItem = memo(LinkMenuItemComponent);
export const AccordionMenuItem = memo(AccordionMenuItemComponent);
