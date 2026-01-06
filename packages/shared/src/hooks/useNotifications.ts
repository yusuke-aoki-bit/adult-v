'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  isFirebaseConfigured,
  requestNotificationPermission,
  saveFcmToken,
  onForegroundMessage,
} from '../lib/firebase';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';

export interface NotificationPayload {
  title?: string;
  body?: string;
  image?: string;
  data?: Record<string, string>;
}

/**
 * Firebase Cloud Messagingフック
 * - プッシュ通知の許可リクエスト
 * - FCMトークンの取得と保存
 * - フォアグラウンドメッセージのハンドリング
 */
export function useNotifications() {
  const { user, isFirebaseEnabled } = useFirebaseAuth();
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | null>(null);
  const [lastNotification, setLastNotification] = useState<NotificationPayload | null>(null);

  // Check if notifications are supported
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true);
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Listen for foreground messages
  useEffect(() => {
    if (!isFirebaseEnabled || !fcmToken) return;

    const unsubscribe = onForegroundMessage((payload: unknown) => {
      const typedPayload = payload as {
        notification?: { title?: string; body?: string; image?: string };
        data?: Record<string, string>;
      };

      const notification: NotificationPayload = {
        ...(typedPayload.notification?.title !== undefined && { title: typedPayload.notification.title }),
        ...(typedPayload.notification?.body !== undefined && { body: typedPayload.notification.body }),
        ...(typedPayload.notification?.image !== undefined && { image: typedPayload.notification.image }),
        ...(typedPayload.data !== undefined && { data: typedPayload.data }),
      };

      setLastNotification(notification);

      // Show browser notification if permission granted
      if (Notification.permission === 'granted' && notification.title) {
        new Notification(notification.title, {
          ...(notification.body !== undefined && { body: notification.body }),
          icon: notification.image || '/icon-192x192.png',
        });
      }
    });

    return unsubscribe;
  }, [isFirebaseEnabled, fcmToken]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isFirebaseEnabled || !isSupported) return false;

    try {
      const token = await requestNotificationPermission();
      if (token) {
        setFcmToken(token);
        setPermissionStatus('granted');

        // Save token to Firestore if user is available
        if (user) {
          await saveFcmToken(user.uid, token);
        }

        return true;
      } else {
        setPermissionStatus(Notification.permission);
        return false;
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }, [isFirebaseEnabled, isSupported, user]);

  const clearLastNotification = useCallback(() => {
    setLastNotification(null);
  }, []);

  return useMemo(
    () => ({
      isSupported,
      isEnabled: !!fcmToken,
      permissionStatus,
      fcmToken,
      lastNotification,
      requestPermission,
      clearLastNotification,
    }),
    [
      isSupported,
      fcmToken,
      permissionStatus,
      lastNotification,
      requestPermission,
      clearLastNotification,
    ]
  );
}
