import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rate-limit';
import { detectBot, validateSecurityHeaders } from '@/lib/bot-detection';
import {
  createAgeVerifyPostHandler,
  createAgeVerifyDeleteHandler,
} from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';

export const POST = createAgeVerifyPostHandler({
  checkRateLimit,
  getClientIP,
  RATE_LIMITS,
  detectBot,
  validateSecurityHeaders,
});

export const DELETE = createAgeVerifyDeleteHandler({
  checkRateLimit,
  getClientIP,
  RATE_LIMITS,
  detectBot,
  validateSecurityHeaders,
});
