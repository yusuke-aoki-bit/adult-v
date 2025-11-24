'use client';

import { useTranslations } from 'next-intl';

interface ProductSource {
  aspName: string;
  originalProductId: string;
  price: number | null;
  affiliateUrl: string;
}

interface ProductDetailInfoProps {
  duration: number | null;
  releaseDate: string | null;
  sources: ProductSource[];
  updatedAt: Date | null;
  performerCount: number;
  tagCount: number;
}

export default function ProductDetailInfo({
  duration,
  releaseDate,
  sources,
  updatedAt,
  performerCount,
  tagCount,
}: ProductDetailInfoProps) {
  const t = useTranslations('productDetail');

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-bold text-white border-b border-gray-700 pb-2">
        作品詳細情報
      </h2>

      {/* 基本情報 */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        {duration && (
          <div>
            <span className="text-gray-400">再生時間:</span>
            <span className="text-white ml-2 font-semibold">{duration}分</span>
          </div>
        )}
        {releaseDate && (
          <div>
            <span className="text-gray-400">配信開始:</span>
            <span className="text-white ml-2 font-semibold">{releaseDate}</span>
          </div>
        )}
        <div>
          <span className="text-gray-400">出演者数:</span>
          <span className="text-white ml-2 font-semibold">{performerCount}名</span>
        </div>
        <div>
          <span className="text-gray-400">タグ数:</span>
          <span className="text-white ml-2 font-semibold">{tagCount}件</span>
        </div>
      </div>

      {/* データソースの透明性 */}
      {sources.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <h3 className="text-sm font-semibold text-white mb-3">
            配信サイト ({sources.length}サイト)
          </h3>
          <div className="space-y-2">
            {sources.map((source, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-700/50 rounded p-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-gray-600 rounded font-mono text-white">
                    {source.aspName}
                  </span>
                  <span className="text-gray-300">
                    品番: {source.originalProductId}
                  </span>
                </div>
                {source.price !== null && (
                  <span className="text-green-400 font-semibold">
                    ¥{source.price.toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            複数の配信サイトから価格・在庫情報を収集し、最新の情報を提供しています
          </p>
        </div>
      )}

      {/* 更新日時 */}
      {updatedAt && (
        <div className="text-xs text-gray-400 pt-4 border-t border-gray-700">
          最終更新: {new Date(updatedAt).toLocaleString('ja-JP')}
        </div>
      )}

      {/* 信頼性バッジ */}
      <div className="flex items-center gap-2 pt-4">
        <div className="flex items-center gap-1 px-3 py-1 bg-blue-600/20 border border-blue-600 rounded-full">
          <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs text-blue-300 font-medium">検証済みデータ</span>
        </div>
        <div className="flex items-center gap-1 px-3 py-1 bg-green-600/20 border border-green-600 rounded-full">
          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path
              fillRule="evenodd"
              d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs text-green-300 font-medium">公式提供元</span>
        </div>
      </div>
    </div>
  );
}
