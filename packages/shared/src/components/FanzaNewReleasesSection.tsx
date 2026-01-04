'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const FANZA_SITE_URL = 'https://www.f.adult-v.com';

interface FanzaProduct {
  id: string | number;
  title: string;
  imageUrl: string | null;
  salePrice?: number | null;
  price?: number;
  discount?: number | null;
  releaseDate?: string | null;
}

interface FanzaNewReleasesSectionProps {
  locale?: string;
  className?: string;
}

const translations = {
  ja: {
    title: 'FANZA新作ピックアップ',
    viewMore: 'FANZA専門サイトで見る',
    sale: 'SALE',
    new: 'NEW',
    noData: 'データを取得中...',
  },
  en: {
    title: 'FANZA New Releases',
    viewMore: 'View on FANZA Site',
    sale: 'SALE',
    new: 'NEW',
    noData: 'Loading...',
  },
  zh: {
    title: 'FANZA新作精选',
    viewMore: '在FANZA网站查看',
    sale: '特价',
    new: '新品',
    noData: '加载中...',
  },
  'zh-TW': {
    title: 'FANZA新作精選',
    viewMore: '在FANZA網站查看',
    sale: '特價',
    new: '新品',
    noData: '載入中...',
  },
  ko: {
    title: 'FANZA 신작 픽업',
    viewMore: 'FANZA 사이트에서 보기',
    sale: '세일',
    new: '신상',
    noData: '로딩 중...',
  },
};

/**
 * FANZA新作ピックアップセクション
 * apps/webのトップページに表示し、FANZA専門サイトへの導線を強化
 */
export function FanzaNewReleasesSection({
  locale = 'ja',
  className = '',
}: FanzaNewReleasesSectionProps) {
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const [products, setProducts] = useState<FanzaProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // FANZA商品を取得（新作順、8件）
        const res = await fetch('/api/products?limit=8&sort=releaseDate&includeAsp=FANZA');
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products || []);
        }
      } catch (error) {
        console.error('Failed to fetch FANZA products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // ローディング中または商品がない場合は表示しない
  if (loading || products.length === 0) {
    return null;
  }

  const fanzaSiteUrl = `${FANZA_SITE_URL}?hl=${locale}`;

  return (
    <section className={`py-4 sm:py-6 ${className}`}>
      <div className="container mx-auto px-3 sm:px-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-linear-to-br from-pink-500 to-rose-500 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-lg sm:text-xl">F</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white">
              {t.title}
            </h2>
          </div>
          <a
            href={fanzaSiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs sm:text-sm text-pink-400 hover:text-pink-300 transition-colors font-medium"
          >
            {t.viewMore}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        {/* 商品グリッド */}
        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
          {products.slice(0, 8).map((product, index) => (
            <a
              key={product.id}
              href={`${FANZA_SITE_URL}/products/${product.id}?hl=${locale}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-pink-500/50 transition-all"
            >
              <div className="relative" style={{ aspectRatio: '2/3' }}>
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.title}
                    fill
                    sizes="(max-width: 768px) 25vw, 12.5vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    loading={index < 4 ? undefined : "lazy"}
                    priority={index < 4}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gray-700">
                    <svg className="h-8 w-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                {/* セールバッジ */}
                {product.salePrice && (
                  <div className="absolute top-1 left-1 flex gap-1">
                    <span className="bg-red-600 text-white text-[8px] sm:text-[10px] font-bold px-1 py-0.5 rounded">
                      {t.sale}
                    </span>
                    {product.discount && product.discount >= 30 && (
                      <span className="bg-linear-to-r from-yellow-400 to-orange-500 text-black text-[8px] sm:text-[10px] font-bold px-1 py-0.5 rounded">
                        -{product.discount}%
                      </span>
                    )}
                  </div>
                )}
                {/* ホバーオーバーレイ */}
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                  <span className="text-white text-[10px] sm:text-xs font-medium bg-pink-500/80 px-1.5 py-0.5 rounded">
                    FANZAで見る
                  </span>
                </div>
              </div>
              <div className="p-1.5">
                <p className="text-gray-200 text-[10px] sm:text-xs font-medium line-clamp-2 group-hover:text-pink-300 transition-colors">
                  {product.title}
                </p>
              </div>
            </a>
          ))}
        </div>

        {/* FANZAサイトへのCTA */}
        <div className="mt-3 sm:mt-4">
          <a
            href={fanzaSiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full p-3 bg-linear-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 rounded-lg text-center text-white font-medium text-sm transition-all shadow hover:shadow-lg"
          >
            <span className="flex items-center justify-center gap-2">
              FANZA専門サイトで全作品を見る
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}

export default FanzaNewReleasesSection;
