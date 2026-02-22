'use client';

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import { useParams } from 'next/navigation';
import { Bell, BellOff } from 'lucide-react';
import { useSiteTheme } from '../contexts/SiteThemeContext';

export type NotificationSubscriberTheme = 'dark' | 'light';

// Client-side translations (ConditionalLayout is outside NextIntlClientProvider)
const translations = {
  ja: {
    notificationsOff: '新着通知をオフ',
    notificationsOn: '新着通知をオン',
    turnOff: '通知オフ',
    turnOn: '新着通知',
    permissionDenied: '通知が許可されていません',
    subscribeFailed: '通知の登録に失敗しました',
    unsubscribeFailed: '通知の解除に失敗しました',
  },
  en: {
    notificationsOff: 'Turn off notifications',
    notificationsOn: 'Turn on notifications',
    turnOff: 'Notify Off',
    turnOn: 'Notify',
    permissionDenied: 'Notification permission denied',
    subscribeFailed: 'Failed to subscribe to notifications',
    unsubscribeFailed: 'Failed to unsubscribe from notifications',
  },
  zh: {
    notificationsOff: '关闭通知',
    notificationsOn: '开启通知',
    turnOff: '关闭通知',
    turnOn: '新内容通知',
    permissionDenied: '通知权限被拒绝',
    subscribeFailed: '订阅通知失败',
    unsubscribeFailed: '取消订阅通知失败',
  },
  ko: {
    notificationsOff: '알림 끄기',
    notificationsOn: '알림 켜기',
    turnOff: '알림 끄기',
    turnOn: '새 알림',
    permissionDenied: '알림 권한이 거부되었습니다',
    subscribeFailed: '알림 구독에 실패했습니다',
    unsubscribeFailed: '알림 구독 취소에 실패했습니다',
  },
} as const;

// Theme configuration
const themeConfig = {
  dark: {
    subscribed: 'bg-rose-600 text-white hover:bg-rose-700',
    unsubscribed: 'bg-gray-700 text-gray-300 hover:bg-gray-600',
  },
  light: {
    subscribed: 'bg-rose-600 text-white hover:bg-rose-700',
    unsubscribed: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300',
  },
} as const;

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

interface NotificationSubscriberProps {
  theme?: NotificationSubscriberTheme;
}

export default function NotificationSubscriber({ theme: themeProp }: NotificationSubscriberProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = (themeProp ?? contextTheme) as NotificationSubscriberTheme;
  const [isSubscribed, setIsSubscribed] = useState(false);
  const isSupported = useNotificationSupport();
  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';
  // Memoize translation object to prevent recreation on each render
  const t = useMemo(
    () => translations[locale as keyof typeof translations] || translations.ja,
    [locale]
  );
  const colors = themeConfig[theme];

  const checkSubscriptionStatus = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error: unknown) {
      if (process.env['NODE_ENV'] === 'development') {
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

  // Memoize utility function to prevent recreation
  const urlBase64ToUint8Array = useCallback((base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }, []);

  const subscribeToNotifications = useCallback(async () => {
    try {
      // Request permission
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        alert(t.permissionDenied);
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      // Note: You need to set up VAPID keys for production
      const applicationServerKey = process.env['NEXT_PUBLIC_VAPID_PUBLIC_KEY'];

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
      alert(t.subscribeFailed);
    }
  }, [t.permissionDenied, t.subscribeFailed, urlBase64ToUint8Array]);

  const unsubscribeFromNotifications = useCallback(async () => {
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
          body: JSON.stringify({ endpoint: subscription['endpoint'] }),
        });
      }

      setIsSubscribed(false);
      localStorage.removeItem('notifications-enabled');
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      alert(t.unsubscribeFailed);
    }
  }, [t.unsubscribeFailed]);

  const handleToggle = useCallback(() => {
    if (isSubscribed) {
      unsubscribeFromNotifications();
    } else {
      subscribeToNotifications();
    }
  }, [isSubscribed, subscribeToNotifications, unsubscribeFromNotifications]);

  if (!isSupported) {
    return null;
  }

  return (
    <button
      onClick={handleToggle}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        isSubscribed ? colors.subscribed : colors.unsubscribed
      }`}
      title={isSubscribed ? t.notificationsOff : t.notificationsOn}
    >
      {isSubscribed ? (
        <>
          <BellOff className="h-5 w-5" />
          <span className="hidden sm:inline">{t.turnOff}</span>
        </>
      ) : (
        <>
          <Bell className="h-5 w-5" />
          <span className="hidden sm:inline">{t.turnOn}</span>
        </>
      )}
    </button>
  );
}
