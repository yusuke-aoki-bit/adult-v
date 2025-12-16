// Re-export from @adult-v/shared
export type { BotDetectionResult } from '@adult-v/shared/lib/bot-detection';
export {
  detectBot,
  validateSecurityHeaders,
  generateChallengeToken,
  validateChallengeToken,
  setAllowedHosts,
} from '@adult-v/shared/lib/bot-detection';
