/**
 * Bot detection utility
 * Provides multiple layers of bot detection
 */

import { NextRequest } from 'next/server';

export interface BotDetectionResult {
  isBot: boolean;
  reason?: string;
  score: number;  // 0-100, higher = more likely bot
}

/**
 * Known bot User-Agent patterns
 */
const BOT_USER_AGENTS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /python-urllib/i,
  /java\//i,
  /libwww/i,
  /httpunit/i,
  /nutch/i,
  /phpcrawl/i,
  /msnbot/i,
  /jyxobot/i,
  /fast-webcrawler/i,
  /fast enterprise crawler/i,
  /biglotron/i,
  /teoma/i,
  /convera/i,
  /seekbot/i,
  /gigabot/i,
  /gigablast/i,
  /exabot/i,
  /ia_archiver/i,
  /GingerCrawler/i,
  /webmon/i,
  /httrack/i,
  /grub\.org/i,
  /UsineNouvelleCrawler/i,
  /antibot/i,
  /netresearchserver/i,
  /speedy/i,
  /fluffy/i,
  /findlink/i,
  /panscient/i,
  /IOI/i,
  /ips-agent/i,
  /yanga/i,
  /Cyberpatrol/i,
  /postrank/i,
  /page2rss/i,
  /linkdex/i,
  /ezooms/i,
  /heritrix/i,
  /findthatfile/i,
  /europarchive\.org/i,
  /NerdByNature\.Bot/i,
  /sistrix/i,
  /Ahrefs/i,
  /fuelbot/i,
  /CrunchBot/i,
  /centurybot9/i,
  /IndeedBot/i,
  /mappydata/i,
  /woobot/i,
  /ZoominfoBot/i,
  /PrivacyAwareBot/i,
  /Multiviewbot/i,
  /SWIMGBot/i,
  /Grobbot/i,
  /eright/i,
  /Apercite/i,
  /semanticbot/i,
  /Aboundex/i,
  /domainstats/i,
  /Lipperhey/i,
  /seoscanners/i,
  /NerdyBot/i,
  /DomainAppender/i,
  /SemrushBot/i,
  /MJ12bot/i,
  /DotBot/i,
  /PetalBot/i,
  /BLEXBot/i,
  /Screaming Frog/i,
  /HeadlessChrome/i,
  /PhantomJS/i,
  /Playwright/i,
  /Puppeteer/i,
];

/**
 * Allowed bot User-Agents (search engines, etc.)
 */
const ALLOWED_BOTS = [
  /Googlebot/i,
  /Bingbot/i,
  /Slurp/i,  // Yahoo
  /DuckDuckBot/i,
  /Baiduspider/i,
  /YandexBot/i,
  /facebookexternalhit/i,
  /Twitterbot/i,
  /LinkedInBot/i,
  /WhatsApp/i,
  /TelegramBot/i,
  /Discordbot/i,
];

/**
 * Detect if request is from a bot
 */
export function detectBot(request: NextRequest): BotDetectionResult {
  let score = 0;
  const reasons: string[] = [];

  const userAgent = request.headers.get('user-agent') || '';
  const acceptLanguage = request.headers.get('accept-language');
  const acceptEncoding = request.headers.get('accept-encoding');
  const accept = request.headers.get('accept');
  const secFetchMode = request.headers.get('sec-fetch-mode');
  const secFetchSite = request.headers.get('sec-fetch-site');

  // Check for allowed bots first
  for (const pattern of ALLOWED_BOTS) {
    if (pattern.test(userAgent)) {
      return { isBot: true, reason: 'allowed_bot', score: 0 };
    }
  }

  // Check for known bot patterns
  for (const pattern of BOT_USER_AGENTS) {
    if (pattern.test(userAgent)) {
      score += 80;
      reasons.push('known_bot_ua');
      break;
    }
  }

  // Empty or missing User-Agent
  if (!userAgent || userAgent.length < 10) {
    score += 40;
    reasons.push('missing_ua');
  }

  // Missing Accept-Language (browsers always send this)
  if (!acceptLanguage) {
    score += 20;
    reasons.push('missing_accept_language');
  }

  // Missing Accept-Encoding
  if (!acceptEncoding) {
    score += 15;
    reasons.push('missing_accept_encoding');
  }

  // Missing Accept header
  if (!accept) {
    score += 15;
    reasons.push('missing_accept');
  }

  // Check Sec-Fetch headers (modern browsers send these)
  // API requests from same-origin should have these
  if (!secFetchMode && !secFetchSite) {
    score += 10;
    reasons.push('missing_sec_fetch');
  }

  // Check for suspicious User-Agent patterns
  if (userAgent.includes('http://') || userAgent.includes('https://')) {
    score += 20;
    reasons.push('url_in_ua');
  }

  // Very short User-Agent
  if (userAgent.length > 0 && userAgent.length < 30) {
    score += 15;
    reasons.push('short_ua');
  }

  // Very long User-Agent (some bots have extremely long UAs)
  if (userAgent.length > 500) {
    score += 10;
    reasons.push('long_ua');
  }

  return {
    isBot: score >= 50,
    reason: reasons.join(','),
    score: Math.min(score, 100),
  };
}

// Default allowed hosts (can be extended per-site)
const DEFAULT_ALLOWED_HOSTS = [
  'localhost',
  'adult-v.com',
  'www.adult-v.com',
  'f.adult-v.com',
  'www.f.adult-v.com',
];

// Default allowed patterns
const DEFAULT_ALLOWED_PATTERNS = [
  /\.hosted\.app$/,  // Firebase App Hosting
];

// Configurable allowed hosts
let configuredAllowedHosts: string[] = DEFAULT_ALLOWED_HOSTS;
let configuredAllowedPatterns: RegExp[] = DEFAULT_ALLOWED_PATTERNS;

/**
 * Configure allowed hosts for security header validation
 */
export function setAllowedHosts(hosts: string[], patterns?: RegExp[]): void {
  configuredAllowedHosts = hosts;
  if (patterns) {
    configuredAllowedPatterns = patterns;
  }
}

/**
 * Validate that the request has required security headers
 * for API requests from the frontend
 */
export function validateSecurityHeaders(request: NextRequest): boolean {
  // For same-origin API requests, browser should send these
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // At least one of origin or referer should be present for browser requests
  if (!origin && !referer) {
    return false;
  }

  // Validate origin if present
  if (origin) {
    try {
      const url = new URL(origin);
      const isAllowedHost = configuredAllowedHosts.some(
        host => url.hostname === host || url.hostname.endsWith('.' + host)
      );
      const isAllowedPattern = configuredAllowedPatterns.some(
        pattern => pattern.test(url.hostname)
      );
      if (!isAllowedHost && !isAllowedPattern) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Generate a simple challenge token
 * This is a basic implementation - for production, consider using CAPTCHA
 */
export function generateChallengeToken(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return Buffer.from(`${timestamp}:${random}`).toString('base64');
}

/**
 * Validate challenge token (must be recent, within 5 minutes)
 */
export function validateChallengeToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [timestampStr] = decoded.split(':');
    const timestamp = parseInt(timestampStr, 10);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    return now - timestamp < fiveMinutes;
  } catch {
    return false;
  }
}
