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
      await new Promise(resolve => setTimeout(resolve, 1000));
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
      <div className="bg-gray-800 rounded-lg p-4 animate-pulse">
        <div className="h-6 w-32 bg-gray-700 rounded mb-2" />
        <div className="h-4 w-48 bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isEnabled ? (
            <Cloud className="w-5 h-5 text-blue-400" />
          ) : (
            <CloudOff className="w-5 h-5 text-gray-500" />
          )}
          <h3 className="text-white font-medium">{t.title}</h3>
        </div>

        <button
          onClick={handleToggle}
          disabled={isSyncing}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            isEnabled ? 'bg-blue-600' : 'bg-gray-600'
          } ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
              isEnabled ? 'left-7' : 'left-1'
            }`}
          />
        </button>
      </div>

      <p className="text-sm text-gray-400 mb-3">{t.description}</p>

      {/* Status */}
      <div className="flex items-center gap-2 text-sm">
        {isSyncing ? (
          <>
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            <span className="text-blue-400">{t.syncing}</span>
          </>
        ) : isEnabled ? (
          <>
            <Check className="w-4 h-4 text-green-400" />
            <span className="text-green-400">{t.enabled}</span>
          </>
        ) : (
          <span className="text-gray-500">{t.disabled}</span>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-600/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-white">{t.warning}</h3>
            </div>

            <p className="text-gray-300 mb-6">{t.warningDetails}</p>

            <div className="flex gap-3">
              <button
                onClick={handleCancelEnable}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
              >
                {t.disableSync}
              </button>
              <button
                onClick={handleConfirmEnable}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
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

// Translations
export const cloudSyncTranslations = {
  ja: {
    title: 'クラウド同期',
    description: 'お気に入りと閲覧履歴を複数デバイス間で同期します',
    enableSync: '有効にする',
    disableSync: 'キャンセル',
    enabled: '同期中',
    disabled: '無効',
    warning: 'プライバシーに関する注意',
    warningDetails: 'クラウド同期を有効にすると、お気に入りと閲覧履歴がサーバーに保存されます。このデータは匿名ですが、閲覧傾向の分析に使用される可能性があります。',
    syncing: '同期中...',
    lastSynced: '最終同期',
    never: '未同期',
  },
  en: {
    title: 'Cloud Sync',
    description: 'Sync favorites and viewing history across devices',
    enableSync: 'Enable',
    disableSync: 'Cancel',
    enabled: 'Synced',
    disabled: 'Disabled',
    warning: 'Privacy Notice',
    warningDetails: 'Enabling cloud sync will store your favorites and viewing history on our servers. This data is anonymous but may be used to analyze viewing patterns.',
    syncing: 'Syncing...',
    lastSynced: 'Last synced',
    never: 'Never',
  },
  zh: {
    title: '云同步',
    description: '在多个设备间同步收藏和观看历史',
    enableSync: '启用',
    disableSync: '取消',
    enabled: '已同步',
    disabled: '已禁用',
    warning: '隐私提示',
    warningDetails: '启用云同步后，您的收藏和观看历史将保存到服务器。这些数据是匿名的，但可能用于分析观看模式。',
    syncing: '同步中...',
    lastSynced: '上次同步',
    never: '从未',
  },
  ko: {
    title: '클라우드 동기화',
    description: '여러 기기에서 즐겨찾기와 시청 기록을 동기화합니다',
    enableSync: '활성화',
    disableSync: '취소',
    enabled: '동기화됨',
    disabled: '비활성화',
    warning: '개인정보 안내',
    warningDetails: '클라우드 동기화를 활성화하면 즐겨찾기와 시청 기록이 서버에 저장됩니다. 이 데이터는 익명이지만 시청 패턴 분석에 사용될 수 있습니다.',
    syncing: '동기화 중...',
    lastSynced: '마지막 동기화',
    never: '없음',
  },
} as const;
