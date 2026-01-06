'use client';

import { useState, useEffect } from 'react';
import { User, ThumbsUp, ThumbsDown, Loader2, CheckCircle, Clock, Link } from 'lucide-react';

interface PerformerSuggestionWithVote {
  id: number;
  productId: number;
  userId: string;
  performerName: string;
  existingPerformerId: number | null;
  upvotes: number;
  downvotes: number;
  status: string;
  createdAt: string;
  userVote: 'up' | 'down' | null;
}

interface PerformerSuggestionListProps {
  productId: number;
  userId: string | null;
  onLoginRequired?: () => void;
  translations: {
    title: string;
    noSuggestions: string;
    approved: string;
    pending: string;
    linkedToExisting: string;
    loginToVote: string;
  };
}

export function PerformerSuggestionList({
  productId,
  userId,
  onLoginRequired,
  translations: t,
}: PerformerSuggestionListProps) {
  const [suggestions, setSuggestions] = useState<PerformerSuggestionWithVote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [votingId, setVotingId] = useState<number | null>(null);

  useEffect(() => {
    fetchSuggestions();
  }, [productId, userId]);

  const fetchSuggestions = async () => {
    try {
      const url = userId
        ? `/api/products/${productId}/performer-suggestions?userId=${userId}`
        : `/api/products/${productId}/performer-suggestions`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch {
      console.error('Failed to fetch performer suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (suggestionId: number, voteType: 'up' | 'down') => {
    if (!userId) {
      onLoginRequired?.();
      return;
    }

    setVotingId(suggestionId);
    try {
      const response = await fetch(`/api/products/${productId}/performer-suggestions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionId,
          userId,
          voteType,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions((prev) =>
          prev.map((s) =>
            s.id === suggestionId
              ? { ...s, upvotes: data.upvotes, downvotes: data.downvotes, userVote: data.userVote }
              : s
          )
        );
      }
    } catch {
      console.error('Failed to vote');
    } finally {
      setVotingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <User className="w-5 h-5 text-gray-500" />
        <h4 className="font-medium text-gray-900 dark:text-white">{t.title}</h4>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion['id']}
            className={`flex items-center justify-between p-3 rounded-lg ${
              suggestion['status'] === 'approved'
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-1.5 rounded-full ${
                  suggestion['status'] === 'approved'
                    ? 'bg-green-100 dark:bg-green-900'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                {suggestion['status'] === 'approved' ? (
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {suggestion['performerName']}
                  </span>
                  {suggestion.existingPerformerId && (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                      <Link className="w-3 h-3" />
                      {t.linkedToExisting}
                    </span>
                  )}
                </div>
                <span
                  className={`text-xs ${
                    suggestion['status'] === 'approved'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {suggestion['status'] === 'approved' ? t.approved : t.pending}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleVote(suggestion['id'], 'up')}
                disabled={votingId === suggestion['id']}
                className={`p-1.5 rounded transition-colors ${
                  suggestion.userVote === 'up'
                    ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-green-600 dark:hover:text-green-400'
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
              </button>

              <span className="min-w-[2rem] text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                {suggestion.upvotes - suggestion.downvotes}
              </span>

              <button
                onClick={() => handleVote(suggestion['id'], 'down')}
                disabled={votingId === suggestion['id']}
                className={`p-1.5 rounded transition-colors ${
                  suggestion.userVote === 'down'
                    ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600 dark:hover:text-red-400'
                }`}
              >
                <ThumbsDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
