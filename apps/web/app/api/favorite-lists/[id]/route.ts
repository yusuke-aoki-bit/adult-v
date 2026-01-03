import { getDb } from '@/lib/db';
import { publicFavoriteLists, publicFavoriteListItems, publicListLikes, products } from '@adult-v/database';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import {
  createPublicFavoriteListsGetHandler,
  createPublicFavoriteListsPutHandler,
  createPublicFavoriteListsDeleteHandler,
} from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';

const deps = {
  getDb,
  publicFavoriteLists,
  publicFavoriteListItems,
  publicListLikes,
  products,
  eq,
  and,
  desc,
  asc,
  sql,
};

export const GET = createPublicFavoriteListsGetHandler(deps);
export const PUT = createPublicFavoriteListsPutHandler(deps);
export const DELETE = createPublicFavoriteListsDeleteHandler(deps);
