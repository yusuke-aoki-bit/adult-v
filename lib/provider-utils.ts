import type { ProviderId } from '@/types/product';

/**
 * Valid provider IDs
 */
export const VALID_PROVIDER_IDS: readonly ProviderId[] = ['dmm', 'duga', 'sokmil', 'dti'] as const;

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
  // Map 'apex' to 'duga' for backwards compatibility
  if (provider === 'apex') {
    return 'duga';
  }

  // Normalize to lowercase for case-insensitive matching
  const normalizedProvider = provider.toLowerCase();

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
  return services
    .map(mapLegacyProvider)
    .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
}
