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
      <div className="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-800">
        <p className="text-gray-600 dark:text-gray-400">{t.loginRequired}</p>
        <button
          onClick={onLoginRequired}
          className="mt-2 rounded-lg bg-rose-600 px-4 py-2 text-white transition-colors hover:bg-rose-700"
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
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t.ratingLabel}</label>
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
                className={`h-8 w-8 ${
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
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t.reviewTitleLabel}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.reviewTitlePlaceholder}
          maxLength={200}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-rose-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      {/* Content */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t.contentLabel}</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t.contentPlaceholder}
          rows={4}
          maxLength={5000}
          className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-rose-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <p className="mt-1 text-xs text-gray-500">{content.length}/5000</p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-lg p-3 ${
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
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-3 text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {t.submitting}
          </>
        ) : (
          <>
            <Send className="h-5 w-5" />
            {t.submit}
          </>
        )}
      </button>
    </form>
  );
}
