'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Bell, BellOff } from 'lucide-react';

// Check if notifications are supported (client-side only)
function useNotificationSupport() {
  const subscribe = () => () => {}; // No external changes to watch
  const getSnapshot = () =>
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;
  const getServerSnapshot = () => false;
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default function NotificationSubscriber() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const isSupported = useNotificationSupport();

  const checkSubscriptionStatus = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error: unknown) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[NotificationSubscriber] Subscription check failed:', error);
      }
    }
  }, []);

  useEffect(() => {
    // Check current subscription status when supported
    if (isSupported) {
      checkSubscriptionStatus();
    }
  }, [isSupported, checkSubscriptionStatus]);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribe = async () => {
    try {
      // Request permission
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        alert('通知が許可されていません');
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      // Note: You need to set up VAPID keys for production
      const applicationServerKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!applicationServerKey) {
        console.warn('VAPID public key not configured');
        // For demo purposes, just show notification permission was granted
        setIsSubscribed(true);
        localStorage.setItem('notifications-enabled', 'true');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(applicationServerKey),
      });

      // Send subscription to backend
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });

      setIsSubscribed(true);
      localStorage.setItem('notifications-enabled', 'true');
    } catch (error) {
      console.error('Failed to subscribe:', error);
      alert('通知の登録に失敗しました');
    }
  };

  const unsubscribe = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Notify backend
        await fetch('/api/notifications/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      setIsSubscribed(false);
      localStorage.removeItem('notifications-enabled');
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      alert('通知の解除に失敗しました');
    }
  };

  const handleToggle = () => {
    if (isSubscribed) {
      unsubscribe();
    } else {
      subscribe();
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <button
      onClick={handleToggle}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        isSubscribed
          ? 'bg-rose-600 text-white hover:bg-rose-700'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
      title={isSubscribed ? '新着通知をオフ' : '新着通知をオン'}
    >
      {isSubscribed ? (
        <>
          <BellOff className="h-5 w-5" />
          <span className="hidden sm:inline">通知オフ</span>
        </>
      ) : (
        <>
          <Bell className="h-5 w-5" />
          <span className="hidden sm:inline">新着通知</span>
        </>
      )}
    </button>
  );
}
