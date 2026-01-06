'use client';

import { useState } from 'react';
import { Star, Send, Loader2 } from 'lucide-react';

interface UserReviewFormProps {
  productId: number;
  userId: string | null;
  onSuccess?: () => void;
  onLoginRequired?: () => void;
  translations: {
    title: string;
    loginRequired: string;
    ratingLabel: string;
    reviewTitleLabel: string;
    reviewTitlePlaceholder: string;
    contentLabel: string;
    contentPlaceholder: string;
    submit: string;
    submitting: string;
    success: string;
    error: string;
    alreadyReviewed: string;
    minLength: string;
  };
}

export function UserReviewForm({
  productId,
  userId,
  onSuccess,
  onLoginRequired,
  translations: t,
}: UserReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      onLoginRequired?.();
      return;
    }

    if (rating === 0) {
      setMessage({ type: 'error', text: t.ratingLabel });
      return;
    }

    if (content.length < 10) {
      setMessage({ type: 'error', text: t.minLength });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          rating,
          title: title || null,
          content,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response['status'] === 409) {
          setMessage({ type: 'error', text: t.alreadyReviewed });
        } else {
          setMessage({ type: 'error', text: data.error || t.error });
        }
        return;
      }

      setMessage({ type: 'success', text: t.success });
      setRating(0);
      setTitle('');
      setContent('');
      onSuccess?.();
    } catch {
      setMessage({ type: 'error', text: t.error });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!userId) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
        <p className="text-gray-600 dark:text-gray-400">{t.loginRequired}</p>
        <button
          onClick={onLoginRequired}
          className="mt-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
        >
          ログイン
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t.title}</h3>

      {/* Rating */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t.ratingLabel}
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`w-8 h-8 ${
                  star <= (hoverRating || rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300 dark:text-gray-600'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.reviewTitleLabel}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.reviewTitlePlaceholder}
          maxLength={200}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-transparent"
        />
      </div>

      {/* Content */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.contentLabel}
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t.contentPlaceholder}
          rows={4}
          maxLength={5000}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
        />
        <p className="text-xs text-gray-500 mt-1">{content.length}/5000</p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting || rating === 0 || content.length < 10}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {t.submitting}
          </>
        ) : (
          <>
            <Send className="w-5 h-5" />
            {t.submit}
          </>
        )}
      </button>
    </form>
  );
}
