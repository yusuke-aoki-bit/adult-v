// サイト識別子（localhostでの開発時にセッションが共有されないように）
const SITE_MODE = (typeof process !== 'undefined' && process.env?.['NEXT_PUBLIC_SITE_MODE']) || 'adult-v';

// LocalStorage keys（サイトごとに分離）
export const STORAGE_KEYS = {
  FAVORITE_ACTRESSES: `favoriteActresses-${SITE_MODE}`,
  FAVORITE_PRODUCTS: `favoriteProducts-${SITE_MODE}`,
  COOKIE_CONSENT: `cookie-consent-${SITE_MODE}`,
  RECENTLY_VIEWED: `recentlyViewed-${SITE_MODE}`,
  PER_PAGE: `perPage-${SITE_MODE}`,
  FILTER_SETTINGS: `filterSettings-${SITE_MODE}`,
  PWA_DISMISSED: `pwa-install-dismissed-${SITE_MODE}`,
  NOTIFICATIONS_ENABLED: `notifications-enabled-${SITE_MODE}`,
  CLOUD_SYNC_ENABLED: `cloud-sync-enabled-${SITE_MODE}`,
  // 購買直結機能用
  PRICE_ALERTS: `priceAlerts-${SITE_MODE}`,
  SALE_PREFERENCES: `salePreferences-${SITE_MODE}`,
  VIDEO_WATCH_PROGRESS: `videoWatchProgress-${SITE_MODE}`,
  NOTIFICATION_PREFERENCES: `notificationPreferences-${SITE_MODE}`,
} as const;
