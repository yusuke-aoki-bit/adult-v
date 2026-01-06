'use client';

import { useState, useEffect } from 'react';
import { Check, Eye, Star, X } from 'lucide-react';
import { useViewingDiary, type DiaryEntry } from '../hooks/useViewingDiary';

interface MarkAsViewedButtonProps {
  productId: string;
  title: string;
  imageUrl: string | null;
  aspName: string;
  performerName?: string;
  performerId?: number | string;
  tags?: string[];
  duration?: number;
  size?: 'sm' | 'md' | 'lg';
  locale?: string;
}

const translations = {
  ja: {
    markAsViewed: '視聴済みにする',
    viewed: '視聴済み',
    addToDiary: '日記に追加',
    rating: '評価',
    note: 'メモ（任意）',
    notePlaceholder: '感想やメモを残す...',
    cancel: 'キャンセル',
    save: '保存',
    viewCount: '回視聴',
  },
  en: {
    markAsViewed: 'Mark as Viewed',
    viewed: 'Viewed',
    addToDiary: 'Add to Diary',
    rating: 'Rating',
    note: 'Note (optional)',
    notePlaceholder: 'Leave your thoughts...',
    cancel: 'Cancel',
    save: 'Save',
    viewCount: 'views',
  },
  zh: {
    markAsViewed: '标记为已看',
    viewed: '已观看',
    addToDiary: '添加到日记',
    rating: '评分',
    note: '备注（可选）',
    notePlaceholder: '写下你的感想...',
    cancel: '取消',
    save: '保存',
    viewCount: '次观看',
  },
  ko: {
    markAsViewed: '시청 완료로 표시',
    viewed: '시청 완료',
    addToDiary: '일기에 추가',
    rating: '평점',
    note: '메모 (선택)',
    notePlaceholder: '소감을 남겨보세요...',
    cancel: '취소',
    save: '저장',
    viewCount: '회 시청',
  },
} as const;

export default function MarkAsViewedButton({
  productId,
  title,
  imageUrl,
  aspName,
  performerName,
  performerId,
  tags,
  duration,
  size = 'md',
  locale = 'ja',
}: MarkAsViewedButtonProps) {
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const { addEntry, getViewCountForProduct, entries } = useViewingDiary();

  const [showModal, setShowModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [note, setNote] = useState('');
  const [viewCount, setViewCount] = useState(0);

  useEffect(() => {
    setViewCount(getViewCountForProduct(productId));
  }, [productId, getViewCountForProduct, entries]);

  const handleSave = () => {
    const entry: Omit<DiaryEntry, 'id' | 'createdAt'> = {
      productId,
      title,
      imageUrl,
      aspName,
      ...(performerName && { performerName }),
      ...(performerId !== undefined && { performerId }),
      ...(tags && { tags }),
      ...(duration !== undefined && { duration }),
      ...(rating > 0 && { rating }),
      ...(note.trim() && { note: note.trim() }),
      viewedAt: Date.now(),
    };

    addEntry(entry);
    setShowModal(false);
    setRating(0);
    setNote('');
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`${sizeClasses[size]} rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
          viewCount > 0
            ? 'bg-green-600/20 text-green-400 border border-green-600/40 hover:bg-green-600/30'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
        }`}
      >
        {viewCount > 0 ? (
          <>
            <Check className={iconSizes[size]} />
            <span>{t.viewed}</span>
            {viewCount > 1 && (
              <span className="text-green-500">({viewCount}{t.viewCount})</span>
            )}
          </>
        ) : (
          <>
            <Eye className={iconSizes[size]} />
            <span>{t.markAsViewed}</span>
          </>
        )}
      </button>

      {/* モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-rose-500" />
                {t.addToDiary}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 作品タイトル */}
            <p className="text-sm text-gray-400 mb-4 line-clamp-2">{title}</p>

            {/* 評価 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t.rating}
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star === rating ? 0 : star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= (hoverRating || rating)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* メモ */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t.note}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.notePlaceholder}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 resize-none"
                rows={3}
              />
            </div>

            {/* ボタン */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
