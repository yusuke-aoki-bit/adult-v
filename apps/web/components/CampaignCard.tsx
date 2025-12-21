'use client';

import { CampaignCard as BaseCampaignCard } from '@adult-v/shared/components';
import { Campaign } from '@/types/product';
import { useSiteTheme } from '@/lib/contexts/SiteContext';

interface Props {
  campaign: Campaign;
}

/**
 * CampaignCard wrapper - テーマはSiteContextから自動取得
 */
export default function CampaignCard({ campaign }: Props) {
  const theme = useSiteTheme();
  return <BaseCampaignCard campaign={campaign} theme={theme} />;
}
