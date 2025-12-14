'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Flame } from 'lucide-react';
import AccordionSection from './AccordionSection';
import ProductCard from './ProductCard';
import ProductSkeleton from './ProductSkeleton';
import type { Product } from '@/types/product';

interface SaleProductMeta {
  productId: number;
  normalizedProductId: string;
  title: string;
  thumbnailUrl: string | null;
  aspName: string;
  affiliateUrl: string;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  saleName: string | null;
  saleType: string | null;
  endAt: string | null;
  performers: Array<{ id: number; name: string }>;
}

interface SalesSectionProps {
  saleProducts: SaleProductMeta[];
}

const translations = {
  ja: {
    title: 'セール中',
    viewAll: '全てのセール商品を見る',
  },
  en: {
    title: 'On Sale',
    viewAll: 'View all sale products',
  },
  zh: {
    title: '特价中',
    viewAll: '查看所有特价商品',
  },
  ko: {
    title: '세일 중',
    viewAll: '모든 세일 상품 보기',
  },
} as const;

export default function SalesSection({ saleProducts }: SalesSectionProps) {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      if (saleProducts.length === 0) {
        setProducts([]);
        setIsLoading(false);
        return;
      }

      try {
        const ids = saleProducts.slice(0, 8).map(p => p.productId).join(',');
        const response = await fetch(`/api/products?ids=${ids}`);

        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }

        const data = await response.json();

        // セール順序を維持するためにソート + セール情報をマージ
        const productMap = new Map<number, Product>();
        for (const product of data.products) {
          productMap.set(Number(product.id), product);
        }

        const orderedProducts: Product[] = [];
        for (const sale of saleProducts.slice(0, 8)) {
          const product = productMap.get(sale.productId);
          if (product) {
            // セール情報をProductにマージ
            orderedProducts.push({
              ...product,
              salePrice: sale.salePrice,
              regularPrice: sale.regularPrice,
              discount: sale.discountPercent,
              saleEndAt: sale.endAt || undefined,
            });
          }
        }

        setProducts(orderedProducts);
      } catch (err) {
        console.error('Failed to fetch sale products:', err);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [saleProducts]);

  if (saleProducts.length === 0) {
    return null;
  }

  // ローディングスケルトン
  if (isLoading) {
    return (
      <AccordionSection
        icon={<Flame className="w-5 h-5" />}
        title={t.title}
        itemCount={saleProducts.length}
        defaultOpen={false}
        iconColorClass="text-red-500"
        bgClass="bg-gradient-to-r from-red-50 to-orange-50"
      >
        <ProductSkeleton count={Math.min(saleProducts.length, 4)} />
      </AccordionSection>
    );
  }

  return (
    <AccordionSection
      icon={<Flame className="w-5 h-5" />}
      title={t.title}
      itemCount={saleProducts.length}
      defaultOpen={false}
      iconColorClass="text-red-500"
      bgClass="bg-gradient-to-r from-red-50 to-orange-50"
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {/* 全セールを見るリンク */}
      <Link
        href={`/${locale}/products?onSale=true`}
        className="flex items-center justify-center gap-2 mt-4 py-2 text-rose-600 hover:text-rose-500 transition-colors text-sm font-medium"
      >
        {t.viewAll}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </AccordionSection>
  );
}
