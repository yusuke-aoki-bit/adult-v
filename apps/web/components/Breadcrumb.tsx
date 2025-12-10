import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
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
              <span className="text-gray-400">{item.label}</span>
            ) : (
              <Link
                href={item.href}
                className="text-pink-500 hover:text-pink-400 transition-colors"
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
