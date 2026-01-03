'use client';

import { useState, useEffect } from 'react';
import { Tag, ThumbsUp, ThumbsDown, Loader2, CheckCircle, Clock } from 'lucide-react';

interface TagSuggestionWithVote {
  id: number;
  productId: number;
  userId: string;
  suggestedTagName: string;
  existingTagId: number | null;
  upvotes: number;
  downvotes: number;
  status: string;
  createdAt: string;
  userVote: 'up' | 'down' | null;
}

interface TagSuggestionListProps {
  productId: number;
  userId: string | null;
  onLoginRequired?: () => void;
  translations: {
    title: string;
    noSuggestions: string;
    approved: string;
    pending: string;
    loginToVote: string;
  };
}

export function TagSuggestionList({
  productId,
  userId,
  onLoginRequired,
  translations: t,
}: TagSuggestionListProps) {
  const [suggestions, setSuggestions] = useState<TagSuggestionWithVote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [votingId, setVotingId] = useState<number | null>(null);

  useEffect(() => {
    fetchSuggestions();
  }, [productId, userId]);

  const fetchSuggestions = async () => {
    try {
      const url = userId
        ? `/api/products/${productId}/tag-suggestions?userId=${userId}`
        : `/api/products/${productId}/tag-suggestions`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch {
      console.error('Failed to fetch tag suggestions');
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
      const response = await fetch(`/api/products/${productId}/tag-suggestions`, {
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
        <Tag className="w-5 h-5 text-gray-500" />
        <h4 className="font-medium text-gray-900 dark:text-white">{t.title}</h4>
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              suggestion.status === 'approved'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            }`}
          >
            {suggestion.status === 'approved' ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
            <span>{suggestion.suggestedTagName}</span>

            <div className="flex items-center gap-1 ml-1 border-l border-gray-300 dark:border-gray-600 pl-2">
              <button
                onClick={() => handleVote(suggestion.id, 'up')}
                disabled={votingId === suggestion.id}
                className={`p-0.5 rounded transition-colors ${
                  suggestion.userVote === 'up'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400 hover:text-green-600 dark:hover:text-green-400'
                }`}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs min-w-[1.5rem] text-center">
                {suggestion.upvotes - suggestion.downvotes}
              </span>
              <button
                onClick={() => handleVote(suggestion.id, 'down')}
                disabled={votingId === suggestion.id}
                className={`p-0.5 rounded transition-colors ${
                  suggestion.userVote === 'down'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-400 hover:text-red-600 dark:hover:text-red-400'
                }`}
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
