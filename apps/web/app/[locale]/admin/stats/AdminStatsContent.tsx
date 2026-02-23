'use client';

import { AdminStatsContent as SharedAdminStatsContent } from '@adult-v/shared/components';

export default function AdminStatsContent() {
  return <SharedAdminStatsContent darkMode={true} showSeoIndexing={true} showSchedulers={true} />;
}
