'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Send, Loader2, Plus, Search } from 'lucide-react';
import { debounce } from '../../lib/debounce';

interface PerformerMatch {
  id: number;
  name: string;
  nameRomaji: string | null;
}

interface PerformerSuggestionFormProps {
  productId: number;
  userId: string | null;
  existingPerformers?: string[];
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
    selectExisting: string;
    orEnterNew: string;
  };
}

export function PerformerSuggestionForm({
  productId,
  userId,
  existingPerformers = [],
  onSuccess,
  onLoginRequired,
  translations: t,
}: PerformerSuggestionFormProps) {
  const [performerName, setPerformerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [matchingPerformers, setMatchingPerformers] = useState<PerformerMatch[]>([]);
  const [selectedPerformerId, setSelectedPerformerId] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const searchPerformers = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setMatchingPerformers([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/products/${productId}/performer-suggestions?search=${encodeURIComponent(query)}`
        );
        if (response.ok) {
          const data = await response.json();
          setMatchingPerformers(data.matches || []);
          setShowDropdown(true);
        }
      } catch {
        console.error('Failed to search performers');
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [productId]
  );

  useEffect(() => {
    if (performerName.length >= 2 && !selectedPerformerId) {
      searchPerformers(performerName);
    } else {
      setMatchingPerformers([]);
      setShowDropdown(false);
    }
  }, [performerName, selectedPerformerId, searchPerformers]);

  const handleSelectPerformer = (performer: PerformerMatch) => {
    setPerformerName(performer['name']);
    setSelectedPerformerId(performer['id']);
    setShowDropdown(false);
    setMatchingPerformers([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPerformerName(e.target.value);
    setSelectedPerformerId(null);
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      onLoginRequired?.();
      return;
    }

    const trimmedName = performerName.trim();
    if (trimmedName.length < 2) {
      setMessage({ type: 'error', text: t.tooShort });
      return;
    }

    // Check against existing performers
    if (existingPerformers.some((p) => p.toLowerCase() === trimmedName.toLowerCase())) {
      setMessage({ type: 'error', text: t.alreadySuggested });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/products/${productId}/performer-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          performerName: trimmedName,
          existingPerformerId: selectedPerformerId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response['status'] === 409) {
          setMessage({ type: 'error', text: t.alreadySuggested });
        } else {
          setMessage({ type: 'error', text: data.error || t.error });
        }
        return;
      }

      setMessage({ type: 'success', text: t.success });
      setPerformerName('');
      setSelectedPerformerId(null);
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
        <User className="w-5 h-5 text-gray-500" />
        <h4 className="font-medium text-gray-900 dark:text-white">{t.title}</h4>
      </div>

      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={performerName}
              onChange={handleInputChange}
              onFocus={() => matchingPerformers.length > 0 && setShowDropdown(true)}
              placeholder={t.placeholder}
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-transparent text-sm"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
            )}

            {/* Dropdown for matching performers */}
            {showDropdown && matchingPerformers.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                <div className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  {t.selectExisting}
                </div>
                {matchingPerformers.map((performer) => (
                  <button
                    key={performer['id']}
                    type="button"
                    onClick={() => handleSelectPerformer(performer)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-white flex items-center gap-2"
                  >
                    <User className="w-4 h-4 text-gray-400" />
                    <span>{performer['name']}</span>
                    {performer.nameRomaji && (
                      <span className="text-gray-500 text-xs">({performer.nameRomaji})</span>
                    )}
                  </button>
                ))}
                <div className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
                  {t.orEnterNew}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || performerName.trim().length < 2}
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
      </div>

      {selectedPerformerId && (
        <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <Search className="w-3 h-3" />
          既存の演者を選択中
        </div>
      )}

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
