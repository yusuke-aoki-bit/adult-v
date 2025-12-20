'use client';

import { CampaignCard as BaseCampaignCard } from '@adult-v/shared/components';
import { Campaign } from '@/types/product';

interface Props {
  campaign: Campaign;
}

/**
 * CampaignCard wrapper for apps/fanza (light theme)
 */
export default function CampaignCard({ campaign }: Props) {
  return <BaseCampaignCard campaign={campaign} theme="light" />;
}
