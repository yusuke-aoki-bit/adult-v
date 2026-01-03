import { getDb } from '@/lib/db';
import { userReviews, userReviewVotes, products } from '@adult-v/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import { createUserReviewsGetHandler, createUserReviewsPostHandler } from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';

const deps = {
  getDb,
  userReviews,
  userReviewVotes,
  products,
  eq,
  and,
  desc,
  sql,
};

export const GET = createUserReviewsGetHandler(deps);
export const POST = createUserReviewsPostHandler(deps);
