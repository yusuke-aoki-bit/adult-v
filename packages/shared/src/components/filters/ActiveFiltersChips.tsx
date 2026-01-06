'use client';

import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { X } from 'lucide-react';
import { getFilterThemeConfig, type FilterTheme } from './theme';
import { getActiveFiltersTranslation } from './translations';

interface Filter {
  key: string;
  label: string;
  type: 'boolean' | 'asp' | 'tag' | 'performer';
  value?: string;
}

interface ProviderMetaEntry {
  label: string;
  [key: string]: unknown;
}

interface ActiveFiltersChipsProps {
  theme: FilterTheme;
  /** Whether this is a FANZA-only site (hides ASP filter chips) */
  isFanzaSite?: boolean;
  /** Map of provider IDs to their metadata */
  providerMeta?: Record<string, ProviderMetaEntry>;
  /** Map of ASP names to provider IDs */
  aspToProviderId?: Record<string, string>;
  /** Additional ASPs to hide from chips (e.g., 'FANZA' on multi-site) */
  hiddenAsps?: string[];
}

export default function ActiveFiltersChips({
  theme,
  isFanzaSite = false,
  providerMeta = {},
  aspToProviderId = {},
  hiddenAsps = [],
}: ActiveFiltersChipsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';
  const t = getActiveFiltersTranslation(locale);
  const themeConfig = getFilterThemeConfig(theme);

  const activeFilters: Filter[] = [];

  // Boolean filters
  if (searchParams.get('onSale') === 'true') {
    activeFilters.push({ key: 'onSale', label: t.sale, type: 'boolean' });
  }
  if (searchParams.get('hasVideo') === 'true') {
    activeFilters.push({ key: 'hasVideo', label: t.hasVideo, type: 'boolean' });
  }
  if (searchParams.get('hasImage') === 'true') {
    activeFilters.push({ key: 'hasImage', label: t.hasImage, type: 'boolean' });
  }
  if (searchParams.get('uncategorized') === 'true') {
    activeFilters.push({ key: 'uncategorized', label: t.uncategorized, type: 'boolean' });
  }

  // Performer type
  const performerType = searchParams.get('performerType');
  if (performerType === 'solo') {
    activeFilters.push({ key: 'performerType', label: t.solo, type: 'performer' });
  } else if (performerType === 'multi') {
    activeFilters.push({ key: 'performerType', label: t.multi, type: 'performer' });
  }

  // ASP filters - Hidden on FANZA site
  if (!isFanzaSite) {
    const includeAsp = searchParams.get('includeAsp');
    if (includeAsp) {
      includeAsp.split(',').forEach(asp => {
        // Skip hidden ASPs
        if (hiddenAsps.includes(asp)) return;
        const providerId = aspToProviderId[asp];
        const meta = providerId ? providerMeta[providerId] : null;
        activeFilters.push({
          key: `asp-${asp}`,
          label: meta?.label || asp,
          type: 'asp',
          value: asp,
        });
      });
    }
  }

  // Tag filters
  const includeTags = searchParams.get('include');
  if (includeTags) {
    includeTags.split(',').forEach(tag => {
      activeFilters.push({
        key: `tag-${tag}`,
        label: tag,
        type: 'tag',
        value: tag,
      });
    });
  }

  if (activeFilters.length === 0) return null;

  const removeFilter = (filter: Filter) => {
    const newParams = new URLSearchParams(searchParams.toString());

    if (filter.type === 'asp' && filter.value) {
      const values = newParams.get('includeAsp')?.split(',') || [];
      const filtered = values.filter(v => v !== filter.value);
      if (filtered.length > 0) {
        newParams.set('includeAsp', filtered.join(','));
      } else {
        newParams.delete('includeAsp');
      }
    } else if (filter.type === 'tag' && filter.value) {
      const values = newParams.get('include')?.split(',') || [];
      const filtered = values.filter(v => v !== filter.value);
      if (filtered.length > 0) {
        newParams.set('include', filtered.join(','));
      } else {
        newParams.delete('include');
      }
    } else {
      newParams.delete(filter.key);
    }

    newParams.delete('page');
    router.push(`?${newParams.toString()}`);
  };

  const clearAllFilters = () => {
    const newParams = new URLSearchParams();
    // Keep only sort and limit
    const sort = searchParams.get('sort');
    const limit = searchParams.get('limit');
    if (sort) newParams.set('sort', sort);
    if (limit) newParams.set('limit', limit);
    router.push(`?${newParams.toString()}`);
  };

  return (
    <div className={themeConfig.activeFilters.containerClass}>
      <span className={themeConfig.activeFilters.labelClass}>{t.activeFilters}:</span>
      {activeFilters.map(filter => (
        <button
          key={filter.key}
          onClick={() => removeFilter(filter)}
          className={themeConfig.activeFilters.chipClass}
          aria-label={`${filter.label}を削除`}
        >
          <span>{filter.label}</span>
          <X className="w-3 h-3 opacity-70 group-hover:opacity-100" />
        </button>
      ))}
      {activeFilters.length > 1 && (
        <button
          onClick={clearAllFilters}
          className={themeConfig.activeFilters.clearAllClass}
        >
          {t.clearAll}
        </button>
      )}
    </div>
  );
}
