import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rate-limit';
import { detectBot, validateSecurityHeaders } from '@/lib/bot-detection';

export async function POST(request: NextRequest) {
  // 1. Bot detection (relaxed for age-verify - Firebase App Hosting may strip some headers)
  const botResult = detectBot(request);
  if (botResult.isBot && botResult.reason !== 'allowed_bot') {
    // Only block known bot UAs (score >= 80), allow suspicious but potentially legitimate requests
    if (botResult.score >= 80) {
      console.warn('[age-verify] Known bot blocked:', botResult.reason, 'score:', botResult.score);
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    // Log suspicious requests but don't block - CDN/proxy may strip headers
    console.info('[age-verify] Suspicious request (allowed):', botResult.reason, 'score:', botResult.score);
  }

  // 2. Rate limiting
  const clientIP = getClientIP(request);
  const rateLimitResult = checkRateLimit(
    `age-verify:${clientIP}`,
    RATE_LIMITS.strict
  );

  if (!rateLimitResult.allowed) {
    console.warn('[age-verify] Rate limit exceeded for IP:', clientIP);
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimitResult.resetTime),
        },
      }
    );
  }

  // 3. Security headers validation (optional, warn only)
  if (!validateSecurityHeaders(request)) {
    console.warn('[age-verify] Missing security headers from IP:', clientIP);
    // Don't block, just log - some legitimate users may have strict browser settings
  }

  // Success - set secure cookie
  const response = NextResponse.json({ success: true });

  response.cookies.set('age-verified', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });

  // Add rate limit headers
  response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining));
  response.headers.set('X-RateLimit-Reset', String(rateLimitResult.resetTime));

  return response;
}

export async function DELETE(request: NextRequest) {
  // Rate limiting for delete as well
  const clientIP = getClientIP(request);
  const rateLimitResult = checkRateLimit(
    `age-verify:${clientIP}`,
    RATE_LIMITS.strict
  );

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  const response = NextResponse.json({ success: true });

  // Clear the cookie
  response.cookies.set('age-verified', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });

  return response;
}
