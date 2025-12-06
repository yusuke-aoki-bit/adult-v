'use client';

import { ActressAiReview as ActressAiReviewType } from '@/types/product';

interface ActressAiReviewProps {
  review: ActressAiReviewType;
  updatedAt?: string;
  actressName: string;
}

export default function ActressAiReview({ review, updatedAt, actressName }: ActressAiReviewProps) {
  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          {actressName}のプロフィール
        </h2>
        <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-1 rounded-full flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
          AI生成
        </span>
      </div>

      <div className="space-y-4">
        {/* 概要 */}
        <div>
          <p className="text-gray-300 leading-relaxed">
            {review.overview}
          </p>
        </div>

        {/* スタイル・魅力 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-700/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-purple-300 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              演技スタイル
            </h3>
            <p className="text-gray-300 text-sm">
              {review.style}
            </p>
          </div>

          <div className="bg-gray-700/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-pink-300 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
              魅力ポイント
            </h3>
            <p className="text-gray-300 text-sm">
              {review.appeal}
            </p>
          </div>
        </div>

        {/* おすすめ */}
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-300 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            こんな方におすすめ
          </h3>
          <p className="text-gray-300 text-sm">
            {review.recommendation}
          </p>
        </div>

        {/* キーワード */}
        {review.keywords && review.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {review.keywords.map((keyword) => (
              <span
                key={keyword}
                className="text-xs px-3 py-1 rounded-full bg-gray-700 text-gray-300 border border-gray-600"
              >
                #{keyword}
              </span>
            ))}
          </div>
        )}

        {/* 更新日時 */}
        {updatedAt && (
          <div className="text-xs text-gray-500 pt-2 border-t border-gray-700 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            最終更新: {new Date(updatedAt).toLocaleDateString('ja-JP')}
          </div>
        )}
      </div>
    </div>
  );
}
