'use client';

import { useState, useEffect } from 'react';
import { Star, ThumbsUp, ThumbsDown, Loader2, MessageSquare } from 'lucide-react';

interface Review {
  id: number;
  userId: string;
  rating: string;
  title: string | null;
  content: string;
  helpfulCount: number | null;
  status: string;
  createdAt: string;
  userVote?: 'helpful' | 'not_helpful' | null;
}

interface UserReviewListProps {
  productId: number;
  userId: string | null;
  translations: {
    title: string;
    noReviews: string;
    helpful: string;
    notHelpful: string;
    helpfulCount: string;
    loading: string;
    error: string;
  };
}

export function UserReviewList({ productId, userId, translations: t }: UserReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votingReviewId, setVotingReviewId] = useState<number | null>(null);

  useEffect(() => {
    fetchReviews();
  }, [productId, userId]);

  const fetchReviews = async () => {
    try {
      const url = userId ? `/api/products/${productId}/reviews?userId=${userId}` : `/api/products/${productId}/reviews`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setReviews(data.reviews);
    } catch {
      setError(t.error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (reviewId: number, voteType: 'helpful' | 'not_helpful') => {
    if (!userId) return;

    setVotingReviewId(reviewId);

    try {
      const response = await fetch(`/api/products/${productId}/reviews/${reviewId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, voteType }),
      });

      if (response.ok) {
        // 投票状態を更新
        setReviews((prev) =>
          prev.map((review) => {
            if (review['id'] === reviewId) {
              const oldVote = review.userVote;
              const newVote = voteType;
              let helpfulDelta = 0;

              if (oldVote === 'helpful' && newVote !== 'helpful') {
                helpfulDelta = -1;
              } else if (oldVote !== 'helpful' && newVote === 'helpful') {
                helpfulDelta = 1;
              }

              return {
                ...review,
                userVote: voteType,
                helpfulCount: (review['helpfulCount'] || 0) + helpfulDelta,
              };
            }
            return review;
          }),
        );
      }
    } catch {
      // エラーは静かに処理
    } finally {
      setVotingReviewId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">{t.loading}</span>
      </div>
    );
  }

  if (error) {
    return <div className="py-8 text-center text-red-500">{error}</div>;
  }

  if (reviews.length === 0) {
    return (
      <div className="py-8 text-center">
        <MessageSquare className="mx-auto mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
        <p className="text-gray-500 dark:text-gray-400">{t.noReviews}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
        <MessageSquare className="h-5 w-5" />
        {t.title} ({reviews.length})
      </h3>

      <div className="space-y-4">
        {reviews.map((review) => (
          <div
            key={review['id']}
            className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            {/* Header */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Stars */}
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= parseFloat(review['rating'])
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300 dark:text-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(review['createdAt'])}</span>
              </div>
            </div>

            {/* Title */}
            {review['title'] && <h4 className="mb-2 font-medium text-gray-900 dark:text-white">{review['title']}</h4>}

            {/* Content */}
            <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{review.content}</p>

            {/* Actions */}
            <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-3 dark:border-gray-700">
              <span className="text-sm text-gray-500">
                {t.helpfulCount.replace('{count}', String(review['helpfulCount'] || 0))}
              </span>

              {userId && review['userId'] !== userId && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleVote(review['id'], 'helpful')}
                    disabled={votingReviewId === review['id']}
                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-colors ${
                      review.userVote === 'helpful'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                    }`}
                  >
                    {votingReviewId === review['id'] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ThumbsUp className="h-4 w-4" />
                    )}
                    {t.helpful}
                  </button>
                  <button
                    onClick={() => handleVote(review['id'], 'not_helpful')}
                    disabled={votingReviewId === review['id']}
                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-colors ${
                      review.userVote === 'not_helpful'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                    }`}
                  >
                    {votingReviewId === review['id'] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ThumbsDown className="h-4 w-4" />
                    )}
                    {t.notHelpful}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
