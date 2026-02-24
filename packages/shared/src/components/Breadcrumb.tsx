'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useSiteTheme } from '../contexts/SiteThemeContext';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

type BreadcrumbTheme = 'dark' | 'light';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  /** テーマ: dark (web用), light (fanza用) */
  theme?: BreadcrumbTheme;
  /** ベースURL（JSON-LD用、省略時はhrefをそのまま使用） */
  baseUrl?: string;
  /** JSON-LDスキーマを出力するか（デフォルト: false。既存ページとの重複回避用） */
  includeSchema?: boolean;
}

const themeConfig = {
  dark: {
    currentItem: 'text-gray-400',
    link: 'text-fuchsia-400 hover:text-fuchsia-300',
  },
  light: {
    currentItem: 'text-gray-600',
    link: 'text-pink-500 hover:text-pink-600',
  },
};

// BreadcrumbList JSON-LD用の型定義
interface BreadcrumbListItem {
  '@type': 'ListItem';
  position: number;
  name: string;
  item?: string;
}

/**
 * BreadcrumbList JSON-LDスキーマを生成
 * @see https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
 */
export function generateBreadcrumbSchema(items: BreadcrumbItem[], baseUrl?: string) {
  const itemListElement: BreadcrumbListItem[] = items
    .filter((item) => item.href)
    .map((item, index) => ({
      '@type': 'ListItem' as const,
      position: index + 1,
      name: item.label,
      item: baseUrl && item.href ? `${baseUrl}${item.href}` : (item.href ?? ''),
    }));

  // 最後のアイテム（現在のページ）も追加（itemは省略可能）
  const lastItem = items[items.length - 1];
  if (lastItem && !lastItem.href) {
    itemListElement.push({
      '@type': 'ListItem',
      position: items.length,
      name: lastItem.label,
      // 現在のページはitem省略（schema.orgの仕様で許容される）
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  };
}

export default function Breadcrumb({
  items,
  className = '',
  theme: themeProp,
  baseUrl,
  includeSchema = false,
}: BreadcrumbProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const config = themeConfig[theme];
  const schemaData = includeSchema ? generateBreadcrumbSchema(items, baseUrl) : null;

  return (
    <>
      {/* JSON-LD構造化データ（includeSchema=trueの場合のみ） */}
      {schemaData && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }} />
      )}
      <nav aria-label="Breadcrumb" className={`text-sm whitespace-nowrap sm:text-base ${className}`}>
        <ol className="flex items-center gap-1" role="list">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;

            return (
              <li key={`${item.href || 'current'}-${item.label}`} className="inline-flex items-center gap-1">
                {index > 0 && (
                  <ChevronRight className="h-3 w-3 shrink-0 text-gray-500 sm:h-4 sm:w-4" aria-hidden="true" />
                )}
                {isLast || !item.href ? (
                  <span className={config.currentItem} aria-current="page">
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href} className={`${config.link} transition-colors`}>
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
