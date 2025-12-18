/**
 * Push Notification Unsubscribe API Route
 *
 * Uses shared handler with dependency injection for DB operations
 */

import { saveSubscription, removeSubscription } from '@/lib/db/notification-queries';
import { createNotificationsUnsubscribeHandler } from '@adult-v/shared/api-handlers';

export const POST = createNotificationsUnsubscribeHandler({
  saveSubscription,
  removeSubscription,
});
