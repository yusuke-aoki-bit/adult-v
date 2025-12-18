import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

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
}

const themeConfig = {
  dark: {
    currentItem: 'text-gray-400',
    link: 'text-pink-500 hover:text-pink-400',
  },
  light: {
    currentItem: 'text-gray-600',
    link: 'text-pink-500 hover:text-pink-600',
  },
};

export default function Breadcrumb({ items, className = '', theme = 'dark' }: BreadcrumbProps) {
  const config = themeConfig[theme];

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1 text-sm sm:text-base whitespace-nowrap ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={`${item.href || 'current'}-${item.label}`} className="inline-flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
            )}
            {isLast || !item.href ? (
              <span className={config.currentItem}>{item.label}</span>
            ) : (
              <Link
                href={item.href}
                className={`${config.link} transition-colors`}
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
