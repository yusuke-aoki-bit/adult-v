'use client';

import { ActiveFiltersChips as ActiveFiltersChipsBase } from '@adult-v/shared/components';
import { providerMeta, type ProviderMeta } from '@/lib/providers';
import { ASP_TO_PROVIDER_ID } from '@/lib/constants/filters';
import { useSite } from '@/lib/contexts/SiteContext';

// Convert providerMeta to compatible type
const providerMetaForChips: Record<string, { label: string; [key: string]: unknown }> = {};
(Object.entries(providerMeta) as [string, ProviderMeta][]).forEach(([key, value]) => {
  providerMetaForChips[key] = { ...value };
});

// Convert ASP_TO_PROVIDER_ID to compatible type (filter out undefined values)
const aspToProviderIdForChips: Record<string, string> = {};
Object.entries(ASP_TO_PROVIDER_ID).forEach(([key, value]) => {
  if (value !== undefined && typeof value === 'string') {
    aspToProviderIdForChips[key] = value;
  }
});

/**
 * Active filters chips for apps/fanza (light theme)
 * Uses shared component from @adult-v/shared
 */
export default function ActiveFiltersChips() {
  const { isFanzaSite } = useSite();

  return (
    <ActiveFiltersChipsBase
      theme="light"
      isFanzaSite={isFanzaSite}
      providerMeta={providerMetaForChips}
      aspToProviderId={aspToProviderIdForChips}
    />
  );
}
