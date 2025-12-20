'use client';

import { CampaignCard as BaseCampaignCard } from '@adult-v/shared/components';
import { Campaign } from '@/types/product';

interface Props {
  campaign: Campaign;
}

/**
 * CampaignCard wrapper for apps/web (dark theme)
 */
export default function CampaignCard({ campaign }: Props) {
  return <BaseCampaignCard campaign={campaign} theme="dark" />;
}
