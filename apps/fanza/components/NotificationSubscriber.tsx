'use client';

import { NotificationSubscriber as BaseNotificationSubscriber } from '@adult-v/shared/components';

/**
 * NotificationSubscriber wrapper for apps/fanza (light theme)
 */
export default function NotificationSubscriber() {
  return <BaseNotificationSubscriber theme="light" />;
}
