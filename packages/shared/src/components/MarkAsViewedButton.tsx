'use client';

import { useState, useEffect } from 'react';
import { Check, Eye, Star, X } from 'lucide-react';
import { useViewingDiary, type DiaryEntry } from '../hooks/useViewingDiary';
import { getTranslation, markAsViewedTranslations } from '../lib/translations';

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
  const t = getTranslation(markAsViewedTranslations, locale);
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
        className={`${sizeClasses[size]} flex items-center gap-1.5 rounded-lg font-medium transition-colors ${
          viewCount > 0
            ? 'border border-green-600/40 bg-green-600/20 text-green-400 hover:bg-green-600/30'
            : 'border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        {viewCount > 0 ? (
          <>
            <Check className={iconSizes[size]} />
            <span>{t.viewed}</span>
            {viewCount > 1 && (
              <span className="text-green-500">
                ({viewCount}
                {t.viewCount})
              </span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-gray-800 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                <Eye className="h-5 w-5 text-rose-500" />
                {t.addToDiary}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 作品タイトル */}
            <p className="mb-4 line-clamp-2 text-sm text-gray-400">{title}</p>

            {/* 評価 */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-300">{t.rating}</label>
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
                      className={`h-8 w-8 ${
                        star <= (hoverRating || rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* メモ */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-gray-300">{t.note}</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.notePlaceholder}
                className="w-full resize-none rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-500 focus:border-rose-500 focus:outline-none"
                rows={3}
              />
            </div>

            {/* ボタン */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg bg-gray-700 px-4 py-2 text-gray-300 transition-colors hover:bg-gray-600"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleSave}
                className="rounded-lg bg-rose-600 px-4 py-2 text-white transition-colors hover:bg-rose-700"
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
