'use client';

import { useState, useEffect, useCallback } from 'react';
import { Cloud, CloudOff, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { STORAGE_KEYS } from '../constants/storage';
import { isFirebaseConfigured } from '../lib/firebase';

export interface CloudSyncSettingsProps {
  translations: {
    title: string;
    description: string;
    enableSync: string;
    disableSync: string;
    enabled: string;
    disabled: string;
    warning: string;
    warningDetails: string;
    syncing: string;
    lastSynced: string;
    never: string;
  };
  onSyncChange?: (enabled: boolean) => void;
}

export function CloudSyncSettings({ translations: t, onSyncChange }: CloudSyncSettingsProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Load setting from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CLOUD_SYNC_ENABLED);
      setIsEnabled(stored === 'true');
    } catch {
      // Ignore localStorage errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleToggle = useCallback(() => {
    if (!isEnabled) {
      // Show confirmation before enabling
      setShowConfirm(true);
    } else {
      // Disable immediately
      setIsEnabled(false);
      localStorage.setItem(STORAGE_KEYS.CLOUD_SYNC_ENABLED, 'false');
      onSyncChange?.(false);
    }
  }, [isEnabled, onSyncChange]);

  const handleConfirmEnable = useCallback(async () => {
    setShowConfirm(false);
    setIsSyncing(true);

    try {
      // Enable cloud sync
      localStorage.setItem(STORAGE_KEYS.CLOUD_SYNC_ENABLED, 'true');
      setIsEnabled(true);
      onSyncChange?.(true);

      // Simulate initial sync delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } finally {
      setIsSyncing(false);
    }
  }, [onSyncChange]);

  const handleCancelEnable = useCallback(() => {
    setShowConfirm(false);
  }, []);

  // Firebase not configured
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg bg-gray-800 p-4">
        <div className="mb-2 h-6 w-32 rounded bg-gray-700" />
        <div className="h-4 w-48 rounded bg-gray-700" />
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-gray-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEnabled ? <Cloud className="h-5 w-5 text-blue-400" /> : <CloudOff className="h-5 w-5 text-gray-500" />}
          <h3 className="font-medium text-white">{t.title}</h3>
        </div>

        <button
          onClick={handleToggle}
          disabled={isSyncing}
          className={`relative h-6 w-12 rounded-full transition-colors ${
            isEnabled ? 'bg-blue-600' : 'bg-gray-600'
          } ${isSyncing ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <span
            className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
              isEnabled ? 'left-7' : 'left-1'
            }`}
          />
        </button>
      </div>

      <p className="mb-3 text-sm text-gray-400">{t.description}</p>

      {/* Status */}
      <div className="flex items-center gap-2 text-sm">
        {isSyncing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            <span className="text-blue-400">{t.syncing}</span>
          </>
        ) : isEnabled ? (
          <>
            <Check className="h-4 w-4 text-green-400" />
            <span className="text-green-400">{t.enabled}</span>
          </>
        ) : (
          <span className="text-gray-500">{t.disabled}</span>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-800 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-600/20">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-white">{t.warning}</h3>
            </div>

            <p className="mb-6 text-gray-300">{t.warningDetails}</p>

            <div className="flex gap-3">
              <button
                onClick={handleCancelEnable}
                className="flex-1 rounded-lg bg-gray-700 px-4 py-2 text-gray-300 transition-colors hover:bg-gray-600"
              >
                {t.disableSync}
              </button>
              <button
                onClick={handleConfirmEnable}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
              >
                {t.enableSync}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
