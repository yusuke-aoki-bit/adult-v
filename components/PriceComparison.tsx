'use client';

import { useState, useEffect } from 'react';

interface PriceOption {
  asp: string;
  aspLabel: string;
  price: number;
  affiliateUrl: string;
  inStock: boolean;
}

interface PriceComparisonProps {
  productId: string;
}

/**
 * 価格比較コンポーネント
 * 複数ASPの価格を比較表示
 */
export default function PriceComparison({ productId }: PriceComparisonProps) {
  const [prices, setPrices] = useState<PriceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPrices() {
      try {
        const response = await fetch(`/api/products/${productId}/prices`);
        if (!response.ok) {
          throw new Error('価格情報の取得に失敗しました');
        }
        const data = await response.json();
        setPrices(data.prices || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : '価格情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    }

    fetchPrices();
  }, [productId]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">価格比較</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || prices.length === 0) {
    return null;
  }

  // 最安値を計算
  const lowestPrice = Math.min(...prices.filter(p => p.inStock).map(p => p.price));

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">価格比較</h3>
      <div className="space-y-3">
        {prices.map((option, index) => (
          <div
            key={index}
            className={`flex items-center justify-between p-4 rounded-lg border-2 ${
              option.inStock && option.price === lowestPrice
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div>
                <p className="font-semibold text-gray-900">{option.aspLabel}</p>
                <p className="text-2xl font-bold text-gray-900">¥{option.price.toLocaleString()}</p>
              </div>
              {option.inStock && option.price === lowestPrice && (
                <span className="px-3 py-1 bg-rose-600 text-white text-xs font-semibold rounded-full">
                  最安値
                </span>
              )}
              {!option.inStock && (
                <span className="px-3 py-1 bg-gray-400 text-white text-xs font-semibold rounded-full">
                  在庫なし
                </span>
              )}
            </div>
            <a
              href={option.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className={`inline-flex items-center gap-2 px-6 py-2 rounded-lg font-semibold text-white ${
                option.inStock
                  ? 'bg-gray-900 hover:bg-gray-800'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
              onClick={(e) => {
                if (!option.inStock) {
                  e.preventDefault();
                }
              }}
            >
              購入する
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-4">
        ※価格は変動する可能性があります。最新の価格は各サイトでご確認ください。
      </p>
    </div>
  );
}
