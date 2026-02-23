import type { ProviderId } from '@/types/product';

/**
 * Valid provider IDs
 */
export const VALID_PROVIDER_IDS: readonly ProviderId[] = [
  'duga',
  'sokmil',
  'dti',
  'mgs',
  'b10f',
  'japanska',
  'fc2',
  'fanza',
] as const;

/**
 * Check if a string is a valid ProviderId
 */
export function isValidProviderId(value: string): value is ProviderId {
  return VALID_PROVIDER_IDS.includes(value as ProviderId);
}

/**
 * Map legacy provider names to current ones
 * Used for database migration compatibility
 */
export function mapLegacyProvider(provider: string): ProviderId {
  // Normalize to lowercase for case-insensitive matching
  const normalizedProvider = provider.toLowerCase();

  // Map 'apex' to 'duga' for backwards compatibility
  if (normalizedProvider === 'apex') {
    return 'duga';
  }

  // Map specific ASP names to provider IDs
  const aspMapping: Record<string, ProviderId> = {
    duga: 'duga',
    apex: 'duga',
    dti: 'dti',
    mgs: 'mgs',
    b10f: 'b10f',
    sokmil: 'sokmil',
    ソクミル: 'sokmil',
    japanska: 'japanska',
    fc2: 'fc2',
    fanza: 'fanza',
    dmm: 'fanza',
    // DTI系サイト（月額制）
    heyzo: 'dti',
    caribbeancom: 'dti', // カリビアンコム（月額制）
    '1pondo': 'dti',
    '10musume': 'dti',
    pacopacomama: 'dti',
    muramura: 'dti',
    tokyohot: 'dti',
    // カリビアンコムプレミアムは単品購入サイト（月額制ではない）
    カリビアンコムプレミアム: 'dti',
    caribbeancompr: 'dti',
  };

  const mapped = aspMapping[normalizedProvider];
  if (mapped) {
    return mapped;
  }

  // If valid provider, return it
  if (isValidProviderId(normalizedProvider)) {
    return normalizedProvider;
  }

  // Default to 'duga' for unknown providers
  console.warn(`Unknown provider "${provider}", defaulting to "duga"`);
  return 'duga';
}

/**
 * Map an array of legacy service names to current provider IDs
 */
export function mapLegacyServices(services: string[]): ProviderId[] {
  return services.map(mapLegacyProvider).filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
}
