'use client';

import { useState, useCallback } from 'react';

export interface Correction {
  id: number;
  targetType: 'product' | 'performer';
  targetId: number;
  userId: string;
  fieldName: string;
  currentValue: string | null;
  suggestedValue: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface UseCorrectionsOptions {
  targetType: 'product' | 'performer';
  targetId: number;
  userId: string | null;
}

export interface UseCorrectionsReturn {
  corrections: Correction[];
  isLoading: boolean;
  error: string | null;
  fetchCorrections: () => Promise<void>;
  submitCorrection: (data: {
    fieldName: string;
    currentValue: string | null;
    suggestedValue: string;
    reason: string | null;
  }) => Promise<void>;
  deleteCorrection: (correctionId: number) => Promise<void>;
}

export function useCorrections({
  targetType,
  targetId,
  userId,
}: UseCorrectionsOptions): UseCorrectionsReturn {
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCorrections = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        targetType,
        targetId: String(targetId),
      });

      const response = await fetch(`/api/corrections?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch corrections');
      }

      const data = await response.json();
      setCorrections(data.corrections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [targetType, targetId]);

  const submitCorrection = useCallback(
    async (data: {
      fieldName: string;
      currentValue: string | null;
      suggestedValue: string;
      reason: string | null;
    }) => {
      if (!userId) {
        throw new Error('User not logged in');
      }

      const response = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          targetType,
          targetId,
          ...data,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit correction');
      }

      const result = await response.json();

      // Add the new correction to the list
      setCorrections((prev) => [result.correction, ...prev]);
    },
    [userId, targetType, targetId]
  );

  const deleteCorrection = useCallback(
    async (correctionId: number) => {
      if (!userId) {
        throw new Error('User not logged in');
      }

      const response = await fetch(`/api/corrections/${correctionId}?userId=${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete correction');
      }

      // Remove from local state
      setCorrections((prev) => prev.filter((c) => c.id !== correctionId));
    },
    [userId]
  );

  return {
    corrections,
    isLoading,
    error,
    fetchCorrections,
    submitCorrection,
    deleteCorrection,
  };
}
