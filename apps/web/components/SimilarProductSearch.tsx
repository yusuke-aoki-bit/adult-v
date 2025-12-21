'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Search, X, Loader2 } from 'lucide-react';

const translations = {
  ja: {
    title: '似た作品を探す',
    searchButton: '類似作品を検索',
    searching: '検索中...',
    results: '件の類似作品',
    noResults: '類似作品が見つかりませんでした',
    matchRate: '一致度',
    close: '閉じる',
    basedOn: '検索条件',
    performers: '出演者',
    tags: 'ジャンル',
    viewProduct: '作品を見る',
  },
  en: {
    title: 'Find Similar',
    searchButton: 'Search Similar',
    searching: 'Searching...',
    results: ' similar products',
    noResults: 'No similar products found',
    matchRate: 'Match',
    close: 'Close',
    basedOn: 'Based on',
    performers: 'Performers',
    tags: 'Tags',
    viewProduct: 'View Product',
  },
  zh: {
    title: '寻找类似作品',
    searchButton: '搜索类似',
    searching: '搜索中...',
    results: '部类似作品',
    noResults: '未找到类似作品',
    matchRate: '匹配度',
    close: '关闭',
    basedOn: '搜索条件',
    performers: '出演者',
    tags: '类型',
    viewProduct: '查看作品',
  },
  ko: {
    title: '비슷한 작품 찾기',
    searchButton: '유사 검색',
    searching: '검색 중...',
    results: '개의 유사 작품',
    noResults: '유사 작품을 찾을 수 없습니다',
    matchRate: '일치도',
    close: '닫기',
    basedOn: '검색 조건',
    performers: '출연자',
    tags: '장르',
    viewProduct: '작품 보기',
  },
} as const;

interface SimilarProduct {
  id: string;
  title: string;
  imageUrl: string | null;
  matchScore: number;
}

interface SimilarProductSearchProps {
  productId: string;
  performers: string[];
  tags: string[];
  locale: string;
  className?: string;
}

export default function SimilarProductSearch({
  productId,
  performers,
  tags,
  locale,
  className = '',
}: SimilarProductSearchProps) {
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SimilarProduct[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    setIsLoading(true);
    setHasSearched(true);

    try {
      const params = new URLSearchParams();
      if (performers.length > 0) {
        params.set('performers', performers.join(','));
      }
      if (tags.length > 0) {
        params.set('tags', tags.join(','));
      }
      params.set('exclude', productId);
      params.set('limit', '12');

      const response = await fetch(`/api/products/related?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data.products || []);
      }
    } catch (error) {
      console.error('Error searching similar products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          if (!hasSearched) {
            handleSearch();
          }
        }}
        className={`flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors ${className}`}
      >
        <Sparkles className="w-4 h-4" />
        {t.searchButton}
      </button>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          {t.title}
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search criteria */}
      <div className="mb-4 p-3 bg-gray-750 rounded-lg text-sm">
        <p className="text-gray-400 mb-2">{t.basedOn}:</p>
        {performers.length > 0 && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-gray-500">{t.performers}:</span>
            <span className="text-white">{performers.slice(0, 3).join(', ')}</span>
          </div>
        )}
        {tags.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">{t.tags}:</span>
            <span className="text-white">{tags.slice(0, 5).join(', ')}</span>
          </div>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          <span className="ml-2 text-gray-400">{t.searching}</span>
        </div>
      ) : results.length > 0 ? (
        <>
          <p className="text-sm text-gray-400 mb-3">
            {results.length}{t.results}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
            {results.map(product => (
              <Link
                key={product.id}
                href={`/${locale}/products/${product.id}`}
                className="group block"
              >
                <div className="relative rounded-lg overflow-hidden bg-gray-700 mb-2" style={{ aspectRatio: '2/3' }}>
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Search className="w-6 h-6 text-gray-500" />
                    </div>
                  )}
                  {/* Match badge */}
                  <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-purple-600 text-white text-xs rounded font-medium">
                    {product.matchScore}%
                  </div>
                </div>
                <p className="text-sm text-gray-300 group-hover:text-white truncate transition-colors">
                  {product.title}
                </p>
              </Link>
            ))}
          </div>
        </>
      ) : hasSearched ? (
        <div className="py-8 text-center">
          <Search className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400">{t.noResults}</p>
        </div>
      ) : null}

      {/* Re-search button */}
      {hasSearched && !isLoading && (
        <button
          onClick={handleSearch}
          className="mt-4 w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Search className="w-4 h-4" />
          {t.searchButton}
        </button>
      )}
    </div>
  );
}
