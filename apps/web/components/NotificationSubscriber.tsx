'use client';

import { NotificationSubscriber as BaseNotificationSubscriber } from '@adult-v/shared/components';
import { useSiteTheme } from '@/lib/contexts/SiteContext';

/**
 * NotificationSubscriber wrapper - テーマはSiteContextから自動取得
 */
export default function NotificationSubscriber() {
  const theme = useSiteTheme();
  return <BaseNotificationSubscriber theme={theme} />;
}
