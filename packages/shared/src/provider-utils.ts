import type { ProviderId } from './asp-registry';
import { VALID_PROVIDER_IDS, LEGACY_PROVIDER_MAP } from './asp-registry';

// Re-export for backward compatibility
export { VALID_PROVIDER_IDS };

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
  const normalizedProvider = provider.toLowerCase();

  const mapped = LEGACY_PROVIDER_MAP[normalizedProvider] || LEGACY_PROVIDER_MAP[provider];
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
  return services
    .map(mapLegacyProvider)
    .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
}
