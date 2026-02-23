'use client';

import { ReactNode, useState, useCallback, memo } from 'react';
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useSiteTheme } from '../../contexts/SiteThemeContext';

export type MenuType = 'link' | 'accordion';

interface BaseMenuProps {
  /** アイコン（lucide-react コンポーネント） */
  icon: ReactNode;
  /** タイトル */
  title: string;
  /** サブタイトル（オプション） */
  subtitle?: string;
  /** テーマ */
  theme?: 'light' | 'dark';
}

interface LinkMenuProps extends BaseMenuProps {
  type: 'link';
  /** リンク先URL */
  href: string;
  /** バッジ（件数など） */
  badge?: string | number;
}

interface AccordionMenuProps extends BaseMenuProps {
  type: 'accordion';
  /** デフォルト展開状態 */
  defaultOpen?: boolean;
  /** コンテンツ */
  children: ReactNode;
  /** 展開時のコールバック（遅延フェッチ用） */
  onExpand?: () => void;
}

export type TopPageMenuSectionProps = LinkMenuProps | AccordionMenuProps;

// 共通の高さとスタイル
const MENU_BASE_STYLES = {
  height: 'min-h-[56px] sm:min-h-[64px]',
  padding: 'px-4 py-3',
  rounded: 'rounded-lg',
  border: 'border',
};

/**
 * トップページの統一されたメニューセクションコンポーネント
 * リンク型とアコーディオン型の2種類をサポート
 *
 * リンク型: 青/ピンク系アイコン、右矢印
 * アコーディオン型: 紫系アイコン、上下矢印
 */
function TopPageMenuSectionComponent(props: TopPageMenuSectionProps) {
  const { icon, title, subtitle, theme: themeProp } = props;
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const isDark = theme === 'dark';

  // アコーディオン状態
  const [isExpanded, setIsExpanded] = useState(props.type === 'accordion' ? (props.defaultOpen ?? false) : false);
  const [hasOpened, setHasOpened] = useState(false);

  const handleToggle = useCallback(() => {
    if (props.type !== 'accordion') return;

    const newState = !isExpanded;
    setIsExpanded(newState);

    // 初めて開いた時のコールバック
    if (newState && !hasOpened) {
      setHasOpened(true);
      props.onExpand?.();
    }
  }, [isExpanded, hasOpened, props]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggle();
      }
    },
    [handleToggle],
  );

  // リンク型のスタイル
  const linkStyles = isDark
    ? 'bg-gray-800/50 border-gray-700 hover:border-blue-500/50 hover:bg-gray-800/80'
    : 'bg-white border-gray-200 hover:border-pink-400 hover:bg-pink-50/30';

  // アコーディオン型のスタイル（展開可能を示す紫系）
  const accordionStyles = isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200';

  const accordionHeaderHoverStyles = isDark ? 'hover:bg-gray-700/50' : 'hover:bg-purple-50/50';

  // アイコン色: リンク=青/ピンク、アコーディオン=紫
  const iconColor =
    props.type === 'link'
      ? isDark
        ? 'text-blue-400'
        : 'text-pink-500'
      : isDark
        ? 'text-purple-400'
        : 'text-purple-500';

  // リンク型
  if (props.type === 'link') {
    return (
      <Link
        href={props.href}
        className={`flex items-center justify-between ${MENU_BASE_STYLES.height} ${MENU_BASE_STYLES.padding} ${MENU_BASE_STYLES.rounded} ${MENU_BASE_STYLES.border} ${linkStyles} group transition-all duration-200`}
      >
        <div className="flex items-center gap-3">
          <span className={iconColor}>{icon}</span>
          <div>
            <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</span>
            {subtitle && (
              <p className={`mt-0.5 text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{subtitle}</p>
            )}
          </div>
          {props.badge && (
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {props.badge}
            </span>
          )}
        </div>
        <ChevronRight
          className={`h-5 w-5 transition-colors ${
            isDark ? 'text-gray-500 group-hover:text-blue-400' : 'text-gray-400 group-hover:text-pink-500'
          }`}
        />
      </Link>
    );
  }

  // アコーディオン型
  return (
    <div
      className={` ${MENU_BASE_STYLES.rounded} ${MENU_BASE_STYLES.border} ${accordionStyles} overflow-hidden transition-all duration-200`}
    >
      {/* ヘッダー */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        className={`flex items-center justify-between ${MENU_BASE_STYLES.height} ${MENU_BASE_STYLES.padding} cursor-pointer transition-colors ${accordionHeaderHoverStyles} `}
      >
        <div className="flex items-center gap-3">
          <span className={iconColor}>{icon}</span>
          <div>
            <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</span>
            {subtitle && (
              <p className={`mt-0.5 text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{subtitle}</p>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className={`h-5 w-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
        ) : (
          <ChevronDown className={`h-5 w-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
        )}
      </div>

      {/* コンテンツ */}
      {isExpanded && (
        <div className={`px-4 pb-4 ${isDark ? 'border-t border-gray-700/50' : 'border-t border-gray-100'}`}>
          <div className="pt-4">{props.children}</div>
        </div>
      )}
    </div>
  );
}

export const TopPageMenuSection = memo(TopPageMenuSectionComponent);
