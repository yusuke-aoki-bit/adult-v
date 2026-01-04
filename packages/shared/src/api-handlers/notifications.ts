import { NextRequest, NextResponse } from 'next/server';
import { createApiErrorResponse } from '../lib/api-logger';

export interface SubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscription {
  endpoint: string;
  keys: SubscriptionKeys;
}

export interface NotificationsHandlerDeps {
  saveSubscription: (endpoint: string, keys: SubscriptionKeys) => Promise<void>;
  removeSubscription: (endpoint: string) => Promise<void>;
}

export function createNotificationsSubscribeHandler(deps: NotificationsHandlerDeps) {
  return async function POST(request: NextRequest) {
    try {
      const subscription = await request.json() as PushSubscription;

      // Validate subscription object
      if (!subscription.endpoint || !subscription.keys) {
        return NextResponse.json(
          { error: 'Invalid subscription object' },
          { status: 400 }
        );
      }

      await deps.saveSubscription(subscription.endpoint, subscription.keys);

      return NextResponse.json(
        { success: true, message: 'Subscription saved successfully' },
        { status: 200 }
      );
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to save subscription', 500, {
        endpoint: '/api/notifications/subscribe',
      });
    }
  };
}

export function createNotificationsUnsubscribeHandler(deps: NotificationsHandlerDeps) {
  return async function POST(request: NextRequest) {
    try {
      const { endpoint } = await request.json();

      // Validate endpoint
      if (!endpoint) {
        return NextResponse.json(
          { error: 'Endpoint is required' },
          { status: 400 }
        );
      }

      await deps.removeSubscription(endpoint);

      return NextResponse.json(
        { success: true, message: 'Subscription removed successfully' },
        { status: 200 }
      );
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to remove subscription', 500, {
        endpoint: '/api/notifications/unsubscribe',
      });
    }
  };
}
