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
    <nav aria-label="Breadcrumb" className={`flex items-center space-x-2 text-sm ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={`${item.href || 'current'}-${item.label}`} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="w-4 h-4 mx-2 text-gray-500" />
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
          </div>
        );
      })}
    </nav>
  );
}
