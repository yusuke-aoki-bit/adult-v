'use client';

import { useState } from 'react';
import { Tag, Send, Loader2, Plus } from 'lucide-react';

interface TagSuggestionFormProps {
  productId: number;
  userId: string | null;
  existingTags?: string[];
  onSuccess?: () => void;
  onLoginRequired?: () => void;
  translations: {
    title: string;
    loginRequired: string;
    placeholder: string;
    submit: string;
    submitting: string;
    success: string;
    error: string;
    alreadySuggested: string;
    tooShort: string;
  };
}

export function TagSuggestionForm({
  productId,
  userId,
  existingTags = [],
  onSuccess,
  onLoginRequired,
  translations: t,
}: TagSuggestionFormProps) {
  const [tagName, setTagName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      onLoginRequired?.();
      return;
    }

    const trimmedTag = tagName.trim();
    if (trimmedTag.length < 2) {
      setMessage({ type: 'error', text: t.tooShort });
      return;
    }

    // 既存タグとの重複チェック
    if (existingTags.some((tag) => tag.toLowerCase() === trimmedTag.toLowerCase())) {
      setMessage({ type: 'error', text: t.alreadySuggested });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/products/${productId}/tag-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tagName: trimmedTag,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setMessage({ type: 'error', text: t.alreadySuggested });
        } else {
          setMessage({ type: 'error', text: data.error || t.error });
        }
        return;
      }

      setMessage({ type: 'success', text: t.success });
      setTagName('');
      onSuccess?.();
    } catch {
      setMessage({ type: 'error', text: t.error });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!userId) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center text-sm">
        <p className="text-gray-600 dark:text-gray-400">{t.loginRequired}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center gap-2">
        <Tag className="w-5 h-5 text-gray-500" />
        <h4 className="font-medium text-gray-900 dark:text-white">{t.title}</h4>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
          placeholder={t.placeholder}
          maxLength={50}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-transparent text-sm"
        />
        <button
          type="submit"
          disabled={isSubmitting || tagName.trim().length < 2}
          className="flex items-center gap-1 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {isSubmitting ? t.submitting : t.submit}
        </button>
      </div>

      {message && (
        <div
          className={`p-2 rounded text-sm ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}
    </form>
  );
}
