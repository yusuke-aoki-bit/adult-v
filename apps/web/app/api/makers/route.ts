import { getPopularMakers, analyzeMakerPreference } from '@/lib/db/queries';
import { createMakersGetHandler, createMakersPostHandler } from '@adult-v/shared/api-handlers';

export const revalidate = 3600; // 1時間キャッシュ

const deps = {
  getPopularMakers,
  analyzeMakerPreference,
};

export const GET = createMakersGetHandler(deps);
export const POST = createMakersPostHandler(deps);
